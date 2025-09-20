import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LocalEvent } from '../entities/local-event.entity';
import { LocalEventRepository } from './interfaces/local-event-repository.interface';

@Injectable()
export class TypeOrmLocalEventRepository implements LocalEventRepository {
  constructor(
    @InjectRepository(LocalEvent)
    private readonly repository: Repository<LocalEvent>,
  ) {}

  async findById(id: string): Promise<LocalEvent | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['user', 'subject', 'section']
    });
  }

  async findAll(): Promise<LocalEvent[]> {
    return this.repository.find({
      relations: ['user', 'subject', 'section'],
      order: { eventDate: 'ASC', startTime: 'ASC' }
    });
  }

  async create(eventData: Partial<LocalEvent>): Promise<LocalEvent> {
    const event = this.repository.create(eventData);
    return this.repository.save(event);
  }

  async update(id: string, updates: Partial<LocalEvent>): Promise<LocalEvent | null> {
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

  async findByUserId(userId: string): Promise<LocalEvent[]> {
    return this.repository.find({
      where: { userId },
      relations: ['subject', 'section'],
      order: { eventDate: 'ASC', startTime: 'ASC' }
    });
  }

  async findByUserIdAndDateRange(userId: string, startDate: string, endDate: string): Promise<LocalEvent[]> {
    return this.repository.find({
      where: {
        userId,
        eventDate: Between(startDate, endDate)
      },
      relations: ['subject', 'section'],
      order: { eventDate: 'ASC', startTime: 'ASC' }
    });
  }

  async findBySubjectId(subjectId: string): Promise<LocalEvent[]> {
    return this.repository.find({
      where: { subjectId },
      relations: ['user', 'subject', 'section'],
      order: { eventDate: 'ASC', startTime: 'ASC' }
    });
  }

  async findBySectionId(sectionId: string): Promise<LocalEvent[]> {
    return this.repository.find({
      where: { sectionId },
      relations: ['user', 'subject', 'section'],
      order: { eventDate: 'ASC', startTime: 'ASC' }
    });
  }

  async findByStatus(status: 'planned' | 'synced' | 'deleted'): Promise<LocalEvent[]> {
    return this.repository.find({
      where: { status },
      relations: ['user', 'subject', 'section'],
      order: { eventDate: 'ASC', startTime: 'ASC' }
    });
  }

  async findByGcalEventId(gcalEventId: string): Promise<LocalEvent | null> {
    return this.repository.findOne({
      where: { gcalEventId },
      relations: ['user', 'subject', 'section']
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, { status: 'deleted' });
    return result.affected > 0;
  }

  async findPendingSync(userId: string): Promise<LocalEvent[]> {
    return this.repository.find({
      where: { 
        userId,
        status: 'planned'
      },
      relations: ['subject', 'section'],
      order: { eventDate: 'ASC', startTime: 'ASC' }
    });
  }
}