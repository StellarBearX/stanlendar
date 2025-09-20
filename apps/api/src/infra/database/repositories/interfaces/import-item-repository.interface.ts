import { ImportItem } from '../../entities/import-item.entity';
import { BaseRepositoryInterface } from './base-repository.interface';

export interface ImportItemRepositoryInterface extends BaseRepositoryInterface<ImportItem> {
  findByImportJobId(importJobId: string): Promise<ImportItem[]>;
  findByImportJobIdAndStatus(importJobId: string, status: ImportItem['status']): Promise<ImportItem[]>;
  bulkCreate(items: Partial<ImportItem>[]): Promise<ImportItem[]>;
  updateStatus(id: string, status: ImportItem['status']): Promise<void>;
}