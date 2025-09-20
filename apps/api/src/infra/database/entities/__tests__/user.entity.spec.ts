import { validate } from 'class-validator';
import { User } from '../user.entity';

describe('User Entity', () => {
  let user: User;

  beforeEach(() => {
    user = new User();
  });

  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      user.email = 'test@example.com';
      user.displayName = 'Test User';

      const errors = await validate(user);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid email', async () => {
      user.email = 'invalid-email';
      user.displayName = 'Test User';

      const errors = await validate(user);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('email');
    });

    it('should fail validation with empty email', async () => {
      user.email = '';
      user.displayName = 'Test User';

      const errors = await validate(user);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('email');
    });

    it('should fail validation with empty display name', async () => {
      user.email = 'test@example.com';
      user.displayName = '';

      const errors = await validate(user);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('displayName');
    });

    it('should pass validation with optional lastLoginAt', async () => {
      user.email = 'test@example.com';
      user.displayName = 'Test User';
      user.lastLoginAt = new Date();

      const errors = await validate(user);
      expect(errors).toHaveLength(0);
    });
  });
});