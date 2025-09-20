import { Test, TestingModule } from '@nestjs/testing';
import { EventFormatterService } from '../event-formatter.service';
import { LocalEvent } from '../../../infra/database/entities/local-event.entity';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { Section } from '../../../infra/database/entities/section.entity';

describe('EventFormatterService', () => {
  let service: EventFormatterService;

  const mockSubject: Subject = {
    id: 'subject-123',
    userId: 'user-123',
    code: 'CS101',
    name: 'Introduction to Computer Science',
    colorHex: '#ff5722', // Orange color
    meta: {
      faculty: 'Engineering',
      credits: '3',
    },
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
    scheduleRules: {
      days: ['MO', 'WE', 'FR'],
      startTime: '09:00',
      endTime: '10:30',
      startDate: '2024-01-15',
      endDate: '2024-05-15',
    },
    subject: mockSubject,
    events: [],
  };

  const mockLocalEvent: LocalEvent = {
    id: 'event-123',
    userId: 'user-123',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventFormatterService],
    }).compile();

    service = module.get<EventFormatterService>(EventFormatterService);
  });

  describe('formatSingleEvent', () => {
    it('should format a single event correctly', () => {
      const result = service.formatSingleEvent(mockLocalEvent, mockSubject, mockSection);

      expect(result.summary).toBe('CS101 Introduction to Computer Science (001)');
      expect(result.description).toContain('Teacher: Dr. Smith');
      expect(result.description).toContain('Room: Room 101');
      expect(result.description).toContain('faculty: Engineering');
      expect(result.location).toBe('Room 101');
      expect(result.start.timeZone).toBe('Asia/Bangkok');
      expect(result.end.timeZone).toBe('Asia/Bangkok');
      expect(result.colorId).toBeDefined();
      expect(result.reminders).toEqual({
        useDefault: false,
        overrides: [
          {
            method: 'popup',
            minutes: 15,
          },
        ],
      });
    });

    it('should handle missing optional fields', () => {
      const minimalSubject = {
        ...mockSubject,
        code: '',
        meta: null,
      };

      const minimalSection = {
        ...mockSection,
        teacher: '',
        room: '',
        secCode: '',
      };

      const minimalEvent = {
        ...mockLocalEvent,
        room: '',
      };

      const result = service.formatSingleEvent(minimalEvent, minimalSubject, minimalSection);

      expect(result.summary).toBe('Introduction to Computer Science');
      expect(result.description).toBe('');
      expect(result.location).toBe('');
    });

    it('should respect formatting options', () => {
      const options = {
        includeReminders: false,
        timezone: 'UTC',
      };

      const result = service.formatSingleEvent(mockLocalEvent, mockSubject, mockSection, options);

      expect(result.reminders).toBeUndefined();
      expect(result.start.timeZone).toBe('UTC');
      expect(result.end.timeZone).toBe('UTC');
    });

    it('should use custom reminder minutes', () => {
      const options = {
        defaultReminderMinutes: 30,
      };

      const result = service.formatSingleEvent(mockLocalEvent, mockSubject, mockSection, options);

      expect(result.reminders?.overrides?.[0].minutes).toBe(30);
    });
  });

  describe('formatRecurringEvent', () => {
    const createMockEvents = (dates: string[]): LocalEvent[] => {
      return dates.map((date, index) => ({
        ...mockLocalEvent,
        id: `event-${index}`,
        eventDate: new Date(date),
      }));
    };

    it('should format recurring event with RRULE', () => {
      const events = createMockEvents([
        '2024-01-15', // Monday
        '2024-01-17', // Wednesday
        '2024-01-19', // Friday
        '2024-01-22', // Monday
        '2024-01-24', // Wednesday
        '2024-01-26', // Friday
      ]);

      const result = service.formatRecurringEvent(events, mockSubject, mockSection);

      expect(result.summary).toBe('CS101 Introduction to Computer Science (001)');
      expect(result.recurrence).toHaveLength(1);
      expect(result.recurrence![0]).toContain('FREQ=WEEKLY');
      expect(result.recurrence![0]).toContain('BYDAY=MO,WE,FR');
      expect(result.recurrence![0]).toContain('UNTIL=');
    });

    it('should handle single day recurring events', () => {
      const events = createMockEvents([
        '2024-01-15', // Monday
        '2024-01-22', // Monday
        '2024-01-29', // Monday
      ]);

      const result = service.formatRecurringEvent(events, mockSubject, mockSection);

      expect(result.recurrence![0]).toContain('BYDAY=MO');
    });

    it('should throw error for empty event list', () => {
      expect(() => {
        service.formatRecurringEvent([], mockSubject, mockSection);
      }).toThrow('Cannot create recurring event from empty event list');
    });

    it('should sort events by date', () => {
      const events = createMockEvents([
        '2024-01-19', // Friday (out of order)
        '2024-01-15', // Monday
        '2024-01-17', // Wednesday
      ]);

      const result = service.formatRecurringEvent(events, mockSubject, mockSection);

      // Should use the earliest date (Monday) as the start
      expect(result.start.dateTime).toContain('2024-01-15');
    });
  });

  describe('generateRRule', () => {
    it('should generate RRULE for weekly pattern', () => {
      const events = [
        { ...mockLocalEvent, eventDate: new Date('2024-01-15') }, // Monday
        { ...mockLocalEvent, eventDate: new Date('2024-01-17') }, // Wednesday
        { ...mockLocalEvent, eventDate: new Date('2024-01-19') }, // Friday
      ];

      const endDate = new Date('2024-05-15');
      const rrule = service.generateRRule(events, endDate);

      expect(rrule).toBe('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20240515T235959Z');
    });

    it('should handle single day pattern', () => {
      const events = [
        { ...mockLocalEvent, eventDate: new Date('2024-01-15') }, // Monday
      ];

      const endDate = new Date('2024-05-15');
      const rrule = service.generateRRule(events, endDate);

      expect(rrule).toBe('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20240515T235959Z');
    });

    it('should handle weekend classes', () => {
      const events = [
        { ...mockLocalEvent, eventDate: new Date('2024-01-13') }, // Saturday
        { ...mockLocalEvent, eventDate: new Date('2024-01-14') }, // Sunday
      ];

      const endDate = new Date('2024-05-15');
      const rrule = service.generateRRule(events, endDate);

      expect(rrule).toBe('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=SU,SA;UNTIL=20240515T235959Z');
    });
  });

  describe('mapSubjectColorToGoogle', () => {
    it('should map orange color to closest Google color', () => {
      const orangeHex = '#ff5722';
      const colorId = service.mapSubjectColorToGoogle(orangeHex);

      // Should map to a valid Google color ID
      expect(colorId).toMatch(/^[1-9]|1[01]$/);
    });

    it('should map blue color to closest Google color', () => {
      const blueHex = '#2196f3';
      const colorId = service.mapSubjectColorToGoogle(blueHex);

      expect(colorId).toMatch(/^[1-9]|1[01]$/);
    });

    it('should handle colors without # prefix', () => {
      const colorId = service.mapSubjectColorToGoogle('ff5722');
      expect(colorId).toMatch(/^[1-9]|1[01]$/);
    });

    it('should return consistent results for same color', () => {
      const color = '#ff5722';
      const colorId1 = service.mapSubjectColorToGoogle(color);
      const colorId2 = service.mapSubjectColorToGoogle(color);

      expect(colorId1).toBe(colorId2);
    });
  });

  describe('getAvailableColors', () => {
    it('should return all Google Calendar colors', () => {
      const colors = service.getAvailableColors();

      expect(colors).toHaveLength(11);
      expect(colors[0]).toEqual({ id: '1', hex: '#a4bdfc' });
      expect(colors[10]).toEqual({ id: '11', hex: '#dc2127' });
    });

    it('should return a copy of the color array', () => {
      const colors1 = service.getAvailableColors();
      const colors2 = service.getAvailableColors();

      expect(colors1).not.toBe(colors2); // Different array instances
      expect(colors1).toEqual(colors2); // Same content
    });
  });

  describe('validateRRule', () => {
    it('should validate correct RRULE', () => {
      const validRRule = 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20240515T235959Z';
      expect(service.validateRRule(validRRule)).toBe(true);
    });

    it('should reject invalid RRULE', () => {
      const invalidRRule = 'FREQ=DAILY;INTERVAL=1';
      expect(service.validateRRule(invalidRRule)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(service.validateRRule('')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very long subject names', () => {
      const longSubject = {
        ...mockSubject,
        name: 'A'.repeat(200),
      };

      const result = service.formatSingleEvent(mockLocalEvent, longSubject, mockSection);
      expect(result.summary).toContain('A'.repeat(200));
    });

    it('should handle special characters in subject names', () => {
      const specialSubject = {
        ...mockSubject,
        name: 'Math & Physics: Theory & Practice (Advanced)',
      };

      const result = service.formatSingleEvent(mockLocalEvent, specialSubject, mockSection);
      expect(result.summary).toContain('Math & Physics: Theory & Practice (Advanced)');
    });

    it('should handle midnight times', () => {
      const midnightEvent = {
        ...mockLocalEvent,
        startTime: '00:00',
        endTime: '01:00',
      };

      const result = service.formatSingleEvent(midnightEvent, mockSubject, mockSection);
      // Check that the time portion is correct (ignoring timezone offset)
      expect(result.start.dateTime).toMatch(/T\d{2}:00:00/);
      expect(result.end.dateTime).toMatch(/T\d{2}:00:00/);
    });

    it('should handle cross-day events', () => {
      const lateEvent = {
        ...mockLocalEvent,
        startTime: '23:30',
        endTime: '01:00', // Next day
      };

      const result = service.formatSingleEvent(lateEvent, mockSubject, mockSection);
      // Check that the time portions are formatted correctly
      expect(result.start.dateTime).toMatch(/T\d{2}:30:00/);
      expect(result.end.dateTime).toMatch(/T\d{2}:00:00/);
    });
  });
});