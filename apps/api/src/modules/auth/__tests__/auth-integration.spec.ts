import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { AuthModule } from '../auth.module';
import { User } from '../../../infra/database/entities/user.entity';
import { CalendarAccount } from '../../../infra/database/entities/calendar-account.entity';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';

describe('Auth Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let jwtService: JwtService;
  let userRepository: Repository<User>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    lastLoginAt: new Date(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        CryptoService,
        JwtAuthGuard,
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
                case 'JWT_SECRET':
                  return 'test-jwt-secret';
                case 'ENCRYPTION_KEY':
                  return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
                case 'GOOGLE_CLIENT_ID':
                  return 'test-client-id';
                case 'GOOGLE_CLIENT_SECRET':
                  return 'test-client-secret';
                case 'API_BASE_URL':
                  return 'http://localhost:3001';
                case 'FRONTEND_URL':
                  return 'http://localhost:3000';
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      // Generate initial tokens
      const tokens = await authService.generateTokens(mockUser as any);
      
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: tokens.refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.access_token).not.toBe(tokens.accessToken);
      expect(response.body.refresh_token).not.toBe(tokens.refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);

      expect(response.body.message).toBe('Invalid refresh token');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Refresh token is required');
    });
  });

  describe('GET /auth/google/init', () => {
    it('should return Google OAuth URL with PKCE parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/google/init')
        .expect(200);

      expect(response.body).toHaveProperty('authUrl');
      expect(response.body).toHaveProperty('state');
      expect(response.body.authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(response.body.authUrl).toContain('code_challenge=');
      expect(response.body.authUrl).toContain('code_challenge_method=S256');
      expect(response.body.authUrl).toContain('state=');
    });
  });

  describe('Protected Routes', () => {
    let validAccessToken: string;

    beforeEach(async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      
      const tokens = await authService.generateTokens(mockUser as any);
      validAccessToken = tokens.accessToken;
    });

    describe('GET /auth/me', () => {
      it('should return user profile with valid token', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(200);

        expect(response.body).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          displayName: mockUser.displayName,
          lastLoginAt: mockUser.lastLoginAt.toISOString(),
        });
      });

      it('should reject request without token', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .expect(401);

        expect(response.body.message).toBe('Invalid or expired token');
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.message).toBe('Invalid or expired token');
      });
    });

    describe('POST /auth/logout', () => {
      it('should logout successfully with valid token', async () => {
        jest.spyOn(userRepository, 'update').mockResolvedValue(undefined as any);

        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(200);

        expect(response.body.message).toBe('Logged out successfully');
      });

      it('should logout with refresh token', async () => {
        jest.spyOn(userRepository, 'update').mockResolvedValue(undefined as any);
        const tokens = await authService.generateTokens(mockUser as any);

        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .send({ refresh_token: tokens.refreshToken })
          .expect(200);

        expect(response.body.message).toBe('Logged out successfully');
      });
    });

    describe('POST /auth/logout-all', () => {
      it('should logout from all devices', async () => {
        jest.spyOn(userRepository, 'update').mockResolvedValue(undefined as any);

        const response = await request(app.getHttpServer())
          .post('/auth/logout-all')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(200);

        expect(response.body.message).toBe('Logged out from all devices successfully');
      });
    });

    describe('GET /auth/google/status', () => {
      it('should return Google connection status', async () => {
        jest.spyOn(authService, 'getGoogleTokens').mockResolvedValue(null);

        const response = await request(app.getHttpServer())
          .get('/auth/google/status')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(200);

        expect(response.body).toEqual({
          connected: false,
          tokenExpired: false,
        });
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple requests within limits', async () => {
      // This test would require actual Redis setup
      // For now, we'll just verify the endpoint works
      const promises = Array(5).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/auth/google/init')
          .expect(200)
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.body).toHaveProperty('authUrl');
      });
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/google/init')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
});