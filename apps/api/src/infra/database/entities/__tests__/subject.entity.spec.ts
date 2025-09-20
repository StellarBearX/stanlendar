import { validate } from 'class-validator';
import { Subject } from '../subject.entity';

describe('Subject Entity', () => {
  let subject: Subject;

  beforeEach(() => {
    subject = new Subject();
  });

  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      subject.userId = 'user-123';
      subject.code = 'CS101';
      subject.name = 'Computer Science Fundamentals';
      subject.colorHex = '#FF5733';

      const errors = await validate(subject);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation without optional code', async () => {
      subject.userId = 'user-123';
      subject.name = 'Computer Science Fundamentals';
      subject.colorHex = '#FF5733';

      const errors = await validate(subject);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid color hex', async () => {
      subject.userId = 'user-123';
      subject.name = 'Computer Science Fundamentals';
      subject.colorHex = 'invalid-color';

      const errors = await validate(subject);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('colorHex');
    });

    it('should fail validation with empty name', async () => {
      subject.userId = 'user-123';
      subject.name = '';
      subject.colorHex = '#FF5733';

      const errors = await validate(subject);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('name');
    });

    it('should pass validation with valid meta object', async () => {
      subject.userId = 'user-123';
      subject.name = 'Computer Science Fundamentals';
      subject.colorHex = '#FF5733';
      subject.meta = { faculty: 'Engineering', credits: 3 };

      const errors = await validate(subject);
      expect(errors).toHaveLength(0);
    });
  });
});