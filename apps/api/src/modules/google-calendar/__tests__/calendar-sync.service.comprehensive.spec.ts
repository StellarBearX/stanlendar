import { Test, TestingModule } from '@nestjs/testing'
import { CalendarSyncService } from '../calendar-sync.service'
import { GoogleCalendarService } from '../google-calendar.service'
import { EventFormatterService } from '../event-formatter.service'
import { LocalEventRepositoryInterface } from '../../../infra/database/repositories/interfaces/local-event-repository.interface'
import { IdempotencyService } from '../../../infra/redis/idempotency.service'
import { JobService } from '../../../infra/redis/jobs/job.service'
import { LocalEvent } from '../../../infra/database/entities/local-event.entity'
import { Subject } from '../../../infra/database/entities/subject.entity'
import { Section } from '../../../infra/database/entities/section.entity'
import { ConflictException, BadRequestException } from '@nestjs/common'

describe('CalendarSyncService (Comprehensive)', () => {
  let service: CalendarSyncService
  let googleCalendarService: jest.Mocked<GoogleCalendarService>
  let eventFormatterService: jest.Mocked<EventFormatterService>
  let localEventRepository: jest.Mocked<LocalEventRepositoryInterface>
  let idempotencyService: jest.Mocked<IdempotencyService>
  let jobService: jest.Mocked<JobService>

  const mockUser = global.createMockUser()
  const mockSubject = global.createMockSubject()
  const mockSection = global.createMockSection()
  const mockLocalEvent = global.createMockLocalEvent()

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarSyncService,
        {
          provide: GoogleCalendarService,
          useValue: {
            createEvent: jest.fn(),
            updateEvent: jest.fn(),
            deleteEvent: jest.fn(),
            getEvent: jest.fn(),
            batchCreateEvents: jest.fn(),
          },
        },
        {
          provide: EventFormatterService,
          useValue: {
            formatForGoogle: jest.fn(),
            formatRecurringEvent: jest.fn(),
            mapColorToGoogle: jest.fn(),
          },
        },
        {
          provide: 'LocalEventRepositoryInterface',
          useValue: {
            findByUserAndDateRange: jest.fn(),
            findById: jest.fn(),
            save: jest.fn(),
            saveMany: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: IdempotencyService,
          useValue: {
            ensureIdempotent: jest.fn(),
          },
        },
        {
          provide: JobService,
          useValue: {
            addSyncJob: jest.fn(),
            getSyncJobStatus: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<CalendarSyncService>(CalendarSyncService)
    googleCalendarService = module.get(GoogleCalendarService)
    eventFormatterService = module.get(EventFormatterService)
    localEventRepository = module.get('LocalEventRepositoryInterface')
    idempotencyService = module.get(IdempotencyService)
    jobService = module.get(JobService)
  })

  describe('syncToGoogle', () => {
    const syncRequest = {
      direction: 'upsert-to-google' as const,
      range: {
        from: '2024-01-01',
        to: '2024-01-31',
      },
      idempotencyKey: 'sync-key-123',
    }

    it('should sync new events to Google Calendar', async () => {
      const events = [
        { ...mockLocalEvent, status: 'planned', gcalEventId: null },
        { ...mockLocalEvent, id: 'event-2', status: 'planned', gcalEventId: null },
      ]

      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)
      eventFormatterService.formatForGoogle.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
        location: 'Room 101',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
      })

      googleCalendarService.createEvent.mockResolvedValue({
        id: 'gcal-event-123',
        etag: 'etag-123',
      })

      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        return await operation()
      })

      const result = await service.syncToGoogle(mockUser.id, syncRequest)

      expect(result.summary.created).toBe(2)
      expect(result.summary.updated).toBe(0)
      expect(result.summary.failed).toBe(0)
      expect(googleCalendarService.createEvent).toHaveBeenCalledTimes(2)
      expect(localEventRepository.save).toHaveBeenCalledTimes(2)
    })

    it('should update existing events in Google Calendar', async () => {
      const events = [
        { 
          ...mockLocalEvent, 
          status: 'synced', 
          gcalEventId: 'gcal-event-123',
          gcalEtag: 'old-etag',
        },
      ]

      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)
      eventFormatterService.formatForGoogle.mockReturnValue({
        summary: 'CS101 Computer Science (001) - Updated',
        location: 'Room 102',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
      })

      googleCalendarService.updateEvent.mockResolvedValue({
        id: 'gcal-event-123',
        etag: 'new-etag',
      })

      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        return await operation()
      })

      const result = await service.syncToGoogle(mockUser.id, syncRequest)

      expect(result.summary.created).toBe(0)
      expect(result.summary.updated).toBe(1)
      expect(result.summary.failed).toBe(0)
      expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
        mockUser.id,
        'gcal-event-123',
        expect.any(Object),
        'old-etag'
      )
    })

    it('should handle ETag conflicts gracefully', async () => {
      const events = [
        { 
          ...mockLocalEvent, 
          status: 'synced', 
          gcalEventId: 'gcal-event-123',
          gcalEtag: 'old-etag',
        },
      ]

      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)
      eventFormatterService.formatForGoogle.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
        location: 'Room 101',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
      })

      // Simulate ETag conflict (412 Precondition Failed)
      googleCalendarService.updateEvent.mockRejectedValue(
        new ConflictException('ETag mismatch - event was modified')
      )

      // Mock getting the latest event from Google
      googleCalendarService.getEvent.mockResolvedValue({
        id: 'gcal-event-123',
        etag: 'latest-etag',
        summary: 'CS101 Computer Science (001) - Modified by user',
        location: 'Room 103',
      })

      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        return await operation()
      })

      const result = await service.syncToGoogle(mockUser.id, syncRequest)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]).toMatchObject({
        localEventId: mockLocalEvent.id,
        gcalEventId: 'gcal-event-123',
        conflictType: 'etag_mismatch',
        localData: expect.any(Object),
        googleData: expect.any(Object),
      })
    })

    it('should batch process large number of events', async () => {
      // Create 150 events (more than batch size of 50)
      const events = Array.from({ length: 150 }, (_, i) => ({
        ...mockLocalEvent,
        id: `event-${i}`,
        status: 'planned',
        gcalEventId: null,
      }))

      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)
      eventFormatterService.formatForGoogle.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
        location: 'Room 101',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
      })

      googleCalendarService.batchCreateEvents.mockResolvedValue([
        { id: 'gcal-1', etag: 'etag-1' },
        { id: 'gcal-2', etag: 'etag-2' },
      ])

      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        return await operation()
      })

      const result = await service.syncToGoogle(mockUser.id, syncRequest)

      expect(result.summary.created).toBe(150)
      expect(googleCalendarService.batchCreateEvents).toHaveBeenCalledTimes(3) // 150/50 = 3 batches
    })

    it('should handle partial failures in batch operations', async () => {
      const events = [
        { ...mockLocalEvent, id: 'event-1', status: 'planned', gcalEventId: null },
        { ...mockLocalEvent, id: 'event-2', status: 'planned', gcalEventId: null },
        { ...mockLocalEvent, id: 'event-3', status: 'planned', gcalEventId: null },
      ]

      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)
      eventFormatterService.formatForGoogle.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
        location: 'Room 101',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
      })

      // Mock partial failure in batch
      googleCalendarService.batchCreateEvents.mockResolvedValue([
        { id: 'gcal-1', etag: 'etag-1' }, // Success
        { error: 'Rate limit exceeded' },   // Failure
        { id: 'gcal-3', etag: 'etag-3' }, // Success
      ])

      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        return await operation()
      })

      const result = await service.syncToGoogle(mockUser.id, syncRequest)

      expect(result.summary.created).toBe(2)
      expect(result.summary.failed).toBe(1)
      expect(result.details).toHaveLength(3)
      expect(result.details[1].status).toBe('failed')
      expect(result.details[1].error).toBe('Rate limit exceeded')
    })

    it('should respect dry run mode', async () => {
      const events = [
        { ...mockLocalEvent, status: 'planned', gcalEventId: null },
      ]

      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)
      eventFormatterService.formatForGoogle.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
        location: 'Room 101',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
      })

      const dryRunRequest = { ...syncRequest, dryRun: true }

      const result = await service.syncToGoogle(mockUser.id, dryRunRequest)

      expect(result.isDryRun).toBe(true)
      expect(result.summary.created).toBe(1) // Shows what would be created
      expect(googleCalendarService.createEvent).not.toHaveBeenCalled()
      expect(localEventRepository.save).not.toHaveBeenCalled()
    })

    it('should enforce rate limits', async () => {
      const events = Array.from({ length: 1000 }, (_, i) => ({
        ...mockLocalEvent,
        id: `event-${i}`,
        status: 'planned',
        gcalEventId: null,
      }))

      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)

      await expect(
        service.syncToGoogle(mockUser.id, syncRequest)
      ).rejects.toThrow('Too many events to sync')
    })

    it('should use idempotency for duplicate requests', async () => {
      const cachedResult = {
        summary: { created: 1, updated: 0, failed: 0, skipped: 0 },
        details: [],
        conflicts: [],
        quotaUsed: 1,
        isDryRun: false,
      }

      idempotencyService.ensureIdempotent.mockResolvedValue(cachedResult)

      const result = await service.syncToGoogle(mockUser.id, syncRequest)

      expect(result).toEqual(cachedResult)
      expect(localEventRepository.findByUserAndDateRange).not.toHaveBeenCalled()
      expect(googleCalendarService.createEvent).not.toHaveBeenCalled()
    })
  })

  describe('resolveConflicts', () => {
    it('should resolve conflicts based on user decisions', async () => {
      const conflicts = [
        {
          localEventId: 'event-1',
          gcalEventId: 'gcal-1',
          conflictType: 'etag_mismatch' as const,
          localData: { summary: 'Local Version' },
          googleData: { summary: 'Google Version' },
        },
      ]

      const resolutions = [
        {
          localEventId: 'event-1',
          resolution: 'use_local' as const,
        },
      ]

      localEventRepository.findById.mockResolvedValue(mockLocalEvent as any)
      eventFormatterService.formatForGoogle.mockReturnValue({
        summary: 'Local Version',
        location: 'Room 101',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
      })

      googleCalendarService.updateEvent.mockResolvedValue({
        id: 'gcal-1',
        etag: 'new-etag',
      })

      const result = await service.resolveConflicts(mockUser.id, conflicts, resolutions)

      expect(result.resolved).toBe(1)
      expect(result.failed).toBe(0)
      expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
        mockUser.id,
        'gcal-1',
        expect.objectContaining({ summary: 'Local Version' }),
        undefined // No ETag for force update
      )
    })

    it('should handle use_google resolution', async () => {
      const conflicts = [
        {
          localEventId: 'event-1',
          gcalEventId: 'gcal-1',
          conflictType: 'etag_mismatch' as const,
          localData: { summary: 'Local Version' },
          googleData: { 
            summary: 'Google Version',
            location: 'Room 102',
            start: { dateTime: '2024-01-15T10:00:00+07:00' },
            end: { dateTime: '2024-01-15T11:30:00+07:00' },
          },
        },
      ]

      const resolutions = [
        {
          localEventId: 'event-1',
          resolution: 'use_google' as const,
        },
      ]

      const result = await service.resolveConflicts(mockUser.id, conflicts, resolutions)

      expect(result.resolved).toBe(1)
      expect(localEventRepository.update).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({
          room: 'Room 102',
          startTime: '10:00',
          endTime: '11:30',
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle Google API quota exceeded', async () => {
      const events = [mockLocalEvent]
      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)
      
      googleCalendarService.createEvent.mockRejectedValue(
        new Error('Quota exceeded')
      )

      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        return await operation()
      })

      const result = await service.syncToGoogle(mockUser.id, {
        direction: 'upsert-to-google',
        range: { from: '2024-01-01', to: '2024-01-31' },
        idempotencyKey: 'sync-key-123',
      })

      expect(result.summary.failed).toBe(1)
      expect(result.details[0].error).toContain('Quota exceeded')
    })

    it('should handle network timeouts', async () => {
      const events = [mockLocalEvent]
      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)
      
      googleCalendarService.createEvent.mockRejectedValue(
        new Error('ETIMEDOUT')
      )

      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        return await operation()
      })

      const result = await service.syncToGoogle(mockUser.id, {
        direction: 'upsert-to-google',
        range: { from: '2024-01-01', to: '2024-01-31' },
        idempotencyKey: 'sync-key-123',
      })

      expect(result.summary.failed).toBe(1)
      expect(result.details[0].error).toContain('Network timeout')
    })
  })

  describe('performance', () => {
    it('should complete sync within acceptable time limits', async () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        ...mockLocalEvent,
        id: `event-${i}`,
        status: 'planned',
        gcalEventId: null,
      }))

      localEventRepository.findByUserAndDateRange.mockResolvedValue(events as any)
      eventFormatterService.formatForGoogle.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
        location: 'Room 101',
        start: { dateTime: '2024-01-15T09:00:00+07:00' },
        end: { dateTime: '2024-01-15T10:30:00+07:00' },
      })

      googleCalendarService.batchCreateEvents.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({ id: `gcal-${i}`, etag: `etag-${i}` }))
      )

      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        return await operation()
      })

      const startTime = Date.now()
      
      await service.syncToGoogle(mockUser.id, {
        direction: 'upsert-to-google',
        range: { from: '2024-01-01', to: '2024-01-31' },
        idempotencyKey: 'sync-key-123',
      })

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })
})