import { LocalEvent } from '../../entities/local-event.entity';
import { BaseRepository } from './base-repository.interface';

export interface LocalEventRepository extends BaseRepository<LocalEvent> {
  findByUserId(userId: string): Promise<LocalEvent[]>;
  findByUserIdAndDateRange(userId: string, startDate: string, endDate: string): Promise<LocalEvent[]>;
  findBySubjectId(subjectId: string): Promise<LocalEvent[]>;
  findBySectionId(sectionId: string): Promise<LocalEvent[]>;
  findByStatus(status: 'planned' | 'synced' | 'deleted'): Promise<LocalEvent[]>;
  findByGcalEventId(gcalEventId: string): Promise<LocalEvent | null>;
  softDelete(id: string): Promise<boolean>;
  findPendingSync(userId: string): Promise<LocalEvent[]>;
}