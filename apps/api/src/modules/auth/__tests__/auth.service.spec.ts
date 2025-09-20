import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';
import { CryptoService } from '../crypto.service';
import { User } from '../../../infra/database/entities/user.entity';
import { CalendarAccount } from '../../../infra/database/entities/calendar-account.entity';
import { GoogleProfile, GoogleTokens } from '../interfaces/auth.interface';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let calendarAccountRepository: Repository<CalendarAccount>;
  let jwtService: JwtService;
  let cryptoService: CryptoService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    lastLoginAt: new Date(),
  };

  const mockGoogleProfile: GoogleProfile = {
    id: 'google-123',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  const mockGoogleTokens: GoogleTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CalendarAccount),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
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
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'FRONTEND_URL':
                  return 'http://localhost:3000';
                case 'JWT_SECRET':
                  return 'test-secret';
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: CryptoService,
          useValue: {
            generateCodeVerifier: jest.fn().mockReturnValue('test-verifier'),
            generateCodeChallenge: jest.fn().mockReturnValue('test-challenge'),
            generateState: jest.fn().mockReturnValue('test-state'),
            encryptToken: jest.fn().mockReturnValue({
              data: 'encrypted-data',
              iv: 'test-iv',
              tag: 'test-tag',
              keyVersion: 1,
            }),
            decryptToken: jest.fn().mockReturnValue('decrypted-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    calendarAccountRepository = module.get<Repository<CalendarAccount>>(getRepositoryToken(CalendarAccount));
    jwtService = module.get<JwtService>(JwtService);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePKCEChallenge', () => {
    it('should generate PKCE challenge with state', () => {
      const result = service.generatePKCEChallenge();
      
      expect(result).toHaveProperty('codeVerifier');
      expect(result).toHaveProperty('codeChallenge');
      expect(result).toHaveProperty('codeChallengeMethod', 'S256');
      expect(result).toHaveProperty('state');
      expect(cryptoService.generateCodeVerifier).toHaveBeenCalled();
      expect(cryptoService.generateCodeChallenge).toHaveBeenCalledWith('test-verifier');
      expect(cryptoService.generateState).toHaveBeenCalled();
    });
  });

  describe('validateStateAndGetPKCE', () => {
    it('should validate state and return PKCE data', () => {
      // First generate a challenge to store state
      const challenge = service.generatePKCEChallenge();
      
      // Then validate the state
      const result = service.validateStateAndGetPKCE(challenge.state);
      
      expect(result).toHaveProperty('state', challenge.state);
      expect(result).toHaveProperty('codeVerifier');
      expect(result).toHaveProperty('redirectUri');
    });

    it('should throw error for invalid state', () => {
      expect(() => {
        service.validateStateAndGetPKCE('invalid-state');
      }).toThrow('Invalid or expired state parameter');
    });

    it('should throw error for reused state', () => {
      const challenge = service.generatePKCEChallenge();
      
      // First use should work
      service.validateStateAndGetPKCE(challenge.state);
      
      // Second use should fail
      expect(() => {
        service.validateStateAndGetPKCE(challenge.state);
      }).toThrow('Invalid or expired state parameter');
    });
  });

  describe('validateGoogleUser', () => {
    it('should create new user if not exists', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);
      jest.spyOn(calendarAccountRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(calendarAccountRepository, 'create').mockReturnValue({} as any);
      jest.spyOn(calendarAccountRepository, 'save').mockResolvedValue({} as any);

      const result = await service.validateGoogleUser(mockGoogleProfile, mockGoogleTokens);

      expect(userRepository.create).toHaveBeenCalledWith({
        email: mockGoogleProfile.email,
        displayName: mockGoogleProfile.displayName,
        lastLoginAt: expect.any(Date),
      });
      expect(result).toEqual(mockUser);
    });

    it('should update existing user login time', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as any);
      jest.spyOn(calendarAccountRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(calendarAccountRepository, 'create').mockReturnValue({} as any);
      jest.spyOn(calendarAccountRepository, 'save').mockResolvedValue({} as any);

      const result = await service.validateGoogleUser(mockGoogleProfile, mockGoogleTokens);

      expect(userRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        lastLoginAt: expect.any(Date),
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.generateTokens(mockUser as any);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateJwtPayload', () => {
    it('should return user for valid payload', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-id',
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);

      const result = await service.validateJwtPayload(payload);

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: payload.sub },
      });
    });

    it('should return null for invalid user', async () => {
      const payload = {
        sub: 'invalid-user',
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-id',
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const result = await service.validateJwtPayload(payload);

      expect(result).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens for valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const refreshPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'refresh',
        family: 'token-family-123',
        version: 1000,
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-id',
      };

      // Store the refresh token first
      (service as any).refreshTokens.set(refreshToken, {
        userId: 'user-123',
        tokenFamily: 'token-family-123',
        version: 1000,
        createdAt: new Date(),
      });

      jest.spyOn(jwtService, 'verify').mockReturnValue(refreshPayload);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshToken(refreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw error for invalid refresh token type', async () => {
      const invalidPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'access', // Wrong type
        iat: Date.now(),
        exp: Date.now() + 3600,
        jti: 'jwt-id',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(invalidPayload);

      await expect(service.refreshToken('invalid-token')).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('getGoogleTokens', () => {
    it('should return decrypted tokens for valid user', async () => {
      const mockCalendarAccount = {
        accessTokenEnc: JSON.stringify({ data: 'encrypted-access' }),
        refreshTokenEnc: JSON.stringify({ data: 'encrypted-refresh' }),
        tokenExpiresAt: new Date(),
      };

      jest.spyOn(calendarAccountRepository, 'findOne').mockResolvedValue(mockCalendarAccount as any);
      jest.spyOn(cryptoService, 'decryptToken')
        .mockReturnValueOnce('decrypted-access-token')
        .mockReturnValueOnce('decrypted-refresh-token');

      const result = await service.getGoogleTokens('user-123');

      expect(result).toEqual({
        accessToken: 'decrypted-access-token',
        refreshToken: 'decrypted-refresh-token',
        expiresAt: mockCalendarAccount.tokenExpiresAt,
      });
    });

    it('should return null if no calendar account found', async () => {
      jest.spyOn(calendarAccountRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getGoogleTokens('user-123');

      expect(result).toBeNull();
    });
  });
});