import { Section, ScheduleRule } from '../../../infra/database/entities/section.entity';

export class SectionResponseDto {
  id: string;
  subjectId: string;
  secCode: string;
  teacher?: string;
  room?: string;
  scheduleRules: ScheduleRule[];
  subjectName?: string;
  subjectCode?: string;
  eventsCount?: number;

  static fromEntity(section: Section): SectionResponseDto {
    return {
      id: section.id,
      subjectId: section.subjectId,
      secCode: section.secCode,
      teacher: section.teacher,
      room: section.room,
      scheduleRules: section.scheduleRules,
      subjectName: section.subject?.name,
      subjectCode: section.subject?.code,
      eventsCount: section.events?.length || 0,
    };
  }

  static fromEntities(sections: Section[]): SectionResponseDto[] {
    return sections.map(section => this.fromEntity(section));
  }
}