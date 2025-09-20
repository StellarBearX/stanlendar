import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from '../entities/subject.entity';
import { SubjectRepository } from './interfaces/subject-repository.interface';

@Injectable()
export class TypeOrmSubjectRepository implements SubjectRepository {
  constructor(
    @InjectRepository(Subject)
    private readonly repository: Repository<Subject>,
  ) {}

  async findById(id: string): Promise<Subject | null> {
    return this.repository.findOne({ 
      where: { id },
      relations: ['sections', 'events']
    });
  }

  async findAll(): Promise<Subject[]> {
    return this.repository.find({
      relations: ['sections', 'events']
    });
  }

  async create(subjectData: Partial<Subject>): Promise<Subject> {
    const subject = this.repository.create(subjectData);
    return this.repository.save(subject);
  }

  async update(id: string, updates: Partial<Subject>): Promise<Subject | null> {
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

  async findByUserId(userId: string): Promise<Subject[]> {
    return this.repository.find({
      where: { userId },
      relations: ['sections', 'events'],
      order: { name: 'ASC' }
    });
  }

  async findByUserIdAndCode(userId: string, code: string): Promise<Subject | null> {
    return this.repository.findOne({
      where: { userId, code },
      relations: ['sections', 'events']
    });
  }

  async findByUserIdAndName(userId: string, name: string): Promise<Subject | null> {
    return this.repository.findOne({
      where: { userId, name },
      relations: ['sections', 'events']
    });
  }

  async searchByText(userId: string, searchText: string): Promise<Subject[]> {
    return this.repository
      .createQueryBuilder('subject')
      .leftJoinAndSelect('subject.sections', 'sections')
      .leftJoinAndSelect('subject.events', 'events')
      .where('subject.userId = :userId', { userId })
      .andWhere(
        `to_tsvector('english', subject.name || ' ' || COALESCE(subject.code, '')) @@ plainto_tsquery('english', :searchText)`,
        { searchText }
      )
      .orderBy('subject.name', 'ASC')
      .getMany();
  }
}