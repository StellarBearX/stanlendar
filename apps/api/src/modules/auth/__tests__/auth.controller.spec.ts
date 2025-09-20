import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    lastLoginAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generatePKCEChallenge: jest.fn(),
            validateStateAndGetPKCE: jest.fn(),
            generateTokens: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn(),
            getGoogleTokens: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    // Mock environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.API_BASE_URL = 'http://localhost:3001';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiateGoogleAuth', () => {
    it('should return Google auth URL with PKCE parameters', async () => {
      const mockPKCE = {
        codeVerifier: 'test-verifier',
        codeChallenge: 'test-challenge',
        codeChallengeMethod: 'S256' as const,
        state: 'test-state',
      };

      jest.spyOn(authService, 'generatePKCEChallenge').mockReturnValue(mockPKCE);

      const result = await controller.initiateGoogleAuth();

      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state', 'test-state');
      expect(result.authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(result.authUrl).toContain('code_challenge=test-challenge');
      expect(result.authUrl).toContain('code_challenge_method=S256');
      expect(result.authUrl).toContain('state=test-state');
    });
  });

  describe('googleCallback', () => {
    const mockRequest = {
      user: { user: mockUser },
    };
    const mockResponse = {
      redirect: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should redirect to frontend with tokens on success', async () => {
      jest.spyOn(authService, 'validateStateAndGetPKCE').mockReturnValue({
        state: 'test-state',
        codeVerifier: 'test-verifier',
        redirectUri: 'http://localhost:3000/auth/callback',
      });
      jest.spyOn(authService, 'generateTokens').mockResolvedValue(mockTokens);

      await controller.googleCallback(
        mockRequest as any,
        mockResponse as any,
        'test-state',
        'auth-code',
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3000/auth/callback')
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('access_token=access-token-123')
      );
    });

    it('should redirect to error page on OAuth error', async () => {
      await controller.googleCallback(
        mockRequest as any,
        mockResponse as any,
        'test-state',
        'auth-code',
        'access_denied',
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/error?error=access_denied'
      );
    });

    it('should redirect to error page on missing parameters', async () => {
      await controller.googleCallback(
        mockRequest as any,
        mockResponse as any,
        '', // missing state
        'auth-code',
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/error?error=missing_parameters'
      );
    });

    it('should redirect to error page on validation failure', async () => {
      jest.spyOn(authService, 'validateStateAndGetPKCE').mockImplementation(() => {
        throw new Error('Invalid state');
      });

      await controller.googleCallback(
        mockRequest as any,
        mockResponse as any,
        'invalid-state',
        'auth-code',
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/error?error=oauth_failed'
      );
    });
  });

  describe('refreshToken', () => {
    it('should return new tokens for valid refresh token', async () => {
      jest.spyOn(authService, 'refreshToken').mockResolvedValue(mockTokens);

      const result = await controller.refreshToken('valid-refresh-token');

      expect(result).toEqual({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
      });
    });

    it('should throw BadRequestException for missing refresh token', async () => {
      await expect(controller.refreshToken('')).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jest.spyOn(authService, 'refreshToken').mockRejectedValue(new Error('Invalid token'));

      await expect(controller.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const mockRequest = { user: mockUser };
      jest.spyOn(authService, 'logout').mockResolvedValue();

      const result = await controller.logout(mockRequest as any);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(authService.logout).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const mockRequest = { user: mockUser };

      const result = await controller.getProfile(mockRequest as any);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        lastLoginAt: mockUser.lastLoginAt,
      });
    });
  });

  describe('getGoogleStatus', () => {
    it('should return connected status when tokens exist', async () => {
      const mockRequest = { user: mockUser };
      const mockGoogleTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
      };

      jest.spyOn(authService, 'getGoogleTokens').mockResolvedValue(mockGoogleTokens);

      const result = await controller.getGoogleStatus(mockRequest as any);

      expect(result).toEqual({
        connected: true,
        tokenExpired: false,
      });
    });

    it('should return not connected when no tokens exist', async () => {
      const mockRequest = { user: mockUser };
      jest.spyOn(authService, 'getGoogleTokens').mockResolvedValue(null);

      const result = await controller.getGoogleStatus(mockRequest as any);

      expect(result).toEqual({
        connected: false,
        tokenExpired: false,
      });
    });

    it('should return token expired when tokens are expired', async () => {
      const mockRequest = { user: mockUser };
      const expiredTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      };

      jest.spyOn(authService, 'getGoogleTokens').mockResolvedValue(expiredTokens);

      const result = await controller.getGoogleStatus(mockRequest as any);

      expect(result).toEqual({
        connected: true,
        tokenExpired: true,
      });
    });
  });
});