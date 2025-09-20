import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarSyncService, SyncOptions } from '../calendar-sync.service';
import { GoogleCalendarService } from '../google-calendar.service';
import { EventFormatterService } from '../event-formatter.service';
import { LocalEvent } from '../../../infra/database/entities/local-event.entity';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { Section } from '../../../infra/database/entities/section.entity';

describe('CalendarSyncService', () => {
  let service: CalendarSyncService;
  let googleCalendarService: jest.Mocked<GoogleCalendarService>;
  let eventFormatterService: jest.Mocked<EventFormatterService>;
  let localEventRepository: jest.Mocked<Repository<LocalEvent>>;
  let subjectRepository: jest.Mocked<Repository<Subject>>;
  let sectionRepository: jest.Mocked<Repository<Section>>;

  const mockUserId = 'user-123';

  const mockSubject: Subject = {
    id: 'subject-123',
    userId: mockUserId,
    code: 'CS101',
    name: 'Computer Science',
    colorHex: '#ff5722',
    meta: {},
    createdAt: new Date(),
    sections: [],
    events: [],
  };

  const mockSection: Section = {
    id: 'section-123',
    subjectId: 'subject-123',
    secCode: '001',
    teacher: 'Dr. Smith',
    room: 'Room 101',
    scheduleRules: {},
    subject: mockSubject,
    events: [],
  };

  const mockLocalEvent: LocalEvent = {
    id: 'event-123',
    userId: mockUserId,
    subjectId: 'subject-123',
    sectionId: 'section-123',
    eventDate: new Date('2024-01-15'),
    startTime: '09:00',
    endTime: '10:30',
    room: 'Room 101',
    titleOverride: null,
    status: 'planned',
    gcalEventId: null,
    gcalEtag: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    subject: mockSubject,
    section: mockSection,
  };

  const mockSyncOptions: SyncOptions = {
    direction: 'upsert-to-google',
    range: {
      from: '2024-01-01',
      to: '2024-12-31',
    },
    idempotencyKey: 'test-key-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarSyncService,
        {
          provide: GoogleCalendarService,
          useValue: {
            createEvent: jest.fn(),
            updateEvent: jest.fn(),
            getEvent: jest.fn(),
          },
        },
        {
          provide: EventFormatterService,
          useValue: {
            formatSingleEvent: jest.fn(),
            formatRecurringEvent: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LocalEvent),
          useValue: {
            createQueryBuilder: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Section),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CalendarSyncService>(CalendarSyncService);
    googleCalendarService = module.get(GoogleCalendarService);
    eventFormatterService = module.get(EventFormatterService);
    localEventRepository = module.get(getRepositoryToken(LocalEvent));
    subjectRepository = module.get(getRepositoryToken(Subject));
    sectionRepository = module.get(getRepositoryToken(Section));
  });

  describe('syncToGoogle', () => {
    it('should sync new events to Google Calendar', async () => {
      // Setup
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLocalEvent]),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      
      eventFormatterService.formatSingleEvent.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
        start: { dateTime: '2024-01-15T09:00:00', timeZone: 'Asia/Bangkok' },
        end: { dateTime: '2024-01-15T10:30:00', timeZone: 'Asia/Bangkok' },
      } as any);

      googleCalendarService.createEvent.mockResolvedValue({
        eventId: 'google-event-123',
        etag: 'etag-123',
      });

      localEventRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Execute
      const result = await service.syncToGoogle(mockUserId, mockSyncOptions);

      // Verify
      expect(result.summary.created).toBe(1);
      expect(result.summary.failed).toBe(0);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].action).toBe('created');
      expect(result.details[0].googleEventId).toBe('google-event-123');

      expect(googleCalendarService.createEvent).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          summary: 'CS101 Computer Science (001)',
        }),
      );

      expect(localEventRepository.update).toHaveBeenCalledWith(
        mockLocalEvent.id,
        expect.objectContaining({
          gcalEventId: 'google-event-123',
          gcalEtag: 'etag-123',
          status: 'synced',
        }),
      );
    });

    it('should update existing events in Google Calendar', async () => {
      // Setup
      const existingEvent = {
        ...mockLocalEvent,
        gcalEventId: 'existing-google-id',
        gcalEtag: 'old-etag',
        status: 'synced' as const,
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([existingEvent]),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      
      eventFormatterService.formatSingleEvent.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
        start: { dateTime: '2024-01-15T09:00:00', timeZone: 'Asia/Bangkok' },
        end: { dateTime: '2024-01-15T10:30:00', timeZone: 'Asia/Bangkok' },
      } as any);

      googleCalendarService.updateEvent.mockResolvedValue({
        eventId: 'existing-google-id',
        etag: 'new-etag',
      });

      localEventRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Execute
      const result = await service.syncToGoogle(mockUserId, mockSyncOptions);

      // Verify
      expect(result.summary.updated).toBe(1);
      expect(result.summary.failed).toBe(0);
      expect(result.details[0].action).toBe('updated');

      expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
        mockUserId,
        'existing-google-id',
        expect.any(Object),
        'old-etag',
      );
    });

    it('should handle ETag mismatch conflicts', async () => {
      // Setup
      const conflictedEvent = {
        ...mockLocalEvent,
        gcalEventId: 'conflicted-google-id',
        gcalEtag: 'old-etag',
        status: 'synced' as const,
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([conflictedEvent]),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      
      eventFormatterService.formatSingleEvent.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
      } as any);

      googleCalendarService.updateEvent.mockRejectedValue(
        new Error('Google Calendar API error: Google Calendar event was modified by another client (ETag mismatch)'),
      );

      googleCalendarService.getEvent.mockResolvedValue({
        id: 'conflicted-google-id',
        etag: 'new-etag',
        summary: 'Modified Event',
      });

      // Execute
      const result = await service.syncToGoogle(mockUserId, mockSyncOptions);

      // Verify
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('etag_mismatch');
      expect(result.conflicts[0].suggestedResolution.action).toBe('merge');
    });

    it('should handle dry run mode', async () => {
      // Setup
      const dryRunOptions = { ...mockSyncOptions, dryRun: true };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLocalEvent]),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      
      eventFormatterService.formatSingleEvent.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
      } as any);

      // Execute
      const result = await service.syncToGoogle(mockUserId, dryRunOptions);

      // Verify
      expect(result.isDryRun).toBe(true);
      expect(result.summary.created).toBe(1);
      expect(result.details[0].googleEventId).toBe('dry-run-id');
      expect(googleCalendarService.createEvent).not.toHaveBeenCalled();
      expect(localEventRepository.update).not.toHaveBeenCalled();
    });

    it('should handle empty event list', async () => {
      // Setup
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Execute
      const result = await service.syncToGoogle(mockUserId, mockSyncOptions);

      // Verify
      expect(result.summary.created).toBe(0);
      expect(result.summary.updated).toBe(0);
      expect(result.summary.failed).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    it('should sync recurring events with RRULE', async () => {
      // Setup - multiple events with same pattern
      const recurringEvents = [
        { ...mockLocalEvent, id: 'event-1', eventDate: new Date('2024-01-15') },
        { ...mockLocalEvent, id: 'event-2', eventDate: new Date('2024-01-17') },
        { ...mockLocalEvent, id: 'event-3', eventDate: new Date('2024-01-19') },
        { ...mockLocalEvent, id: 'event-4', eventDate: new Date('2024-01-22') },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(recurringEvents),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      
      eventFormatterService.formatRecurringEvent.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'],
      } as any);

      googleCalendarService.createEvent.mockResolvedValue({
        eventId: 'recurring-google-id',
        etag: 'recurring-etag',
      });

      localEventRepository.update.mockResolvedValue({ affected: 4 } as any);

      // Execute
      const result = await service.syncToGoogle(mockUserId, mockSyncOptions);

      // Verify
      expect(result.summary.created).toBe(4); // All events marked as created
      expect(result.quotaUsed).toBe(1); // Only one API call for RRULE
      expect(eventFormatterService.formatRecurringEvent).toHaveBeenCalledWith(
        recurringEvents,
        mockSubject,
        mockSection,
      );
    });
  });

  describe('resolveConflicts', () => {
    it('should resolve conflicts with use_local action', async () => {
      // Setup
      const conflict = {
        localEventId: 'event-123',
        googleEventId: 'google-123',
        conflictType: 'etag_mismatch' as const,
        localEvent: mockLocalEvent,
        googleEvent: { id: 'google-123', etag: 'new-etag' },
        suggestedResolution: {
          action: 'use_local' as const,
          reason: 'Use local version',
        },
      };

      const resolution = {
        action: 'use_local' as const,
        reason: 'User chose local version',
      };

      eventFormatterService.formatSingleEvent.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
      } as any);

      googleCalendarService.updateEvent.mockResolvedValue({
        eventId: 'google-123',
        etag: 'updated-etag',
      });

      localEventRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Execute
      const result = await service.resolveConflicts(mockUserId, [conflict], [resolution]);

      // Verify
      expect(result.summary.updated).toBe(1);
      expect(result.details[0].action).toBe('updated');
      expect(googleCalendarService.updateEvent).toHaveBeenCalledWith(
        mockUserId,
        'google-123',
        expect.any(Object),
      );
    });

    it('should resolve conflicts with recreate action', async () => {
      // Setup
      const conflict = {
        localEventId: 'event-123',
        googleEventId: 'deleted-google-id',
        conflictType: 'deleted_on_google' as const,
        localEvent: mockLocalEvent,
        suggestedResolution: {
          action: 'recreate' as const,
          reason: 'Event was deleted on Google',
        },
      };

      const resolution = {
        action: 'recreate' as const,
        reason: 'Recreate deleted event',
      };

      eventFormatterService.formatSingleEvent.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
      } as any);

      googleCalendarService.createEvent.mockResolvedValue({
        eventId: 'new-google-id',
        etag: 'new-etag',
      });

      localEventRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Execute
      const result = await service.resolveConflicts(mockUserId, [conflict], [resolution]);

      // Verify
      expect(result.summary.created).toBe(1);
      expect(result.details[0].action).toBe('created');
      expect(googleCalendarService.createEvent).toHaveBeenCalled();
    });

    it('should resolve conflicts with unlink action', async () => {
      // Setup
      const conflict = {
        localEventId: 'event-123',
        googleEventId: 'google-123',
        conflictType: 'modified_externally' as const,
        localEvent: mockLocalEvent,
        suggestedResolution: {
          action: 'unlink' as const,
          reason: 'Unlink from Google',
        },
      };

      const resolution = {
        action: 'unlink' as const,
        reason: 'User chose to unlink',
      };

      localEventRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Execute
      const result = await service.resolveConflicts(mockUserId, [conflict], [resolution]);

      // Verify
      expect(result.summary.updated).toBe(1);
      expect(result.details[0].action).toBe('updated');
      expect(localEventRepository.update).toHaveBeenCalledWith(
        'event-123',
        expect.objectContaining({
          gcalEventId: null,
          gcalEtag: null,
          status: 'planned',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should handle Google API errors gracefully', async () => {
      // Setup
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLocalEvent]),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      
      eventFormatterService.formatSingleEvent.mockReturnValue({
        summary: 'CS101 Computer Science (001)',
      } as any);

      googleCalendarService.createEvent.mockRejectedValue(
        new Error('Google API quota exceeded'),
      );

      // Execute
      const result = await service.syncToGoogle(mockUserId, mockSyncOptions);

      // Verify
      expect(result.summary.failed).toBe(1);
      expect(result.details[0].action).toBe('failed');
      expect(result.details[0].error).toContain('Google API quota exceeded');
    });

    it('should handle database errors gracefully', async () => {
      // Setup
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Execute & Verify
      await expect(service.syncToGoogle(mockUserId, mockSyncOptions)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('filtering and querying', () => {
    it('should filter events by date range', async () => {
      // Setup
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Execute
      await service.syncToGoogle(mockUserId, mockSyncOptions);

      // Verify
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.eventDate >= :from',
        { from: '2024-01-01' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.eventDate <= :to',
        { to: '2024-12-31' },
      );
    });

    it('should filter events by specific IDs when provided', async () => {
      // Setup
      const optionsWithIds = {
        ...mockSyncOptions,
        eventIds: ['event-1', 'event-2'],
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      localEventRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Execute
      await service.syncToGoogle(mockUserId, optionsWithIds);

      // Verify
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.id IN (:...eventIds)',
        { eventIds: ['event-1', 'event-2'] },
      );
    });
  });
});