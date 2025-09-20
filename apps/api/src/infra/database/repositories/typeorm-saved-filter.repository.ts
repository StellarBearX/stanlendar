import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedFilter } from '../entities/saved-filter.entity';
import { SavedFilterRepository } from './interfaces/saved-filter-repository.interface';

@Injectable()
export class TypeOrmSavedFilterRepository implements SavedFilterRepository {
  constructor(
    @InjectRepository(SavedFilter)
    private readonly repository: Repository<SavedFilter>,
  ) {}

  async findById(id: string): Promise<SavedFilter | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findAll(): Promise<SavedFilter[]> {
    return this.repository.find();
  }

  async create(filterData: Partial<SavedFilter>): Promise<SavedFilter> {
    const filter = this.repository.create(filterData);
    return this.repository.save(filter);
  }

  async update(id: string, updates: Partial<SavedFilter>): Promise<SavedFilter | null> {
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

  async findByUserId(userId: string): Promise<SavedFilter[]> {
    return this.repository.find({
      where: { userId },
      order: { name: 'ASC' }
    });
  }

  async findByUserIdAndName(userId: string, name: string): Promise<SavedFilter | null> {
    return this.repository.findOne({
      where: { userId, name }
    });
  }

  async deleteByUserIdAndName(userId: string, name: string): Promise<boolean> {
    const result = await this.repository.delete({ userId, name });
    return result.affected > 0;
  }
}