import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { StructuredLoggerService } from '../logger.service'

describe('StructuredLoggerService', () => {
  let service: StructuredLoggerService
  let configService: jest.Mocked<ConfigService>
  let consoleSpy: jest.SpyInstance

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructuredLoggerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              switch (key) {
                case 'NODE_ENV':
                  return 'test'
                case 'LOG_LEVEL':
                  return 'info'
                default:
                  return defaultValue
              }
            }),
          },
        },
      ],
    }).compile()

    service = module.get<StructuredLoggerService>(StructuredLoggerService)
    configService = module.get(ConfigService)
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('logging levels', () => {
    it('should log info messages', () => {
      service.info('Test message', { userId: 'user-123' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      )
    })

    it('should log error messages with context', () => {
      const error = new Error('Test error')
      service.error('Error occurred', { error, userId: 'user-123' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      )
    })

    it('should respect log level filtering', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'LOG_LEVEL') return 'error'
        return 'test'
      })

      // Create new service instance with error level
      const errorLevelService = new StructuredLoggerService(configService)
      
      errorLevelService.info('This should not be logged')
      errorLevelService.error('This should be logged')

      expect(consoleSpy).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('This should be logged')
      )
    })
  })

  describe('context sanitization', () => {
    it('should redact sensitive information', () => {
      service.info('Test message', {
        userId: 'user-123',
        password: 'secret123',
        token: 'bearer-token',
        normalField: 'normal-value',
      })

      const logCall = consoleSpy.mock.calls[0][0]
      expect(logCall).toContain('[REDACTED]')
      expect(logCall).not.toContain('secret123')
      expect(logCall).not.toContain('bearer-token')
      expect(logCall).toContain('normal-value')
    })

    it('should sanitize error objects', () => {
      const error = new Error('Test error')
      error.stack = 'Error stack trace'

      service.error('Error message', { error })

      expect(consoleSpy).toHaveBeenCalled()
      // In test environment, stack traces should be included
      const logCall = consoleSpy.mock.calls[0][0]
      expect(logCall).toContain('Test error')
    })
  })

  describe('convenience methods', () => {
    it('should log request information', () => {
      service.logRequest('GET', '/api/users', {
        userId: 'user-123',
        ip: '127.0.0.1',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/users')
      )
    })

    it('should log response information', () => {
      service.logResponse('GET', '/api/users', 200, 150, {
        userId: 'user-123',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/users 200 150ms')
      )
    })

    it('should log Google API calls', () => {
      service.logGoogleApiCall('createEvent', 5, {
        userId: 'user-123',
        eventId: 'event-123',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Google API: createEvent')
      )
    })

    it('should log database queries', () => {
      service.logDatabaseQuery('SELECT * FROM users', 250, {
        userId: 'user-123',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database query: 250ms')
      )
    })

    it('should log sync operations', () => {
      service.logSyncOperation('upsert-to-google', 15, 3000, {
        userId: 'user-123',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sync upsert-to-google: 15 events in 3000ms')
      )
    })

    it('should log security events', () => {
      service.logSecurityEvent('failed_login_attempt', {
        userId: 'user-123',
        ip: '192.168.1.1',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security event: failed_login_attempt')
      )
    })

    it('should log performance metrics', () => {
      service.logPerformanceMetric('response_time', 150, 'ms', {
        route: '/api/users',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance: response_time = 150ms')
      )
    })
  })

  describe('NestJS LoggerService interface', () => {
    it('should implement log method', () => {
      service.log('Test message', 'TestContext')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test message')
      )
    })

    it('should implement verbose method', () => {
      service.verbose('Verbose message', 'TestContext')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Verbose message')
      )
    })
  })

  describe('production vs development formatting', () => {
    it('should use JSON format in production', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production'
        return 'info'
      })

      const prodService = new StructuredLoggerService(configService)
      prodService.info('Test message', { userId: 'user-123' })

      const logCall = consoleSpy.mock.calls[0][0]
      expect(() => JSON.parse(logCall)).not.toThrow()
    })

    it('should use pretty format in development', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development'
        return 'info'
      })

      const devService = new StructuredLoggerService(configService)
      devService.info('Test message', { userId: 'user-123' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('INFO')
      )
    })
  })
})