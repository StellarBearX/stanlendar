import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarAccount } from '../entities/calendar-account.entity';
import { CalendarAccountRepository } from './interfaces/calendar-account-repository.interface';

@Injectable()
export class TypeOrmCalendarAccountRepository implements CalendarAccountRepository {
  constructor(
    @InjectRepository(CalendarAccount)
    private readonly repository: Repository<CalendarAccount>,
  ) {}

  async findById(id: string): Promise<CalendarAccount | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['user']
    });
  }

  async findAll(): Promise<CalendarAccount[]> {
    return this.repository.find({
      relations: ['user']
    });
  }

  async create(accountData: Partial<CalendarAccount>): Promise<CalendarAccount> {
    const account = this.repository.create(accountData);
    return this.repository.save(account);
  }

  async update(id: string, updates: Partial<CalendarAccount>): Promise<CalendarAccount | null> {
    const result = await this.repository.update(id, updates);
    if (result.affected === 0) {
      return null;
    }
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected > 0;
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  async findByUserId(userId: string): Promise<CalendarAccount[]> {
    return this.repository.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' }
    });
  }

  async findByUserIdAndProvider(userId: string, provider: 'google'): Promise<CalendarAccount | null> {
    return this.repository.findOne({
      where: { userId, provider },
      relations: ['user']
    });
  }

  async findByGoogleSub(googleSub: string): Promise<CalendarAccount | null> {
    return this.repository.findOne({
      where: { googleSub },
      relations: ['user']
    });
  }
}