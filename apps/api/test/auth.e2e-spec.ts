import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { DataSource } from 'typeorm'
import { User } from '../src/infra/database/entities/user.entity'
import { CalendarAccount } from '../src/infra/database/entities/calendar-account.entity'

describe('Authentication (e2e)', () => {
  let app: INestApplication
  let dataSource: DataSource

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    dataSource = moduleFixture.get<DataSource>(DataSource)
    
    await app.init()
  })

  beforeEach(async () => {
    // Clean database before each test
    await dataSource.query('DELETE FROM calendar_account')
    await dataSource.query('DELETE FROM "user"')
  })

  afterAll(async () => {
    await dataSource.destroy()
    await app.close()
  })

  describe('/auth/google/url (GET)', () => {
    it('should generate OAuth URL with PKCE parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/google/url')
        .expect(200)

      expect(response.body).toHaveProperty('url')
      expect(response.body).toHaveProperty('state')
      expect(response.body).toHaveProperty('codeVerifier')
      
      const url = new URL(response.body.url)
      expect(url.hostname).toBe('accounts.google.com')
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      expect(url.searchParams.get('code_challenge')).toBeTruthy()
      expect(url.searchParams.get('state')).toBe(response.body.state)
    })
  })

  describe('/auth/google/callback (POST)', () => {
    it('should authenticate user with valid OAuth code', async () => {
      // First get OAuth URL to generate state
      const urlResponse = await request(app.getHttpServer())
        .get('/auth/google/url')
        .expect(200)

      // Mock Google OAuth token exchange
      const mockGoogleResponse = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        id_token: 'mock-id-token',
      }

      // Mock Google user info
      const mockUserInfo = {
        id: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
      }

      // This would normally be mocked at the service level
      const response = await request(app.getHttpServer())
        .post('/auth/google/callback')
        .send({
          code: 'mock-auth-code',
          state: urlResponse.body.state,
          codeVerifier: urlResponse.body.codeVerifier,
        })
        .expect(201)

      expect(response.body).toHaveProperty('user')
      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('refreshToken')
      expect(response.body.user.email).toBe('test@example.com')
    })

    it('should reject invalid state parameter', async () => {
      await request(app.getHttpServer())
        .post('/auth/google/callback')
        .send({
          code: 'mock-auth-code',
          state: 'invalid-state',
          codeVerifier: 'test-verifier',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid or expired state')
        })
    })

    it('should reject missing required parameters', async () => {
      await request(app.getHttpServer())
        .post('/auth/google/callback')
        .send({
          code: 'mock-auth-code',
          // Missing state and codeVerifier
        })
        .expect(400)
    })
  })

  describe('/auth/refresh (POST)', () => {
    let refreshToken: string

    beforeEach(async () => {
      // Create a user and get tokens first
      const urlResponse = await request(app.getHttpServer())
        .get('/auth/google/url')

      const authResponse = await request(app.getHttpServer())
        .post('/auth/google/callback')
        .send({
          code: 'mock-auth-code',
          state: urlResponse.body.state,
          codeVerifier: urlResponse.body.codeVerifier,
        })

      refreshToken = authResponse.body.refreshToken
    })

    it('should generate new tokens with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(201)

      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('refreshToken')
      expect(response.body.refreshToken).not.toBe(refreshToken) // Should rotate
    })

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401)
    })
  })

  describe('/auth/me (GET)', () => {
    let accessToken: string

    beforeEach(async () => {
      // Create authenticated user
      const urlResponse = await request(app.getHttpServer())
        .get('/auth/google/url')

      const authResponse = await request(app.getHttpServer())
        .post('/auth/google/callback')
        .send({
          code: 'mock-auth-code',
          state: urlResponse.body.state,
          codeVerifier: urlResponse.body.codeVerifier,
        })

      accessToken = authResponse.body.accessToken
    })

    it('should return user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('email')
      expect(response.body).toHaveProperty('displayName')
    })

    it('should reject request without token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401)
    })

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
    })
  })

  describe('/auth/logout (POST)', () => {
    let accessToken: string
    let refreshToken: string

    beforeEach(async () => {
      // Create authenticated user
      const urlResponse = await request(app.getHttpServer())
        .get('/auth/google/url')

      const authResponse = await request(app.getHttpServer())
        .post('/auth/google/callback')
        .send({
          code: 'mock-auth-code',
          state: urlResponse.body.state,
          codeVerifier: urlResponse.body.codeVerifier,
        })

      accessToken = authResponse.body.accessToken
      refreshToken = authResponse.body.refreshToken
    })

    it('should invalidate tokens on logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200)

      // Verify tokens are invalidated
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401)

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401)
    })
  })
})