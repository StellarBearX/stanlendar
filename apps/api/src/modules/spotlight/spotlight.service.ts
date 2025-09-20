import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { LocalEvent } from '../../infra/database/entities/local-event.entity';
import { Subject } from '../../infra/database/entities/subject.entity';
import { Section } from '../../infra/database/entities/section.entity';
import { 
  SpotlightQuery, 
  SpotlightResult, 
  SpotlightSearchOptions,
  SpotlightFilterCriteria 
} from './interfaces/spotlight.interface';

@Injectable()
export class SpotlightService {
  private readonly logger = new Logger(SpotlightService.name);

  constructor(
    @InjectRepository(LocalEvent)
    private readonly eventRepository: Repository<LocalEvent>,
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
  ) {}

  async search(options: SpotlightSearchOptions): Promise<SpotlightResult> {
    const { userId, query, includeRelations = true, limit, offset } = options;
    
    this.logger.debug(`Spotlight search for user ${userId}`, { query });

    // Determine which filters are active
    const filterCriteria = this.analyzeFilterCriteria(query);
    
    // Build the main query for events with all joins
    const eventQuery = this.buildEventQuery(userId, query, includeRelations);
    
    // Apply pagination if specified
    if (limit) {
      eventQuery.limit(limit);
    }
    if (offset) {
      eventQuery.offset(offset);
    }

    // Execute the main query
    const events = await eventQuery.getMany();
    
    // Get total count for pagination
    const totalCount = await this.getTotalEventCount(userId);
    
    // Get filtered subjects and sections based on the results
    const { subjects, sections } = await this.getRelatedEntities(events, userId, query);

    const result: SpotlightResult = {
      events,
      subjects,
      sections,
      totalCount,
      filteredCount: events.length
    };

    this.logger.debug(`Spotlight search completed`, {
      totalCount: result.totalCount,
      filteredCount: result.filteredCount,
      subjectsCount: subjects.length,
      sectionsCount: sections.length
    });

    return result;
  }

  private buildEventQuery(
    userId: string, 
    query: SpotlightQuery, 
    includeRelations: boolean
  ): SelectQueryBuilder<LocalEvent> {
    let eventQuery = this.eventRepository
      .createQueryBuilder('event')
      .where('event.userId = :userId', { userId })
      .andWhere('event.status != :deletedStatus', { deletedStatus: 'deleted' });

    // Add joins for relations
    if (includeRelations) {
      eventQuery = eventQuery
        .leftJoinAndSelect('event.subject', 'subject')
        .leftJoinAndSelect('event.section', 'section');
    } else {
      eventQuery = eventQuery
        .leftJoin('event.subject', 'subject')
        .leftJoin('event.section', 'section');
    }

    // Apply filters
    eventQuery = this.applySubjectFilters(eventQuery, query);
    eventQuery = this.applySectionFilters(eventQuery, query);
    eventQuery = this.applyTextFilters(eventQuery, query);
    eventQuery = this.applyRoomFilters(eventQuery, query);
    eventQuery = this.applyTeacherFilters(eventQuery, query);
    eventQuery = this.applyDateFilters(eventQuery, query);

    // Order by date and time
    eventQuery = eventQuery
      .orderBy('event.eventDate', 'ASC')
      .addOrderBy('event.startTime', 'ASC');

    return eventQuery;
  }

  private applySubjectFilters(
    query: SelectQueryBuilder<LocalEvent>, 
    spotlightQuery: SpotlightQuery
  ): SelectQueryBuilder<LocalEvent> {
    if (spotlightQuery.subjectIds && spotlightQuery.subjectIds.length > 0) {
      query = query.andWhere('event.subjectId IN (:...subjectIds)', {
        subjectIds: spotlightQuery.subjectIds
      });
    }
    return query;
  }

