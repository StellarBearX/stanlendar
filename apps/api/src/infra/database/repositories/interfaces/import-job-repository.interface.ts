import { ImportJob } from '../../entities/import-job.entity';
import { BaseRepositoryInterface } from './base-repository.interface';

export interface ImportJobRepositoryInterface extends BaseRepositoryInterface<ImportJob> {
  findByUserId(userId: string): Promise<ImportJob[]>;
  findByUserIdAndState(userId: string, state: ImportJob['state']): Promise<ImportJob[]>;
  findWithItems(id: string): Promise<ImportJob | null>;
}