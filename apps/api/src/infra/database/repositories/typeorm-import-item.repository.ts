import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportItem } from '../entities/import-item.entity';
import { ImportItemRepositoryInterface } from './interfaces/import-item-repository.interface';

@Injectable()
export class TypeOrmImportItemRepository implements ImportItemRepositoryInterface {
  constructor(
    @InjectRepository(ImportItem)
    private readonly repository: Repository<ImportItem>,
  ) {}

  async create(data: Partial<ImportItem>): Promise<ImportItem> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<ImportItem | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByImportJobId(importJobId: string): Promise<ImportItem[]> {
    return this.repository.find({
      where: { importJobId },
      order: { id: 'ASC' },
    });
  }

  async findByImportJobIdAndStatus(importJobId: string, status: ImportItem['status']): Promise<ImportItem[]> {
    return this.repository.find({
      where: { importJobId, status },
      order: { id: 'ASC' },
    });
  }

  async bulkCreate(items: Partial<ImportItem>[]): Promise<ImportItem[]> {
    const entities = this.repository.create(items);
    return this.repository.save(entities);
  }

  async updateStatus(id: string, status: ImportItem['status']): Promise<void> {
    await this.repository.update(id, { status });
  }

  async update(id: string, data: Partial<ImportItem>): Promise<ImportItem | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async findAll(): Promise<ImportItem[]> {
    return this.repository.find();
  }
}