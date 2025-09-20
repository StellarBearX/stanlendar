import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../infra/database/entities/user.entity';
import { CalendarAccount } from '../../infra/database/entities/calendar-account.entity';
import { CryptoService } from './crypto.service';
import { 
  GoogleProfile, 
  AuthResult, 
  TokenResult, 
  GoogleTokens,
  PKCEChallenge,
  OAuthState 
} from './interfaces/auth.interface';
import { JwtPayload } from './strategies/jwt.strategy';
import * as crypto from 'crypto';

interface RefreshTokenData {
  userId: string;
  tokenFamily: string;
  version: number;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly refreshTokenTTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly oauthStates = new Map<string, OAuthState>(); // In production, use Redis
  private readonly refreshTokens = new Map<string, RefreshTokenData>(); // In production, use Redis
  private readonly revokedTokenFamilies = new Set<string>(); // In production, use Redis

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CalendarAccount)
    private calendarAccountRepository: Repository<CalendarAccount>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private cryptoService: CryptoService,
  ) {}

  /**
   * Generates PKCE challenge and state for OAuth flow
   */
  generatePKCEChallenge(): PKCEChallenge & { state: string } {
    const codeVerifier = this.cryptoService.generateCodeVerifier();
    const codeChallenge = this.cryptoService.generateCodeChallenge(codeVerifier);
    const state = this.cryptoService.generateState();

    // Store state temporarily (in production, use Redis with TTL)
    this.oauthStates.set(state, {
      state,
      codeVerifier,
      redirectUri: `${this.configService.get('FRONTEND_URL')}/auth/callback`,
    });

    // Clean up old states (simple cleanup, in production use Redis TTL)
    setTimeout(() => this.oauthStates.delete(state), 10 * 60 * 1000); // 10 minutes

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
      state,
    };
  }

  /**
   * Validates state parameter and retrieves PKCE data
   */
  validateStateAndGetPKCE(state: string): OAuthState {
    const oauthState = this.oauthStates.get(state);
    if (!oauthState) {
      throw new BadRequestException('Invalid or expired state parameter');
    }

    // Remove state after use (one-time use)
    this.oauthStates.delete(state);
    return oauthState;
  }

  /**
   * Validates Google user and creates/updates user record
   */
  async validateGoogleUser(profile: GoogleProfile, tokens: GoogleTokens): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { email: profile.email },
      relations: ['calendarAccounts'],
    });

    if (!user) {
      // Create new user
      user = this.userRepository.create({
        email: profile.email,
        displayName: profile.displayName,
        lastLoginAt: new Date(),
      });
      user = await this.userRepository.save(user);
    } else {
      // Update last login
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);
    }

    // Create or update calendar account
    await this.createOrUpdateCalendarAccount(user.id, profile.id, tokens);

    return user;
  }

  /**
   * Creates or updates Google calendar account with encrypted tokens
   */
  private async createOrUpdateCalendarAccount(
    userId: string,
    googleSub: string,
    tokens: GoogleTokens,
  ): Promise<CalendarAccount> {
    const encryptedAccessToken = this.cryptoService.encryptToken(tokens.accessToken, userId);
    const encryptedRefreshToken = this.cryptoService.encryptToken(tokens.refreshToken, userId);

    let calendarAccount = await this.calendarAccountRepository.findOne({
      where: { userId, provider: 'google', googleSub },
    });

    if (calendarAccount) {
      // Update existing account
      calendarAccount.accessTokenEnc = JSON.stringify(encryptedAccessToken);
      calendarAccount.refreshTokenEnc = JSON.stringify(encryptedRefreshToken);
      calendarAccount.tokenExpiresAt = tokens.expiresAt;
      calendarAccount.updatedAt = new Date();
    } else {
      // Create new account
      calendarAccount = this.calendarAccountRepository.create({
        userId,
        provider: 'google',
        googleSub,
        accessTokenEnc: JSON.stringify(encryptedAccessToken),
        refreshTokenEnc: JSON.stringify(encryptedRefreshToken),
        tokenExpiresAt: tokens.expiresAt,
      });
    }

    return await this.calendarAccountRepository.save(calendarAccount);
  }

  /**
   * Generates JWT access and refresh tokens with rotation
   */
  async generateTokens(user: User, tokenFamily?: string): Promise<TokenResult> {
    const jwtId = crypto.randomUUID();
    const family = tokenFamily || crypto.randomUUID();
    
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      jti: jwtId,
    };

    const accessToken = this.jwtService.sign(payload);
    
    // Generate refresh token with family tracking for rotation
    const refreshPayload = {
      ...payload,
      type: 'refresh',
      family,
      version: Date.now(), // Use timestamp as version for uniqueness
    };
    
    const refreshToken = this.jwtService.sign(
      refreshPayload,
      { expiresIn: `${this.refreshTokenTTL}s` }
    );

    // Store refresh token data for reuse detection
    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      tokenFamily: family,
      version: refreshPayload.version,
      createdAt: new Date(),
    });

    // Clean up old tokens for this family (keep only latest)
    this.cleanupOldRefreshTokens(family, refreshPayload.version);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Cleans up old refresh tokens for a token family
   */
  private cleanupOldRefreshTokens(family: string, currentVersion: number): void {
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.tokenFamily === family && data.version < currentVersion) {
        this.refreshTokens.delete(token);
      }
    }
  }

  /**
   * Validates JWT payload and returns user
   */
  async validateJwtPayload(payload: JwtPayload): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      return null;
    }

    // Additional validation can be added here (e.g., check if token is revoked)
    return user;
  }

  /**
   * Refreshes access token using refresh token with reuse detection
   */
  async refreshToken(refreshToken: string): Promise<TokenResult> {
    try {
      const payload = this.jwtService.verify(refreshToken) as JwtPayload & { 
        type: string; 
        family: string; 
        version: number; 
      };
      
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token family is revoked
      if (this.revokedTokenFamilies.has(payload.family)) {
        throw new UnauthorizedException('Token family revoked');
      }

      // Check for refresh token reuse
      const storedTokenData = this.refreshTokens.get(refreshToken);
      if (!storedTokenData) {
        // Token reuse detected - revoke entire token family
        this.revokedTokenFamilies.add(payload.family);
        this.revokeTokenFamily(payload.family);
        throw new UnauthorizedException('Refresh token reuse detected - all tokens revoked');
      }

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Remove used refresh token
      this.refreshTokens.delete(refreshToken);

      // Generate new tokens with same family (refresh token rotation)
      return await this.generateTokens(user, payload.family);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Revokes all tokens in a token family
   */
  private revokeTokenFamily(family: string): void {
    // Remove all refresh tokens for this family
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.tokenFamily === family) {
        this.refreshTokens.delete(token);
      }
    }
    
    // Add family to revoked list
    this.revokedTokenFamilies.add(family);
  }

  /**
   * Logs out user by invalidating tokens
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      try {
        const payload = this.jwtService.verify(refreshToken) as JwtPayload & { 
          family: string; 
        };
        
        // Revoke the entire token family
        this.revokeTokenFamily(payload.family);
      } catch (error) {
        // Token might be invalid, but we still want to logout
        console.warn('Invalid refresh token during logout:', error.message);
      }
    }
    
    // Update last login to track logout
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  /**
   * Logs out user from all devices by revoking all token families
   */
  async logoutFromAllDevices(userId: string): Promise<void> {
    // Find all token families for this user and revoke them
    const userTokenFamilies = new Set<string>();
    
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.userId === userId) {
        userTokenFamilies.add(data.tokenFamily);
      }
    }
    
    // Revoke all families
    for (const family of userTokenFamilies) {
      this.revokeTokenFamily(family);
    }
    
    // Update last login
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  /**
   * Gets decrypted Google tokens for a user
   */
  async getGoogleTokens(userId: string): Promise<GoogleTokens | null> {
    const calendarAccount = await this.calendarAccountRepository.findOne({
      where: { userId, provider: 'google' },
    });

    if (!calendarAccount) {
      return null;
    }

    try {
      const encryptedAccessToken = JSON.parse(calendarAccount.accessTokenEnc);
      const encryptedRefreshToken = JSON.parse(calendarAccount.refreshTokenEnc);

      const accessToken = this.cryptoService.decryptToken(encryptedAccessToken, userId);
      const refreshToken = this.cryptoService.decryptToken(encryptedRefreshToken, userId);

      return {
        accessToken,
        refreshToken,
        expiresAt: calendarAccount.tokenExpiresAt,
      };
    } catch (error) {
      // Token decryption failed, account may be corrupted
      return null;
    }
  }

  /**
   * Updates Google tokens after refresh
   */
  async updateGoogleTokens(userId: string, tokens: GoogleTokens): Promise<void> {
    const calendarAccount = await this.calendarAccountRepository.findOne({
      where: { userId, provider: 'google' },
    });

    if (!calendarAccount) {
      throw new Error('Calendar account not found');
    }

    const encryptedAccessToken = this.cryptoService.encryptToken(tokens.accessToken, userId);
    const encryptedRefreshToken = this.cryptoService.encryptToken(tokens.refreshToken, userId);

    calendarAccount.accessTokenEnc = JSON.stringify(encryptedAccessToken);
    calendarAccount.refreshTokenEnc = JSON.stringify(encryptedRefreshToken);
    calendarAccount.tokenExpiresAt = tokens.expiresAt;
    calendarAccount.updatedAt = new Date();

    await this.calendarAccountRepository.save(calendarAccount);
  }
}