  private applySectionFilters(
    query: SelectQueryBuilder<LocalEvent>, 
    spotlightQuery: SpotlightQuery
  ): SelectQueryBuilder<LocalEvent> {
    if (spotlightQuery.sectionIds && spotlightQuery.sectionIds.length > 0) {
      query = query.andWhere('event.sectionId IN (:...sectionIds)', {
        sectionIds: spotlightQuery.sectionIds
      });
    }

    if (spotlightQuery.secCodes && spotlightQuery.secCodes.length > 0) {
      query = query.andWhere('section.secCode IN (:...secCodes)', {
        secCodes: spotlightQuery.secCodes
      });
    }

    return query;
  }

  private applyTextFilters(
    query: SelectQueryBuilder<LocalEvent>, 
    spotlightQuery: SpotlightQuery
  ): SelectQueryBuilder<LocalEvent> {
    if (spotlightQuery.text && spotlightQuery.text.trim()) {
      const searchText = spotlightQuery.text.trim();
      
      // Use PostgreSQL full-text search with tsvector
      query = query.andWhere(`(
        to_tsvector('english', subject.name || ' ' || COALESCE(subject.code, '')) @@ plainto_tsquery('english', :searchText) OR
        to_tsvector('english', COALESCE(section.teacher, '')) @@ plainto_tsquery('english', :searchText) OR
        to_tsvector('english', COALESCE(section.room, '') || ' ' || COALESCE(event.room, '')) @@ plainto_tsquery('english', :searchText) OR
        to_tsvector('english', section.secCode) @@ plainto_tsquery('english', :searchText) OR
        to_tsvector('english', COALESCE(event.titleOverride, '')) @@ plainto_tsquery('english', :searchText)
      )`, { searchText });
    }

    return query;
  }

  private applyRoomFilters(
    query: SelectQueryBuilder<LocalEvent>, 
    spotlightQuery: SpotlightQuery
  ): SelectQueryBuilder<LocalEvent> {
    if (spotlightQuery.room && spotlightQuery.room.trim()) {
      const roomText = spotlightQuery.room.trim();
      query = query.andWhere(`(
        to_tsvector('english', COALESCE(section.room, '')) @@ plainto_tsquery('english', :roomText) OR
        to_tsvector('english', COALESCE(event.room, '')) @@ plainto_tsquery('english', :roomText)
      )`, { roomText });
    }
    return query;
  }

  private applyTeacherFilters(
    query: SelectQueryBuilder<LocalEvent>, 
    spotlightQuery: SpotlightQuery
  ): SelectQueryBuilder<LocalEvent> {
    if (spotlightQuery.teacher && spotlightQuery.teacher.trim()) {
      const teacherText = spotlightQuery.teacher.trim();
      query = query.andWhere(
        `to_tsvector('english', COALESCE(section.teacher, '')) @@ plainto_tsquery('english', :teacherText)`,
        { teacherText }
      );
    }
    return query;
  }

  private applyDateFilters(
    query: SelectQueryBuilder<LocalEvent>, 
    spotlightQuery: SpotlightQuery
  ): SelectQueryBuilder<LocalEvent> {
    if (spotlightQuery.dateFrom) {
      query = query.andWhere('event.eventDate >= :dateFrom', {
        dateFrom: spotlightQuery.dateFrom
      });
    }

    if (spotlightQuery.dateTo) {
      query = query.andWhere('event.eventDate <= :dateTo', {
        dateTo: spotlightQuery.dateTo
      });
    }

    return query;
  }

  private async getTotalEventCount(userId: string): Promise<number> {
    return this.eventRepository.count({
      where: { 
        userId,
        status: 'planned' // Only count non-deleted events
      }
    });
  }

  private async getRelatedEntities(
    events: LocalEvent[], 
    userId: string, 
    query: SpotlightQuery
  ): Promise<{ subjects: Subject[], sections: Section[] }> {
    // Extract unique subject and section IDs from events
    const subjectIds = [...new Set(events.map(e => e.subjectId))];
    const sectionIds = [...new Set(events.map(e => e.sectionId))];

    // Get subjects
    let subjectQuery = this.subjectRepository
      .createQueryBuilder('subject')
      .where('subject.userId = :userId', { userId });

    if (subjectIds.length > 0) {
      subjectQuery = subjectQuery.andWhere('subject.id IN (:...subjectIds)', { subjectIds });
    }

    // Get sections
    let sectionQuery = this.sectionRepository
      .createQueryBuilder('section')
      .leftJoin('section.subject', 'subject')
      .where('subject.userId = :userId', { userId });

    if (sectionIds.length > 0) {
      sectionQuery = sectionQuery.andWhere('section.id IN (:...sectionIds)', { sectionIds });
    }

    const [subjects, sections] = await Promise.all([
      subjectQuery.getMany(),
      sectionQuery.getMany()
    ]);

    return { subjects, sections };
  }

