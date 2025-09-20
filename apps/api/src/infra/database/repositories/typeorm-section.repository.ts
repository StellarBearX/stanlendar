import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Section } from '../entities/section.entity';
import { SectionRepository } from './interfaces/section-repository.interface';

@Injectable()
export class TypeOrmSectionRepository implements SectionRepository {
  constructor(
    @InjectRepository(Section)
    private readonly repository: Repository<Section>,
  ) {}

  async findById(id: string): Promise<Section | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['subject', 'events']
    });
  }

  async findAll(): Promise<Section[]> {
    return this.repository.find({
      relations: ['subject', 'events']
    });
  }

  async create(sectionData: Partial<Section>): Promise<Section> {
    const section = this.repository.create(sectionData);
    return this.repository.save(section);
  }

  async update(id: string, updates: Partial<Section>): Promise<Section | null> {
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

  async findBySubjectId(subjectId: string): Promise<Section[]> {
    return this.repository.find({
      where: { subjectId },
      relations: ['subject', 'events'],
      order: { secCode: 'ASC' }
    });
  }

  async findBySubjectIdAndSecCode(subjectId: string, secCode: string): Promise<Section | null> {
    return this.repository.findOne({
      where: { subjectId, secCode },
      relations: ['subject', 'events']
    });
  }
}