import { validate } from 'class-validator';
import { LocalEvent } from '../local-event.entity';

describe('LocalEvent Entity', () => {
  let event: LocalEvent;

  beforeEach(() => {
    event = new LocalEvent();
  });

  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      event.userId = 'user-123';
      event.subjectId = 'subject-123';
      event.sectionId = 'section-123';
      event.eventDate = '2024-01-15';
      event.startTime = '09:00';
      event.endTime = '10:30';
      event.room = 'Room 101';
      event.status = 'planned';

      const errors = await validate(event);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid date format', async () => {
      event.userId = 'user-123';
      event.subjectId = 'subject-123';
      event.sectionId = 'section-123';
      event.eventDate = 'invalid-date';
      event.startTime = '09:00';
      event.endTime = '10:30';
      event.status = 'planned';

      const errors = await validate(event);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('eventDate');
    });

    it('should fail validation with invalid time format', async () => {
      event.userId = 'user-123';
      event.subjectId = 'subject-123';
      event.sectionId = 'section-123';
      event.eventDate = '2024-01-15';
      event.startTime = '25:00'; // Invalid hour
      event.endTime = '10:30';
      event.status = 'planned';

      const errors = await validate(event);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('startTime');
    });

    it('should fail validation with invalid status', async () => {
      event.userId = 'user-123';
      event.subjectId = 'subject-123';
      event.sectionId = 'section-123';
      event.eventDate = '2024-01-15';
      event.startTime = '09:00';
      event.endTime = '10:30';
      event.status = 'invalid-status' as any;

      const errors = await validate(event);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('status');
    });

    it('should pass validation with optional fields', async () => {
      event.userId = 'user-123';
      event.subjectId = 'subject-123';
      event.sectionId = 'section-123';
      event.eventDate = '2024-01-15';
      event.startTime = '09:00';
      event.endTime = '10:30';
      event.status = 'synced';
      event.titleOverride = 'Custom Title';
      event.gcalEventId = 'gcal-123';
      event.gcalEtag = 'etag-123';

      const errors = await validate(event);
      expect(errors).toHaveLength(0);
    });
  });
});