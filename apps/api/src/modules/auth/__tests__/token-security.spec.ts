import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';
import { CryptoService } from '../crypto.service';
import { User } from '../../../infra/database/entities/user.entity';
import { CalendarAccount } from '../../../infra/database/entities/calendar-account.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService - Token Security', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    lastLoginAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CalendarAccount),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-value'),
          },
        },
        {
          provide: CryptoService,
          useValue: {
            generateCodeVerifier: jest.fn(),
            generateCodeChallenge: jest.fn(),
            generateState: jest.fn(),
            encryptToken: jest.fn(),
            decryptToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('Refresh Token Rotation', () => {
    it('should generate new tokens with same family on refresh', async () => {
      const originalRefreshToken = 'original-refresh-token';
      const originalPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'refresh',
        family: 'token-family-123',
        version: 1000,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-id',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(originalPayload);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      // Simulate storing the original refresh token
      (service as any).refreshTokens.set(originalRefreshToken, {
        userId: 'user-123',
        tokenFamily: 'token-family-123',
        version: 1000,
        createdAt: new Date(),
      });

      const result = await service.refreshToken(originalRefreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      // Original token should be removed
      expect((service as any).refreshTokens.has(originalRefreshToken)).toBe(false);
    });

    it('should detect refresh token reuse and revoke token family', async () => {
      const reusedRefreshToken = 'reused-refresh-token';
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'refresh',
        family: 'token-family-123',
        version: 1000,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-id',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);

      // Don't store the token to simulate reuse
      // (service as any).refreshTokens.set(reusedRefreshToken, ...);

      await expect(service.refreshToken(reusedRefreshToken)).rejects.toThrow(
        'Refresh token reuse detected - all tokens revoked'
      );

      // Token family should be revoked
      expect((service as any).revokedTokenFamilies.has('token-family-123')).toBe(true);
    });

    it('should reject tokens from revoked families', async () => {
      const refreshToken = 'valid-refresh-token';
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'refresh',
        family: 'revoked-family',
        version: 1000,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-id',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);

      // Revoke the token family
      (service as any).revokedTokenFamilies.add('revoked-family');

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        'Token family revoked'
      );
    });
  });

  describe('Token Generation', () => {
    it('should generate tokens with unique JTI and family', async () => {
      const mockTokens = ['access-token-1', 'refresh-token-1'];
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce(mockTokens[0])
        .mockReturnValueOnce(mockTokens[1]);

      const result = await service.generateTokens(mockUser as any);

      expect(result).toEqual({
        accessToken: 'access-token-1',
        refreshToken: 'refresh-token-1',
      });

      // Verify JTI and family are included in token payload
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          email: 'test@example.com',
          jti: expect.any(String),
        })
      );

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          email: 'test@example.com',
          type: 'refresh',
          family: expect.any(String),
          version: expect.any(Number),
        }),
        expect.objectContaining({
          expiresIn: expect.any(String),
        })
      );
    });

    it('should reuse token family when provided', async () => {
      const existingFamily = 'existing-family-123';
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      await service.generateTokens(mockUser as any, existingFamily);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          family: existingFamily,
        }),
        expect.any(Object)
      );
    });
  });

  describe('Logout Security', () => {
    it('should revoke token family on logout with refresh token', async () => {
      const refreshToken = 'logout-refresh-token';
      const payload = {
        sub: 'user-123',
        family: 'logout-family',
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-id',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);
      jest.spyOn(userRepository, 'update').mockResolvedValue(undefined as any);

      await service.logout('user-123', refreshToken);

      expect((service as any).revokedTokenFamilies.has('logout-family')).toBe(true);
      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        lastLoginAt: expect.any(Date),
      });
    });

    it('should logout from all devices by revoking all user token families', async () => {
      const userId = 'user-123';
      
      // Setup multiple token families for the user
      (service as any).refreshTokens.set('token1', {
        userId,
        tokenFamily: 'family1',
        version: 1000,
        createdAt: new Date(),
      });
      
      (service as any).refreshTokens.set('token2', {
        userId,
        tokenFamily: 'family2',
        version: 1001,
        createdAt: new Date(),
      });

      // Add token for different user
      (service as any).refreshTokens.set('token3', {
        userId: 'other-user',
        tokenFamily: 'family3',
        version: 1002,
        createdAt: new Date(),
      });

      jest.spyOn(userRepository, 'update').mockResolvedValue(undefined as any);

      await service.logoutFromAllDevices(userId);

      // User's token families should be revoked
      expect((service as any).revokedTokenFamilies.has('family1')).toBe(true);
      expect((service as any).revokedTokenFamilies.has('family2')).toBe(true);
      
      // Other user's family should not be affected
      expect((service as any).revokedTokenFamilies.has('family3')).toBe(false);
      expect((service as any).refreshTokens.has('token3')).toBe(true);
    });
  });

  describe('Token Validation', () => {
    it('should reject non-refresh tokens in refresh endpoint', async () => {
      const accessToken = 'access-token';
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access', // Wrong type
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-id',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(payload);

      await expect(service.refreshToken(accessToken)).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should handle JWT verification errors gracefully', async () => {
      const invalidToken = 'invalid-token';
      
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('JWT verification failed');
      });

      await expect(service.refreshToken(invalidToken)).rejects.toThrow(
        'Invalid refresh token'
      );
    });
  });
});