  private analyzeFilterCriteria(query: SpotlightQuery): SpotlightFilterCriteria {
    return {
      subjectFilter: !!(query.subjectIds && query.subjectIds.length > 0),
      sectionFilter: !!(
        (query.sectionIds && query.sectionIds.length > 0) ||
        (query.secCodes && query.secCodes.length > 0)
      ),
      textFilter: !!(query.text && query.text.trim()),
      roomFilter: !!(query.room && query.room.trim()),
      teacherFilter: !!(query.teacher && query.teacher.trim()),
      dateFilter: !!(query.dateFrom || query.dateTo)
    };
  }

  /**
   * Get suggestions for autocomplete based on partial text input
   */
  async getSuggestions(userId: string, text: string, type: 'subjects' | 'rooms' | 'teachers' | 'sections'): Promise<string[]> {
    if (!text || text.trim().length < 2) {
      return [];
    }

    const searchText = text.trim();

    switch (type) {
      case 'subjects':
        return this.getSubjectSuggestions(userId, searchText);
      case 'rooms':
        return this.getRoomSuggestions(userId, searchText);
      case 'teachers':
        return this.getTeacherSuggestions(userId, searchText);
      case 'sections':
        return this.getSectionSuggestions(userId, searchText);
      default:
        return [];
    }
  }

  private async getSubjectSuggestions(userId: string, searchText: string): Promise<string[]> {
    const results = await this.subjectRepository
      .createQueryBuilder('subject')
      .select(['subject.name', 'subject.code'])
      .where('subject.userId = :userId', { userId })
      .andWhere(`(
        subject.name ILIKE :searchPattern OR 
        subject.code ILIKE :searchPattern
      )`, { searchPattern: `%${searchText}%` })
      .limit(10)
      .getMany();

    return results.map(s => s.code ? `${s.code} ${s.name}` : s.name);
  }

  private async getRoomSuggestions(userId: string, searchText: string): Promise<string[]> {
    const results = await this.sectionRepository
      .createQueryBuilder('section')
      .select('DISTINCT section.room', 'room')
      .leftJoin('section.subject', 'subject')
      .where('subject.userId = :userId', { userId })
      .andWhere('section.room IS NOT NULL')
      .andWhere('section.room ILIKE :searchPattern', { searchPattern: `%${searchText}%` })
      .limit(10)
      .getRawMany();

    return results.map(r => r.room).filter(Boolean);
  }

  private async getTeacherSuggestions(userId: string, searchText: string): Promise<string[]> {
    const results = await this.sectionRepository
      .createQueryBuilder('section')
      .select('DISTINCT section.teacher', 'teacher')
      .leftJoin('section.subject', 'subject')
      .where('subject.userId = :userId', { userId })
      .andWhere('section.teacher IS NOT NULL')
      .andWhere('section.teacher ILIKE :searchPattern', { searchPattern: `%${searchText}%` })
      .limit(10)
      .getRawMany();

    return results.map(r => r.teacher).filter(Boolean);
  }

  private async getSectionSuggestions(userId: string, searchText: string): Promise<string[]> {
    const results = await this.sectionRepository
      .createQueryBuilder('section')
      .select(['section.secCode'])
      .leftJoin('section.subject', 'subject')
      .where('subject.userId = :userId', { userId })
      .andWhere('section.secCode ILIKE :searchPattern', { searchPattern: `%${searchText}%` })
      .limit(10)
      .getMany();

    return results.map(s => s.secCode);
  }
}