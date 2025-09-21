import { DataSource } from 'typeorm'
import { ConfigService } from '@nestjs/config'

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'sqlite::memory:'
  process.env.REDIS_URL = 'redis://localhost:6379/1'
  process.env.JWT_SECRET = 'test-jwt-secret'
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long'
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
})

// Mock external services
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-token' }),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: { access_token: 'new-token', expiry_date: Date.now() + 3600000 }
        }),
      })),
    },
    calendar: jest.fn().mockReturnValue({
      events: {
        list: jest.fn().mockResolvedValue({ data: { items: [] } }),
        insert: jest.fn().mockResolvedValue({ data: { id: 'event-123' } }),
        update: jest.fn().mockResolvedValue({ data: { id: 'event-123' } }),
        delete: jest.fn().mockResolvedValue({}),
        get: jest.fn().mockResolvedValue({ data: { id: 'event-123', etag: 'etag-123' } }),
      },
      calendars: {
        get: jest.fn().mockResolvedValue({ data: { id: 'primary' } }),
      },
    }),
  },
}))

// Mock Redis
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    flushall: jest.fn(),
    disconnect: jest.fn(),
  }
  return jest.fn(() => mockRedis)
})

// Mock Bull Queue
jest.mock('bull', () => {
  return jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  }))
})

// Global test utilities
global.createMockUser = () => ({
  id: 'user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  createdAt: new Date(),
  lastLoginAt: new Date(),
})

global.createMockSubject = () => ({
  id: 'subject-123',
  userId: 'user-123',
  code: 'CS101',
  name: 'Computer Science',
  colorHex: '#3B82F6',
  meta: {},
  createdAt: new Date(),
})

global.createMockSection = () => ({
  id: 'section-123',
  subjectId: 'subject-123',
  secCode: '001',
  teacher: 'Dr. Smith',
  room: 'Room 101',
  scheduleRules: {
    days: ['MO', 'WE', 'FR'],
    startTime: '09:00',
    endTime: '10:30',
    startDate: '2024-01-15',
    endDate: '2024-05-15',
  },
})

global.createMockLocalEvent = () => ({
  id: 'event-123',
  userId: 'user-123',
  subjectId: 'subject-123',
  sectionId: 'section-123',
  eventDate: new Date('2024-01-15'),
  startTime: '09:00',
  endTime: '10:30',
  room: 'Room 101',
  status: 'planned',
  gcalEventId: null,
  gcalEtag: null,
  createdAt: new Date(),
  updatedAt: new Date(),
})