import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportJob } from '../entities/import-job.entity';
import { ImportJobRepositoryInterface } from './interfaces/import-job-repository.interface';

@Injectable()
export class TypeOrmImportJobRepository implements ImportJobRepositoryInterface {
  constructor(
    @InjectRepository(ImportJob)
    private readonly repository: Repository<ImportJob>,
  ) {}

  async create(data: Partial<ImportJob>): Promise<ImportJob> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<ImportJob | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByUserId(userId: string): Promise<ImportJob[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUserIdAndState(userId: string, state: ImportJob['state']): Promise<ImportJob[]> {
    return this.repository.find({
      where: { userId, state },
      order: { createdAt: 'DESC' },
    });
  }

  async findWithItems(id: string): Promise<ImportJob | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['items'],
    });
  }

  async update(id: string, data: Partial<ImportJob>): Promise<ImportJob | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async findAll(): Promise<ImportJob[]> {
    return this.repository.find();
  }
}