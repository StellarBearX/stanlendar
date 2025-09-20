import { Section } from '../../entities/section.entity';
import { BaseRepository } from './base-repository.interface';

export interface SectionRepository extends BaseRepository<Section> {
  findBySubjectId(subjectId: string): Promise<Section[]>;
  findBySubjectIdAndSecCode(subjectId: string, secCode: string): Promise<Section | null>;
}