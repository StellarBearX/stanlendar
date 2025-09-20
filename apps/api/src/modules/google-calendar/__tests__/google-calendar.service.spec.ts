import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { GoogleCalendarService, GoogleCalendarEvent } from '../google-calendar.service';
import { CryptoService } from '../../auth/crypto.service';
import { CalendarAccount } from '../../../infra/database/entities/calendar-account.entity';
import { google } from 'googleapis';

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn(),
    },
    calendar: jest.fn(),
  },
}));

describe('GoogleCalendarService', () => {
  let service: GoogleCalendarService;
  let calendarAccountRepository: jest.Mocked<Repository<CalendarAccount>>;
  let cryptoService: jest.Mocked<CryptoService>;
  let configService: jest.Mocked<ConfigService>;
  let mockOAuth2Client: any;
  let mockCalendarClient: any;

  const mockUserId = 'user-123';
  const mockCalendarAccount: CalendarAccount = {
    id: 'account-123',
    userId: mockUserId,
    provider: 'google',
    googleSub: 'google-123',
    accessTokenEnc: JSON.stringify({ data: 'encrypted-access', iv: 'iv', tag: 'tag', keyVersion: 1 }),
    refreshTokenEnc: JSON.stringify({ data: 'encrypted-refresh', iv: 'iv', tag: 'tag', keyVersion: 1 }),
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    primaryCalendarId: 'primary',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null,
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup OAuth2 mock
    mockOAuth2Client = {
      setCredentials: jest.fn(),
      refreshAccessToken: jest.fn(),
    };

    // Setup Calendar client mock
    mockCalendarClient = {
      events: {
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        get: jest.fn(),
      },
    };

    (google.auth.OAuth2 as jest.Mock).mockImplementation(() => mockOAuth2Client);
    (google.calendar as jest.Mock).mockReturnValue(mockCalendarClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleCalendarService,
        {
          provide: getRepositoryToken(CalendarAccount),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: CryptoService,
          useValue: {
            decryptToken: jest.fn(),
            encryptToken: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GoogleCalendarService>(GoogleCalendarService);
    calendarAccountRepository = module.get(getRepositoryToken(CalendarAccount));
    cryptoService = module.get(CryptoService);
    configService = module.get(ConfigService);

    // Setup default config values
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_API_QUOTA_LIMIT: 3000,
      };
      return config[key] || defaultValue;
    });

    // Setup default crypto service responses
    cryptoService.decryptToken.mockImplementation((encrypted, userId) => {
      if (encrypted.data === 'encrypted-access') return 'decrypted-access-token';
      if (encrypted.data === 'encrypted-refresh') return 'decrypted-refresh-token';
      return 'decrypted-token';
    });

    cryptoService.encryptToken.mockReturnValue({
      data: 'new-encrypted-token',
      iv: 'new-iv',
      tag: 'new-tag',
      keyVersion: 1,
    });
  });

  describe('createEvent', () => {
    const mockEvent: GoogleCalendarEvent = {
      summary: 'Test Event',
      description: 'Test Description',
      location: 'Test Room',
      start: {
        dateTime: '2024-01-15T09:00:00',
        timeZone: 'Asia/Bangkok',
      },
      end: {
        dateTime: '2024-01-15T10:00:00',
        timeZone: 'Asia/Bangkok',
      },
      colorId: '1',
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 15 }],
      },
    };

    it('should create an event successfully', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(mockCalendarAccount);
      mockCalendarClient.events.insert.mockResolvedValue({
        data: {
          id: 'event-123',
          etag: 'etag-123',
        },
      });

      // Execute
      const result = await service.createEvent(mockUserId, mockEvent);

      // Verify
      expect(result).toEqual({
        eventId: 'event-123',
        etag: 'etag-123',
      });

      expect(mockCalendarClient.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: {
          ...mockEvent,
          start: {
            ...mockEvent.start,
            timeZone: 'Asia/Bangkok',
          },
          end: {
            ...mockEvent.end,
            timeZone: 'Asia/Bangkok',
          },
        },
      });
    });

    it('should throw UnauthorizedException when no calendar account found', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(null);

      // Execute & Verify
      await expect(service.createEvent(mockUserId, mockEvent)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle Google API errors', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(mockCalendarAccount);
      mockCalendarClient.events.insert.mockRejectedValue({
        code: 403,
        message: 'Quota exceeded',
      });

      // Execute & Verify
      await expect(service.createEvent(mockUserId, mockEvent)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should retry on transient errors', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(mockCalendarAccount);
      mockCalendarClient.events.insert
        .mockRejectedValueOnce({ code: 500, message: 'Internal error' })
        .mockResolvedValue({
          data: {
            id: 'event-123',
            etag: 'etag-123',
          },
        });

      // Execute
      const result = await service.createEvent(mockUserId, mockEvent);

      // Verify
      expect(result.eventId).toBe('event-123');
      expect(mockCalendarClient.events.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateEvent', () => {
    const mockEvent: GoogleCalendarEvent = {
      summary: 'Updated Event',
      start: {
        dateTime: '2024-01-15T09:00:00',
        timeZone: 'Asia/Bangkok',
      },
      end: {
        dateTime: '2024-01-15T10:00:00',
        timeZone: 'Asia/Bangkok',
      },
    };

    it('should update an event successfully', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(mockCalendarAccount);
      mockCalendarClient.events.update.mockResolvedValue({
        data: {
          id: 'event-123',
          etag: 'new-etag-123',
        },
      });

      // Execute
      const result = await service.updateEvent(mockUserId, 'event-123', mockEvent, 'old-etag');

      // Verify
      expect(result).toEqual({
        eventId: 'event-123',
        etag: 'new-etag-123',
      });

      expect(mockCalendarClient.events.update).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event-123',
        requestBody: {
          ...mockEvent,
          start: {
            ...mockEvent.start,
            timeZone: 'Asia/Bangkok',
          },
          end: {
            ...mockEvent.end,
            timeZone: 'Asia/Bangkok',
          },
        },
        headers: {
          'If-Match': 'old-etag',
        },
      });
    });

    it('should handle ETag mismatch (412 error)', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(mockCalendarAccount);
      mockCalendarClient.events.update.mockRejectedValue({
        code: 412,
        message: 'Precondition failed',
      });

      // Execute & Verify
      await expect(
        service.updateEvent(mockUserId, 'event-123', mockEvent, 'old-etag'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteEvent', () => {
    it('should delete an event successfully', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(mockCalendarAccount);
      mockCalendarClient.events.delete.mockResolvedValue({});

      // Execute
      await service.deleteEvent(mockUserId, 'event-123');

      // Verify
      expect(mockCalendarClient.events.delete).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event-123',
      });
    });

    it('should handle event not found (404) gracefully', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(mockCalendarAccount);
      mockCalendarClient.events.delete.mockRejectedValue({
        code: 404,
        message: 'Not found',
      });

      // Execute - should not throw
      await expect(service.deleteEvent(mockUserId, 'event-123')).resolves.toBeUndefined();
    });
  });

  describe('token refresh', () => {
    it('should refresh tokens when they are about to expire', async () => {
      // Setup - token expires in 2 minutes
      const expiringSoonAccount = {
        ...mockCalendarAccount,
        tokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
      };

      calendarAccountRepository.findOne.mockResolvedValue(expiringSoonAccount);
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: 'new-access-token',
          expiry_date: Date.now() + 3600 * 1000,
        },
      });

      mockCalendarClient.events.insert.mockResolvedValue({
        data: {
          id: 'event-123',
          etag: 'etag-123',
        },
      });

      const mockEvent: GoogleCalendarEvent = {
        summary: 'Test Event',
        start: {
          dateTime: '2024-01-15T09:00:00',
          timeZone: 'Asia/Bangkok',
        },
        end: {
          dateTime: '2024-01-15T10:00:00',
          timeZone: 'Asia/Bangkok',
        },
      };

      // Execute
      await service.createEvent(mockUserId, mockEvent);

      // Verify
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(calendarAccountRepository.update).toHaveBeenCalledWith(
        expiringSoonAccount.id,
        expect.objectContaining({
          accessTokenEnc: JSON.stringify({
            data: 'new-encrypted-token',
            iv: 'new-iv',
            tag: 'new-tag',
            keyVersion: 1,
          }),
          tokenExpiresAt: expect.any(Date),
        }),
      );
    });

    it('should handle token refresh failure', async () => {
      // Setup
      const expiredAccount = {
        ...mockCalendarAccount,
        tokenExpiresAt: new Date(Date.now() - 1000), // Already expired
      };

      calendarAccountRepository.findOne.mockResolvedValue(expiredAccount);
      mockOAuth2Client.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

      const mockEvent: GoogleCalendarEvent = {
        summary: 'Test Event',
        start: {
          dateTime: '2024-01-15T09:00:00',
          timeZone: 'Asia/Bangkok',
        },
        end: {
          dateTime: '2024-01-15T10:00:00',
          timeZone: 'Asia/Bangkok',
        },
      };

      // Execute & Verify
      await expect(service.createEvent(mockUserId, mockEvent)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('batchCreateEvents', () => {
    it('should batch create multiple events', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(mockCalendarAccount);

      const events = [
        {
          localEventId: 'local-1',
          event: {
            summary: 'Event 1',
            start: { dateTime: '2024-01-15T09:00:00', timeZone: 'Asia/Bangkok' },
            end: { dateTime: '2024-01-15T10:00:00', timeZone: 'Asia/Bangkok' },
          },
        },
        {
          localEventId: 'local-2',
          event: {
            summary: 'Event 2',
            start: { dateTime: '2024-01-15T11:00:00', timeZone: 'Asia/Bangkok' },
            end: { dateTime: '2024-01-15T12:00:00', timeZone: 'Asia/Bangkok' },
          },
        },
      ];

      mockCalendarClient.events.insert
        .mockResolvedValueOnce({
          data: { id: 'google-1', etag: 'etag-1' },
        })
        .mockResolvedValueOnce({
          data: { id: 'google-2', etag: 'etag-2' },
        });

      // Execute
      const result = await service.batchCreateEvents(mockUserId, events);

      // Verify
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0]).toEqual({
        localEventId: 'local-1',
        googleEventId: 'google-1',
        etag: 'etag-1',
      });
    });

    it('should handle partial failures in batch operations', async () => {
      // Setup
      calendarAccountRepository.findOne.mockResolvedValue(mockCalendarAccount);

      const events = [
        {
          localEventId: 'local-1',
          event: {
            summary: 'Event 1',
            start: { dateTime: '2024-01-15T09:00:00', timeZone: 'Asia/Bangkok' },
            end: { dateTime: '2024-01-15T10:00:00', timeZone: 'Asia/Bangkok' },
          },
        },
        {
          localEventId: 'local-2',
          event: {
            summary: 'Event 2',
            start: { dateTime: '2024-01-15T11:00:00', timeZone: 'Asia/Bangkok' },
            end: { dateTime: '2024-01-15T12:00:00', timeZone: 'Asia/Bangkok' },
          },
        },
      ];

      mockCalendarClient.events.insert
        .mockResolvedValueOnce({
          data: { id: 'google-1', etag: 'etag-1' },
        })
        .mockRejectedValueOnce({
          code: 400,
          message: 'Invalid event data',
        });

      // Execute
      const result = await service.batchCreateEvents(mockUserId, events);

      // Verify
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].localEventId).toBe('local-2');
      expect(result.failed[0].error).toContain('Google Calendar API error');
    });
  });

  describe('getQuotaInfo', () => {
    it('should return quota information', async () => {
      // Execute
      const result = await service.getQuotaInfo(mockUserId);

      // Verify
      expect(result).toEqual({
        remaining: 3000,
        resetTime: expect.any(Date),
        dailyLimit: 3000,
      });
    });
  });
});