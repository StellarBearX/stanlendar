import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReminderService, ReminderSettings } from '../reminder.service';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { LocalEvent } from '../../../infra/database/entities/local-event.entity';

describe('ReminderService', () => {
  let service: ReminderService;
  let subjectRepository: jest.Mocked<Repository<Subject>>;
  let localEventRepository: jest.Mocked<Repository<LocalEvent>>;

  const mockSubject: Subject = {
    id: 'subject-1',
    userId: 'user-1',
    code: 'CS101',
    name: 'Computer Science',
    colorHex: '#3b82f6',
    meta: {
      reminderSettings: {
        enabled: true,
        minutes: 30,
        method: 'popup'
      }
    },
    createdAt: new Date(),
    sections: [],
    events: []
  };

  const mockLocalEvent: LocalEvent = {
    id: 'event-1',
    userId: 'user-1',
    subjectId: 'subject-1',
    sectionId: 'section-1',
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
    section: null,
    meta: null
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        {
          provide: getRepositoryToken(Subject),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LocalEvent),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);
    subjectRepository = module.get(getRepositoryToken(Subject));
    localEventRepository = module.get(getRepositoryToken(LocalEvent));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserReminderPreferences', () => {
    it('should return user reminder preferences', async () => {
      subjectRepository.find.mockResolvedValue([mockSubject]);

      const result = await service.getUserReminderPreferences('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        globalDefault: {
          enabled: true,
          minutes: 15,
          method: 'popup'
        },
        subjectSettings: {
          'subject-1': {
            enabled: true,
            minutes: 30,
            method: 'popup'
          }
        }
      });
    });

    it('should return empty subject settings when no subjects have reminder settings', async () => {
      const subjectWithoutReminders = { ...mockSubject, meta: {} };
      subjectRepository.find.mockResolvedValue([subjectWithoutReminders]);

      const result = await service.getUserReminderPreferences('user-1');

      expect(result.subjectSettings).toEqual({});
    });
  });

  describe('updateSubjectReminderSettings', () => {
    it('should update subject reminder settings', async () => {
      subjectRepository.findOne.mockResolvedValue(mockSubject);
      subjectRepository.update.mockResolvedValue({ affected: 1 } as any);

      const newSettings: ReminderSettings = {
        enabled: true,
        minutes: 60,
        method: 'email'
      };

      await service.updateSubjectReminderSettings('user-1', 'subject-1', newSettings);

      expect(subjectRepository.update).toHaveBeenCalledWith('subject-1', {
        meta: {
          reminderSettings: newSettings
        }
      });
    });

    it('should throw error when subject not found', async () => {
      subjectRepository.findOne.mockResolvedValue(null);

      const newSettings: ReminderSettings = {
        enabled: true,
        minutes: 60,
        method: 'email'
      };

      await expect(
        service.updateSubjectReminderSettings('user-1', 'nonexistent', newSettings)
      ).rejects.toThrow('Subject nonexistent not found for user user-1');
    });
  });

  describe('getEventReminderSettings', () => {
    it('should return subject-specific reminder settings when available', async () => {
      localEventRepository.findOne.mockResolvedValue(mockLocalEvent);

      const result = await service.getEventReminderSettings('event-1');

      expect(result).toEqual([{
        enabled: true,
        minutes: 30,
        method: 'popup'
      }]);
    });

    it('should return default settings when subject has no custom settings', async () => {
      const eventWithoutSubjectSettings = {
        ...mockLocalEvent,
        subject: { ...mockSubject, meta: {} }
      };
      localEventRepository.findOne.mockResolvedValue(eventWithoutSubjectSettings);

      const result = await service.getEventReminderSettings('event-1');

      expect(result).toEqual([{
        enabled: true,
        minutes: 15,
        method: 'popup'
      }]);
    });

    it('should return default settings when event not found', async () => {
      localEventRepository.findOne.mockResolvedValue(null);

      const result = await service.getEventReminderSettings('nonexistent');

      expect(result).toEqual([{
        enabled: true,
        minutes: 15,
        method: 'popup'
      }]);
    });
  });

  describe('formatRemindersForGoogle', () => {
    it('should format enabled reminders for Google Calendar', () => {
      const reminderSettings: ReminderSettings[] = [
        { enabled: true, minutes: 15, method: 'popup' },
        { enabled: true, minutes: 60, method: 'email' }
      ];

      const result = service.formatRemindersForGoogle(reminderSettings);

      expect(result).toEqual({
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 15 },
          { method: 'email', minutes: 60 }
        ]
      });
    });

    it('should return useDefault false when no enabled reminders', () => {
      const reminderSettings: ReminderSettings[] = [
        { enabled: false, minutes: 15, method: 'popup' }
      ];

      const result = service.formatRemindersForGoogle(reminderSettings);

      expect(result).toEqual({ useDefault: false });
    });

    it('should return useDefault false when empty array', () => {
      const result = service.formatRemindersForGoogle([]);

      expect(result).toEqual({ useDefault: false });
    });
  });

  describe('updateSubjectEventsReminders', () => {
    it('should update reminder settings and mark events for sync', async () => {
      const newSettings: ReminderSettings = {
        enabled: true,
        minutes: 45,
        method: 'popup'
      };

      subjectRepository.findOne.mockResolvedValue(mockSubject);
      subjectRepository.update.mockResolvedValue({ affected: 1 } as any);
      localEventRepository.find.mockResolvedValue([mockLocalEvent]);
      localEventRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.updateSubjectEventsReminders('user-1', 'subject-1', newSettings);

      expect(result).toEqual({ updated: 1, failed: 0 });
      expect(subjectRepository.update).toHaveBeenCalledWith('subject-1', {
        meta: {
          reminderSettings: newSettings
        }
      });
      expect(localEventRepository.update).toHaveBeenCalledWith('event-1', {
        meta: {
          remindersNeedUpdate: true
        }
      });
    });
  });

  describe('validateReminderSettings', () => {
    it('should validate correct reminder settings', () => {
      const settings: ReminderSettings = {
        enabled: true,
        minutes: 30,
        method: 'popup'
      };

      const result = service.validateReminderSettings(settings);

      expect(result).toEqual({
        valid: true,
        errors: []
      });
    });

    it('should reject negative minutes', () => {
      const settings: ReminderSettings = {
        enabled: true,
        minutes: -5,
        method: 'popup'
      };

      const result = service.validateReminderSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reminder minutes cannot be negative');
    });

    it('should reject minutes over 4 weeks', () => {
      const settings: ReminderSettings = {
        enabled: true,
        minutes: 50000, // More than 4 weeks
        method: 'popup'
      };

      const result = service.validateReminderSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reminder cannot be more than 4 weeks before the event');
    });

    it('should reject invalid method', () => {
      const settings: ReminderSettings = {
        enabled: true,
        minutes: 15,
        method: 'invalid' as any
      };

      const result = service.validateReminderSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reminder method must be either "email" or "popup"');
    });
  });

  describe('getReminderPresets', () => {
    it('should return predefined reminder presets', () => {
      const presets = service.getReminderPresets();

      expect(presets).toHaveLength(8);
      expect(presets[0]).toEqual({
        label: '5 minutes before',
        minutes: 5,
        method: 'popup'
      });
      expect(presets[6]).toEqual({
        label: '1 day before',
        minutes: 1440,
        method: 'email'
      });
    });
  });
});