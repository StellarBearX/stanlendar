import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { DataSource } from 'typeorm'
import { AuthService } from '../src/modules/auth/auth.service'

describe('Subjects (e2e)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let authService: AuthService
  let accessToken: string
  let userId: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    dataSource = moduleFixture.get<DataSource>(DataSource)
    authService = moduleFixture.get<AuthService>(AuthService)
    
    await app.init()

    // Create test user and get auth token
    const user = await createTestUser()
    userId = user.id
    const tokens = await authService.generateTokens(user)
    accessToken = tokens.accessToken
  })

  beforeEach(async () => {
    // Clean subjects and related data
    await dataSource.query('DELETE FROM local_event WHERE user_id = $1', [userId])
    await dataSource.query('DELETE FROM section WHERE subject_id IN (SELECT id FROM subject WHERE user_id = $1)', [userId])
    await dataSource.query('DELETE FROM subject WHERE user_id = $1', [userId])
  })

  afterAll(async () => {
    await dataSource.destroy()
    await app.close()
  })

  async function createTestUser() {
    const user = dataSource.getRepository('User').create({
      email: 'test@example.com',
      displayName: 'Test User',
    })
    return await dataSource.getRepository('User').save(user)
  }

  describe('/subjects (GET)', () => {
    it('should return empty array for new user', async () => {
      const response = await request(app.getHttpServer())
        .get('/subjects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toEqual([])
    })

    it('should return user subjects', async () => {
      // Create test subject
      const subject = await dataSource.getRepository('Subject').save({
        userId,
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#3B82F6',
      })

      const response = await request(app.getHttpServer())
        .get('/subjects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toHaveLength(1)
      expect(response.body[0]).toMatchObject({
        id: subject.id,
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#3B82F6',
      })
    })

    it('should not return other users subjects', async () => {
      // Create another user's subject
      const otherUser = await dataSource.getRepository('User').save({
        email: 'other@example.com',
        displayName: 'Other User',
      })

      await dataSource.getRepository('Subject').save({
        userId: otherUser.id,
        code: 'MATH101',
        name: 'Mathematics',
        colorHex: '#EF4444',
      })

      const response = await request(app.getHttpServer())
        .get('/subjects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(response.body).toEqual([])
    })
  })

  describe('/subjects (POST)', () => {
    it('should create new subject', async () => {
      const subjectData = {
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#3B82F6',
        meta: { faculty: 'Engineering' },
      }

      const response = await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(subjectData)
        .expect(201)

      expect(response.body).toMatchObject(subjectData)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('createdAt')

      // Verify in database
      const saved = await dataSource.getRepository('Subject').findOne({
        where: { id: response.body.id },
      })
      expect(saved).toBeTruthy()
      expect(saved.userId).toBe(userId)
    })

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          // Missing required fields
          code: 'CS101',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('name')
          expect(res.body.message).toContain('colorHex')
        })
    })

    it('should validate color format', async () => {
      await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          code: 'CS101',
          name: 'Computer Science',
          colorHex: 'invalid-color',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('colorHex')
        })
    })

    it('should enforce unique constraint', async () => {
      const subjectData = {
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#3B82F6',
      }

      // Create first subject
      await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(subjectData)
        .expect(201)

      // Try to create duplicate
      await request(app.getHttpServer())
        .post('/subjects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(subjectData)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('already exists')
        })
    })
  })

  describe('/subjects/:id (PUT)', () => {
    let subjectId: string

    beforeEach(async () => {
      const subject = await dataSource.getRepository('Subject').save({
        userId,
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#3B82F6',
      })
      subjectId = subject.id
    })

    it('should update subject', async () => {
      const updateData = {
        name: 'Advanced Computer Science',
        colorHex: '#EF4444',
        meta: { level: 'Advanced' },
      }

      const response = await request(app.getHttpServer())
        .put(`/subjects/${subjectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toMatchObject(updateData)
      expect(response.body.code).toBe('CS101') // Should preserve unchanged fields
    })

    it('should not update other users subject', async () => {
      const otherUser = await dataSource.getRepository('User').save({
        email: 'other@example.com',
        displayName: 'Other User',
      })

      const otherSubject = await dataSource.getRepository('Subject').save({
        userId: otherUser.id,
        code: 'MATH101',
        name: 'Mathematics',
        colorHex: '#EF4444',
      })

      await request(app.getHttpServer())
        .put(`/subjects/${otherSubject.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Hacked Math' })
        .expect(404)
    })

    it('should return 404 for non-existent subject', async () => {
      await request(app.getHttpServer())
        .put('/subjects/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(404)
    })
  })

  describe('/subjects/:id (DELETE)', () => {
    let subjectId: string

    beforeEach(async () => {
      const subject = await dataSource.getRepository('Subject').save({
        userId,
        code: 'CS101',
        name: 'Computer Science',
        colorHex: '#3B82F6',
      })
      subjectId = subject.id
    })

    it('should delete subject', async () => {
      await request(app.getHttpServer())
        .delete(`/subjects/${subjectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      // Verify deletion
      const deleted = await dataSource.getRepository('Subject').findOne({
        where: { id: subjectId },
      })
      expect(deleted).toBeNull()
    })

    it('should cascade delete sections and events', async () => {
      // Create section and event
      const section = await dataSource.getRepository('Section').save({
        subjectId,
        secCode: '001',
        teacher: 'Dr. Smith',
        room: 'Room 101',
        scheduleRules: { days: ['MO'], startTime: '09:00', endTime: '10:30' },
      })

      await dataSource.getRepository('LocalEvent').save({
        userId,
        subjectId,
        sectionId: section.id,
        eventDate: new Date('2024-01-15'),
        startTime: '09:00',
        endTime: '10:30',
        room: 'Room 101',
        status: 'planned',
      })

      await request(app.getHttpServer())
        .delete(`/subjects/${subjectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      // Verify cascade deletion
      const sectionCount = await dataSource.getRepository('Section').count({
        where: { subjectId },
      })
      const eventCount = await dataSource.getRepository('LocalEvent').count({
        where: { subjectId },
      })

      expect(sectionCount).toBe(0)
      expect(eventCount).toBe(0)
    })
  })

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/subjects' },
        { method: 'post', path: '/subjects' },
        { method: 'put', path: '/subjects/test-id' },
        { method: 'delete', path: '/subjects/test-id' },
      ]

      for (const endpoint of endpoints) {
        await request(app.getHttpServer())
          [endpoint.method](endpoint.path)
          .expect(401)
      }
    })
  })
})