import { LocalEvent } from '../../../infra/database/entities/local-event.entity';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { Section } from '../../../infra/database/entities/section.entity';

export interface SpotlightQuery {
  subjectIds?: string[];
  sectionIds?: string[];
  secCodes?: string[];
  text?: string;
  room?: string;
  teacher?: string;
  dateFrom?: string;
  dateTo?: string;
  viewMode?: 'hide_others' | 'dim_others';
}

export interface SpotlightResult {
  events: LocalEvent[];
  subjects: Subject[];
  sections: Section[];
  totalCount: number;
  filteredCount: number;
}

export interface SpotlightSearchOptions {
  userId: string;
  query: SpotlightQuery;
  includeRelations?: boolean;
  limit?: number;
  offset?: number;
}

export interface SpotlightFilterCriteria {
  subjectFilter?: boolean;
  sectionFilter?: boolean;
  textFilter?: boolean;
  roomFilter?: boolean;
  teacherFilter?: boolean;
  dateFilter?: boolean;
}