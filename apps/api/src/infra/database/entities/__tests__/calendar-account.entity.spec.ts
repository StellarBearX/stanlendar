import { validate } from 'class-validator';
import { CalendarAccount } from '../calendar-account.entity';

describe('CalendarAccount Entity', () => {
  let account: CalendarAccount;

  beforeEach(() => {
    account = new CalendarAccount();
  });

  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      account.userId = 'user-123';
      account.provider = 'google';
      account.googleSub = 'google-sub-123';
      account.accessTokenEnc = 'encrypted-access-token';
      account.refreshTokenEnc = 'encrypted-refresh-token';
      account.tokenExpiresAt = new Date();

      const errors = await validate(account);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation with invalid provider', async () => {
      account.userId = 'user-123';
      account.provider = 'facebook' as any;
      account.googleSub = 'google-sub-123';
      account.accessTokenEnc = 'encrypted-access-token';
      account.refreshTokenEnc = 'encrypted-refresh-token';
      account.tokenExpiresAt = new Date();

      const errors = await validate(account);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('provider');
    });

    it('should fail validation with empty required fields', async () => {
      account.userId = 'user-123';
      account.provider = 'google';
      account.googleSub = '';
      account.accessTokenEnc = '';
      account.refreshTokenEnc = '';
      account.tokenExpiresAt = new Date();

      const errors = await validate(account);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass validation with optional primaryCalendarId', async () => {
      account.userId = 'user-123';
      account.provider = 'google';
      account.googleSub = 'google-sub-123';
      account.accessTokenEnc = 'encrypted-access-token';
      account.refreshTokenEnc = 'encrypted-refresh-token';
      account.tokenExpiresAt = new Date();
      account.primaryCalendarId = 'primary-calendar-id';

      const errors = await validate(account);
      expect(errors).toHaveLength(0);
    });
  });
});