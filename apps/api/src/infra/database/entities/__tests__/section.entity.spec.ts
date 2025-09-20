import { validate } from 'class-validator';
import { Section, ScheduleRule } from '../section.entity';

describe('Section Entity', () => {
  let section: Section;

  beforeEach(() => {
    section = new Section();
  });

  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      section.subjectId = 'subject-123';
      section.secCode = '001';
      section.teacher = 'Dr. Smith';
      section.room = 'Room 101';
      
      const rule = new ScheduleRule();
      rule.dayOfWeek = 1;
      rule.startTime = '09:00';
      rule.endTime = '10:30';
      rule.startDate = '2024-01-15';
      rule.endDate = '2024-05-15';
      rule.skipDates = ['2024-02-14'];
      
      section.scheduleRules = [rule];

      const errors = await validate(section);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with empty secCode', async () => {
      section.subjectId = 'subject-123';
      section.secCode = '';
      
      const rule = new ScheduleRule();
      rule.dayOfWeek = 1;
      rule.startTime = '09:00';
      rule.endTime = '10:30';
      rule.startDate = '2024-01-15';
      rule.endDate = '2024-05-15';
      
      section.scheduleRules = [rule];

      const errors = await validate(section);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(error => error.property === 'secCode')).toBe(true);
    });

    it('should pass validation with optional teacher and room', async () => {
      section.subjectId = 'subject-123';
      section.secCode = '001';
      
      const rule = new ScheduleRule();
      rule.dayOfWeek = 1;
      rule.startTime = '09:00';
      rule.endTime = '10:30';
      rule.startDate = '2024-01-15';
      rule.endDate = '2024-05-15';
      
      section.scheduleRules = [rule];

      const errors = await validate(section);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid schedule rules', async () => {
      section.subjectId = 'subject-123';
      section.secCode = '001';
      
      const rule = new ScheduleRule();
      rule.dayOfWeek = 1;
      rule.startTime = ''; // Invalid empty time
      rule.endTime = '10:30';
      rule.startDate = '2024-01-15';
      rule.endDate = '2024-05-15';
      
      section.scheduleRules = [rule];

      const errors = await validate(section);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ScheduleRule validation', () => {
    it('should pass validation with valid schedule rule', async () => {
      const rule = new ScheduleRule();
      rule.dayOfWeek = 1;
      rule.startTime = '09:00';
      rule.endTime = '10:30';
      rule.startDate = '2024-01-15';
      rule.endDate = '2024-05-15';

      const errors = await validate(rule);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with missing required fields', async () => {
      const rule = new ScheduleRule();
      rule.dayOfWeek = 1;
      // Missing other required fields

      const errors = await validate(rule);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});