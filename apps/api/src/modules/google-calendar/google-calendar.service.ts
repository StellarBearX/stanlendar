import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google, calendar_v3 } from 'googleapis';
import { CryptoService } from '../auth/crypto.service';
import { CalendarAccount } from '../../infra/database/entities/calendar-account.entity';
import { GoogleTokens } from '../auth/interfaces/auth.interface';

export interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  recurrence?: string[];
  colorId?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export interface BatchOperationResult {
  successful: Array<{
    localEventId: string;
    googleEventId: string;
    etag: string;
  }>;
  failed: Array<{
    localEventId: string;
    error: string;
  }>;
}

export interface QuotaInfo {
  remaining: number;
  resetTime: Date;
  dailyLimit: number;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly timezone = 'Asia/Bangkok';
  private readonly dailyQuotaLimit: number;
  private readonly batchSize = 50;
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(CalendarAccount)
    private readonly calendarAccountRepository: Repository<CalendarAccount>,
    private readonly cryptoService: CryptoService,
  ) {
    this.dailyQuotaLimit = this.configService.get<number>('GOOGLE_API_QUOTA_LIMIT', 3000);
  }

  /**
   * Creates an authenticated Google Calendar client for a user
   */
  private async createCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
    const account = await this.calendarAccountRepository.findOne({
      where: { userId, provider: 'google' },
    });
    if (!account) {
      throw new UnauthorizedException('No Google Calendar account found for user');
    }

    const tokens = await this.getValidTokens(account);
    
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
    );

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Gets valid tokens, refreshing if necessary
   */
  private async getValidTokens(account: CalendarAccount): Promise<GoogleTokens> {
    const now = new Date();
    const expiresAt = new Date(account.tokenExpiresAt);

    // If token expires within 5 minutes, refresh it
    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      this.logger.debug(`Refreshing expired token for user ${account.userId}`);
      return this.refreshTokens(account);
    }

    // Decrypt and return current tokens
    const accessToken = this.cryptoService.decryptToken(
      JSON.parse(account.accessTokenEnc),
      account.userId,
    );
    const refreshToken = this.cryptoService.decryptToken(
      JSON.parse(account.refreshTokenEnc),
      account.userId,
    );

    return {
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  /**
   * Refreshes Google OAuth tokens
   */
  private async refreshTokens(account: CalendarAccount): Promise<GoogleTokens> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.configService.get<string>('GOOGLE_CLIENT_ID'),
        this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      );

      const refreshToken = this.cryptoService.decryptToken(
        JSON.parse(account.refreshTokenEnc),
        account.userId,
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      const expiresAt = new Date(credentials.expiry_date || Date.now() + 3600 * 1000);
      
      // Encrypt and store new tokens
      const encryptedAccessToken = this.cryptoService.encryptToken(
        credentials.access_token,
        account.userId,
      );

      await this.calendarAccountRepository.update(account.id, {
        accessTokenEnc: JSON.stringify(encryptedAccessToken),
        tokenExpiresAt: expiresAt,
      });

      this.logger.debug(`Successfully refreshed tokens for user ${account.userId}`);

      return {
        accessToken: credentials.access_token,
        refreshToken,
        expiresAt,
      };
    } catch (error) {
      this.logger.error(`Failed to refresh tokens for user ${account.userId}:`, error);
      throw new UnauthorizedException('Failed to refresh Google Calendar access');
    }
  }

  /**
   * Creates a single event in Google Calendar
   */
  async createEvent(
    userId: string,
    event: GoogleCalendarEvent,
    calendarId: string = 'primary',
  ): Promise<{ eventId: string; etag: string }> {
    const calendar = await this.createCalendarClient(userId);

    try {
      const response = await this.executeWithRetry(async () => {
        return calendar.events.insert({
          calendarId,
          requestBody: {
            ...event,
            start: {
              ...event.start,
              timeZone: this.timezone,
            },
            end: {
              ...event.end,
              timeZone: this.timezone,
            },
          },
        });
      });

      if (!response.data.id || !response.data.etag) {
        throw new Error('Invalid response from Google Calendar API');
      }

      this.logger.debug(`Created event ${response.data.id} for user ${userId}`);

      return {
        eventId: response.data.id,
        etag: response.data.etag,
      };
    } catch (error) {
      this.logger.error(`Failed to create event for user ${userId}:`, error);
      throw this.handleGoogleApiError(error);
    }
  }

  /**
   * Updates an existing event in Google Calendar
   */
  async updateEvent(
    userId: string,
    eventId: string,
    event: GoogleCalendarEvent,
    etag?: string,
    calendarId: string = 'primary',
  ): Promise<{ eventId: string; etag: string }> {
    const calendar = await this.createCalendarClient(userId);

    try {
      const headers: any = {};
      if (etag) {
        headers['If-Match'] = etag;
      }

      const response = await this.executeWithRetry(async () => {
        return calendar.events.update({
          calendarId,
          eventId,
          requestBody: {
            ...event,
            start: {
              ...event.start,
              timeZone: this.timezone,
            },
            end: {
              ...event.end,
              timeZone: this.timezone,
            },
          },
          headers,
        });
      });

      if (!response.data.id || !response.data.etag) {
        throw new Error('Invalid response from Google Calendar API');
      }

      this.logger.debug(`Updated event ${response.data.id} for user ${userId}`);

      return {
        eventId: response.data.id,
        etag: response.data.etag,
      };
    } catch (error) {
      this.logger.error(`Failed to update event ${eventId} for user ${userId}:`, error);
      throw this.handleGoogleApiError(error);
    }
  }

  /**
   * Deletes an event from Google Calendar
   */
  async deleteEvent(
    userId: string,
    eventId: string,
    calendarId: string = 'primary',
  ): Promise<void> {
    const calendar = await this.createCalendarClient(userId);

    try {
      await this.executeWithRetry(async () => {
        return calendar.events.delete({
          calendarId,
          eventId,
        });
      });

      this.logger.debug(`Deleted event ${eventId} for user ${userId}`);
    } catch (error) {
      // If event doesn't exist, consider it successfully deleted
      if (error.code === 404) {
        this.logger.debug(`Event ${eventId} already deleted for user ${userId}`);
        return;
      }

      this.logger.error(`Failed to delete event ${eventId} for user ${userId}:`, error);
      throw this.handleGoogleApiError(error);
    }
  }

  /**
   * Gets an event from Google Calendar
   */
  async getEvent(
    userId: string,
    eventId: string,
    calendarId: string = 'primary',
  ): Promise<calendar_v3.Schema$Event> {
    const calendar = await this.createCalendarClient(userId);

    try {
      const response = await this.executeWithRetry(async () => {
        return calendar.events.get({
          calendarId,
          eventId,
        });
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get event ${eventId} for user ${userId}:`, error);
      throw this.handleGoogleApiError(error);
    }
  }

  /**
   * Batch creates multiple events
   */
  async batchCreateEvents(
    userId: string,
    events: Array<{ localEventId: string; event: GoogleCalendarEvent }>,
    calendarId: string = 'primary',
  ): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      successful: [],
      failed: [],
    };

    // Process in chunks to respect batch size limits
    const chunks = this.chunkArray(events, this.batchSize);

    for (const chunk of chunks) {
      const chunkResult = await this.processBatchChunk(userId, chunk, 'create', calendarId);
      result.successful.push(...chunkResult.successful);
      result.failed.push(...chunkResult.failed);
    }

    return result;
  }

  /**
   * Processes a batch chunk of operations
   */
  private async processBatchChunk(
    userId: string,
    events: Array<{ localEventId: string; event: GoogleCalendarEvent }>,
    operation: 'create' | 'update',
    calendarId: string,
  ): Promise<BatchOperationResult> {
    const result: BatchOperationResult = {
      successful: [],
      failed: [],
    };

    // For now, process sequentially to avoid rate limits
    // In production, could use Google's batch API
    for (const { localEventId, event } of events) {
      try {
        const response = operation === 'create'
          ? await this.createEvent(userId, event, calendarId)
          : await this.updateEvent(userId, localEventId, event, undefined, calendarId);

        result.successful.push({
          localEventId,
          googleEventId: response.eventId,
          etag: response.etag,
        });
      } catch (error) {
        const handledError = this.handleGoogleApiError(error);
        result.failed.push({
          localEventId,
          error: handledError.message || 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Executes an operation with retry logic and exponential backoff
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (error.code === 401 || error.code === 403 || error.code === 404) {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Handles Google API errors and converts them to appropriate NestJS exceptions
   */
  private handleGoogleApiError(error: any): Error {
    if (error.code === 401) {
      return new UnauthorizedException('Google Calendar access token expired or invalid');
    }

    if (error.code === 403) {
      return new BadRequestException('Google Calendar API quota exceeded or insufficient permissions');
    }

    if (error.code === 404) {
      return new BadRequestException('Google Calendar event not found');
    }

    if (error.code === 412) {
      return new BadRequestException('Google Calendar event was modified by another client (ETag mismatch)');
    }

    if (error.code === 429) {
      return new BadRequestException('Google Calendar API rate limit exceeded');
    }

    return new BadRequestException(`Google Calendar API error: ${error.message}`);
  }

  /**
   * Utility function to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets quota information (mock implementation for now)
   */
  async getQuotaInfo(userId: string): Promise<QuotaInfo> {
    // This is a simplified implementation
    // In production, you'd track quota usage in Redis or database
    const dailyLimit = this.configService.get<number>('GOOGLE_API_QUOTA_LIMIT', 3000);
    return {
      remaining: dailyLimit,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      dailyLimit: dailyLimit,
    };
  }
}