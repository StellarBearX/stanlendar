import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { DataSource } from 'typeorm'
import { AuthService } from '../src/modules/auth/auth.service'
import { performance } from 'perf_hooks'

describe('Performance Tests', () => {
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

  afterAll(async () => {
    await dataSource.destroy()
    await app.close()
  })

  async function createTestUser() {
    const user = dataSource.getRepository('User').create({
      email: 'perf-test@example.com',
      displayName: 'Performance Test User',
    })
    return await dataSource.getRepository('User').save(user)
  }

  async function createTestData(subjectCount: number, sectionsPerSubject: number, eventsPerSection: number) {
    const subjects = []
    const sections = []
    const events = []

    // Create subjects
    for (let i = 0; i < subjectCount; i++) {
      const subject = await dataSource.getRepository('Subject').save({
        userId,
        code: `SUBJ${String(i).padStart(3, '0')}`,
        name: `Subject ${i}`,
        colorHex: '#3B82F6',
      })
      subjects.push(subject)

      // Create sections for each subject
      for (let j = 0; j < sectionsPerSubject; j++) {
        const section = await dataSource.getRepository('Section').save({
          subjectId: subject.id,
          secCode: String(j + 1).padStart(3, '0'),
          teacher: `Teacher ${i}-${j}`,
          room: `Room ${i}${j}`,
          scheduleRules: {
            days: ['MO', 'WE', 'FR'],
            startTime: '09:00',
            endTime: '10:30',
            startDate: '2024-01-01',
            endDate: '2024-05-31',
          },
        })
        sections.push(section)

        // Create events for each section
        for (let k = 0; k < eventsPerSection; k++) {
          const eventDate = new Date('2024-01-01')
          eventDate.setDate(eventDate.getDate() + k * 2) // Every other day

          const event = await dataSource.getRepository('LocalEvent').save({
            userId,
            subjectId: subject.id,
            sectionId: section.id,
            eventDate,
            startTime: '09:00',
            endTime: '10:30',
            room: `Room ${i}${j}`,
            status: 'planned',
          })
          events.push(event)
        }
      }
    }

    return { subjects, sections, events }
  }

  describe('Database Query Performance', () => {
    beforeEach(async () => {
      // Clean up before each test
      await dataSource.query('DELETE FROM local_event WHERE user_id = $1', [userId])
      await dataSource.query('DELETE FROM section WHERE subject_id IN (SELECT id FROM subject WHERE user_id = $1)', [userId])
      await dataSource.query('DELETE FROM subject WHERE user_id = $1', [userId])
    })

    it('should handle large dataset queries efficiently', async () => {
      // Create test data: 50 subjects, 3 sections each, 30 events each = 4,500 events
      await createTestData(50, 3, 30)

      const startTime = performance.now()

      const response = await request(app.getHttpServer())
        .get('/events')
        .query({
          from: '2024-01-01',
          to: '2024-05-31',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      const queryTime = performance.now() - startTime

      expect(response.body).toHaveLength(4500)
      expect(queryTime).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle complex filtering queries efficiently', async () => {
      await createTestData(20, 2, 50) // 2,000 events

      const startTime = performance.now()

      const response = await request(app.getHttpServer())
        .get('/spotlight/search')
        .query({
          text: 'Subject 1',
          subjectIds: 'subject-1,subject-2',
          from: '2024-01-01',
          to: '2024-05-31',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      const queryTime = performance.now() - startTime

      expect(queryTime).toBeLessThan(500) // Complex queries should complete within 500ms
    })

    it('should handle concurrent requests efficiently', async () => {
      await createTestData(10, 2, 20) // 400 events

      const concurrentRequests = 10
      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer())
          .get('/events')
          .query({ from: '2024-01-01', to: '2024-05-31' })
          .set('Authorization', `Bearer ${accessToken}`)
      )

      const startTime = performance.now()
      const responses = await Promise.all(requests)
      const totalTime = performance.now() - startTime

      responses.forEach(response => {
        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(400)
      })

      expect(totalTime).toBeLessThan(2000) // All concurrent requests within 2 seconds
    })
  })

  describe('API Endpoint Performance', () => {
    beforeEach(async () => {
      await dataSource.query('DELETE FROM local_event WHERE user_id = $1', [userId])
      await dataSource.query('DELETE FROM section WHERE subject_id IN (SELECT id FROM subject WHERE user_id = $1)', [userId])
      await dataSource.query('DELETE FROM subject WHERE user_id = $1', [userId])
    })

    it('should handle bulk subject creation efficiently', async () => {
      const subjects = Array.from({ length: 100 }, (_, i) => ({
        code: `BULK${String(i).padStart(3, '0')}`,
        name: `Bulk Subject ${i}`,
        colorHex: '#3B82F6',
      }))

      const startTime = performance.now()

      const promises = subjects.map(subject =>
        request(app.getHttpServer())
          .post('/subjects')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(subject)
      )

      const responses = await Promise.all(promises)
      const totalTime = performance.now() - startTime

      responses.forEach(response => {
        expect(response.status).toBe(201)
      })

      expect(totalTime).toBeLessThan(5000) // 100 creations within 5 seconds
    })

    it('should handle large import operations efficiently', async () => {
      // Create CSV data for 500 classes
      const csvData = [
        'Subject Code,Subject Name,Section,Teacher,Room,Days,Start Time,End Time,Start Date,End Date',
        ...Array.from({ length: 500 }, (_, i) => 
          `IMPORT${String(i).padStart(3, '0')},Import Subject ${i},001,Teacher ${i},Room ${i},MO WE FR,09:00,10:30,2024-01-01,2024-05-31`
        )
      ].join('\n')

      const startTime = performance.now()

      // Upload and parse file
      const uploadResponse = await request(app.getHttpServer())
        .post('/import/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from(csvData), 'test.csv')
        .expect(201)

      const jobId = uploadResponse.body.jobId

      // Apply import
      const importResponse = await request(app.getHttpServer())
        .post(`/import/${jobId}/apply`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      const totalTime = performance.now() - startTime

      expect(importResponse.body.summary.created).toBe(500)
      expect(totalTime).toBeLessThan(10000) // Import 500 items within 10 seconds
    })

    it('should handle event generation efficiently', async () => {
      // Create a subject and section
      const subject = await dataSource.getRepository('Subject').save({
        userId,
        code: 'PERF001',
        name: 'Performance Test Subject',
        colorHex: '#3B82F6',
      })

      const section = await dataSource.getRepository('Section').save({
        subjectId: subject.id,
        secCode: '001',
        teacher: 'Performance Teacher',
        room: 'Performance Room',
        scheduleRules: {
          days: ['MO', 'TU', 'WE', 'TH', 'FR'], // 5 days per week
          startTime: '09:00',
          endTime: '10:30',
          startDate: '2024-01-01',
          endDate: '2024-12-31', // Full year
        },
      })

      const startTime = performance.now()

      const response = await request(app.getHttpServer())
        .post('/events/generate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          sectionId: section.id,
          dateRange: {
            from: '2024-01-01',
            to: '2024-12-31',
          },
        })
        .expect(201)

      const generationTime = performance.now() - startTime

      expect(response.body.eventsCreated).toBeGreaterThan(200) // ~260 events for full year
      expect(generationTime).toBeLessThan(3000) // Generate events within 3 seconds
    })
  })

  describe('Memory Usage', () => {
    it('should not leak memory during large operations', async () => {
      const initialMemory = process.memoryUsage()

      // Perform multiple large operations
      for (let i = 0; i < 5; i++) {
        await createTestData(10, 2, 20) // 400 events each iteration

        // Query the data
        await request(app.getHttpServer())
          .get('/events')
          .query({ from: '2024-01-01', to: '2024-05-31' })
          .set('Authorization', `Bearer ${accessToken}`)

        // Clean up
        await dataSource.query('DELETE FROM local_event WHERE user_id = $1', [userId])
        await dataSource.query('DELETE FROM section WHERE subject_id IN (SELECT id FROM subject WHERE user_id = $1)', [userId])
        await dataSource.query('DELETE FROM subject WHERE user_id = $1', [userId])

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('Database Connection Pool', () => {
    it('should handle connection pool efficiently under load', async () => {
      await createTestData(5, 2, 10) // Small dataset

      // Create many concurrent database operations
      const concurrentOperations = 50
      const operations = Array.from({ length: concurrentOperations }, async (_, i) => {
        // Mix of read and write operations
        if (i % 2 === 0) {
          return request(app.getHttpServer())
            .get('/events')
            .set('Authorization', `Bearer ${accessToken}`)
        } else {
          return request(app.getHttpServer())
            .post('/subjects')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              code: `POOL${i}`,
              name: `Pool Test ${i}`,
              colorHex: '#3B82F6',
            })
        }
      })

      const startTime = performance.now()
      const results = await Promise.allSettled(operations)
      const totalTime = performance.now() - startTime

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      expect(successful).toBeGreaterThan(concurrentOperations * 0.9) // At least 90% success
      expect(failed).toBeLessThan(concurrentOperations * 0.1) // Less than 10% failure
      expect(totalTime).toBeLessThan(5000) // Complete within 5 seconds
    })
  })

  describe('Response Time Benchmarks', () => {
    const benchmarks = [
      { endpoint: 'GET /subjects', maxTime: 100 },
      { endpoint: 'GET /events', maxTime: 500 },
      { endpoint: 'POST /subjects', maxTime: 200 },
      { endpoint: 'GET /spotlight/search', maxTime: 300 },
    ]

    beforeEach(async () => {
      await createTestData(10, 2, 20) // Standard test dataset
    })

    benchmarks.forEach(({ endpoint, maxTime }) => {
      it(`should respond to ${endpoint} within ${maxTime}ms`, async () => {
        const [method, path] = endpoint.split(' ')
        
        let requestBuilder = request(app.getHttpServer())[method.toLowerCase()](path)
          .set('Authorization', `Bearer ${accessToken}`)

        if (method === 'POST' && path === '/subjects') {
          requestBuilder = requestBuilder.send({
            code: 'BENCH001',
            name: 'Benchmark Subject',
            colorHex: '#3B82F6',
          })
        }

        if (path === '/spotlight/search') {
          requestBuilder = requestBuilder.query({ text: 'Subject' })
        }

        const startTime = performance.now()
        const response = await requestBuilder
        const responseTime = performance.now() - startTime

        expect(response.status).toBeLessThan(400)
        expect(responseTime).toBeLessThan(maxTime)
      })
    })
  })

  describe('Stress Testing', () => {
    it('should handle sustained high load', async () => {
      await createTestData(20, 3, 25) // 1,500 events

      const duration = 30000 // 30 seconds
      const requestsPerSecond = 10
      const totalRequests = (duration / 1000) * requestsPerSecond

      const startTime = Date.now()
      const results = []
      let requestCount = 0

      while (Date.now() - startTime < duration && requestCount < totalRequests) {
        const batchPromises = Array.from({ length: requestsPerSecond }, () =>
          request(app.getHttpServer())
            .get('/events')
            .query({ from: '2024-01-01', to: '2024-05-31' })
            .set('Authorization', `Bearer ${accessToken}`)
            .then(res => ({ status: res.status, time: Date.now() }))
            .catch(err => ({ error: err.message, time: Date.now() }))
        )

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
        requestCount += requestsPerSecond

        // Wait 1 second before next batch
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      const successfulRequests = results.filter(r => r.status === 200).length
      const failedRequests = results.filter(r => r.error).length
      const successRate = (successfulRequests / results.length) * 100

      expect(successRate).toBeGreaterThan(95) // At least 95% success rate
      expect(failedRequests).toBeLessThan(results.length * 0.05) // Less than 5% failures
    })
  })
})