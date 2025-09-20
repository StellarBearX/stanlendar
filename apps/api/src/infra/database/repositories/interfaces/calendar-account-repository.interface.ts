import { CalendarAccount } from '../../entities/calendar-account.entity';
import { BaseRepository } from './base-repository.interface';

export interface CalendarAccountRepository extends BaseRepository<CalendarAccount> {
  findByUserId(userId: string): Promise<CalendarAccount[]>;
  findByUserIdAndProvider(userId: string, provider: 'google'): Promise<CalendarAccount | null>;
  findByGoogleSub(googleSub: string): Promise<CalendarAccount | null>;
}