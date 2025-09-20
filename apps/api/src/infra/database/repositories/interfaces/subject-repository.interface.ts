import { Subject } from '../../entities/subject.entity';
import { BaseRepository } from './base-repository.interface';

export interface SubjectRepository extends BaseRepository<Subject> {
  findByUserId(userId: string): Promise<Subject[]>;
  findByUserIdAndCode(userId: string, code: string): Promise<Subject | null>;
  findByUserIdAndName(userId: string, name: string): Promise<Subject | null>;
  searchByText(userId: string, searchText: string): Promise<Subject[]>;
}