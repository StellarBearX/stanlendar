import { Subject } from '../../../infra/database/entities/subject.entity';

export class SubjectResponseDto {
  id: string;
  code?: string;
  name: string;
  colorHex: string;
  meta?: Record<string, any>;
  createdAt: Date;
  sectionsCount?: number;
  eventsCount?: number;

  static fromEntity(subject: Subject): SubjectResponseDto {
    return {
      id: subject.id,
      code: subject.code,
      name: subject.name,
      colorHex: subject.colorHex,
      meta: subject.meta,
      createdAt: subject.createdAt,
      sectionsCount: subject.sections?.length || 0,
      eventsCount: subject.events?.length || 0,
    };
  }

  static fromEntities(subjects: Subject[]): SubjectResponseDto[] {
    return subjects.map(subject => this.fromEntity(subject));
  }
}