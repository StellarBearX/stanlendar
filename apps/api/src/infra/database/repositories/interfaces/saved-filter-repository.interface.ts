import { SavedFilter } from '../../entities/saved-filter.entity';
import { BaseRepository } from './base-repository.interface';

export interface SavedFilterRepository extends BaseRepository<SavedFilter> {
  findByUserId(userId: string): Promise<SavedFilter[]>;
  findByUserIdAndName(userId: string, name: string): Promise<SavedFilter | null>;
  deleteByUserIdAndName(userId: string, name: string): Promise<boolean>;
}