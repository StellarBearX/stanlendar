import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { LocalEventRepository } from '../../infra/database/repositories/interfaces/local-event-repository.interface';
import { SectionRepository } from '../../infra/database/repositories/interfaces/section-repository.interface';
import { LocalEvent } from '../../infra/database/entities/local-event.entity';
import { Section, ScheduleRule } from '../../infra/database/entities/section.entity';

export interface GenerateEventsOptions {
  startDate?: string;
  endDate?: string;
  replaceExisting?: boolean;
}

export interface EventGenerationResult {
  generated: number;
  skipped: number;
  replaced: number;
  events: LocalEvent[];
}

@Injectable()
export class EventGenerationService {
  constructor(
    @Inject('LocalEventRepository')
    private readonly localEventRepository: LocalEventRepository,
    @Inject('SectionRepository')
    private readonly sectionRepository: SectionRepository,
  ) {}

  /**
   * Generate events for a specific section based on its schedule rules
   */
  async generateEventsForSection(
    userId: string,
    sectionId: string,
    options: GenerateEventsOptions = {}
  ): Promise<EventGenerationResult> {
    const section = await this.sectionRepository.findById(sectionId);
    
    if (!section) {
      throw new NotFoundException(`Section with ID '${sectionId}' not found`);
    }

    // Verify section belongs to user through subject
    if (section.subject.userId !== userId) {
      throw new NotFoundException(`Section with ID '${sectionId}' not found`);
    }

    const result: EventGenerationResult = {
      generated: 0,
      skipped: 0,
      replaced: 0,
      events: [],
    };

    // Generate events for each schedule rule
    for (const rule of section.scheduleRules) {
      const ruleResult = await this.generateEventsForRule(section, rule, options);
      result.generated += ruleResult.generated;
      result.skipped += ruleResult.skipped;
      result.replaced += ruleResult.replaced;
      result.events.push(...ruleResult.events);
    }

    return result;
  }

  /**
   * Generate events for all sections of a subject
   */
  async generateEventsForSubject(
    userId: string,
    subjectId: string,
    options: GenerateEventsOptions = {}
  ): Promise<EventGenerationResult> {
    const sections = await this.sectionRepository.findBySubjectId(subjectId);
    
    if (sections.length === 0) {
      throw new NotFoundException(`No sections found for subject ID '${subjectId}'`);
    }

    // Verify subject belongs to user
    if (sections[0].subject.userId !== userId) {
      throw new NotFoundException(`Subject with ID '${subjectId}' not found`);
    }

    const result: EventGenerationResult = {
      generated: 0,
      skipped: 0,
      replaced: 0,
      events: [],
    };

    // Generate events for each section
    for (const section of sections) {
      const sectionResult = await this.generateEventsForSection(userId, section.id, options);
      result.generated += sectionResult.generated;
      result.skipped += sectionResult.skipped;
      result.replaced += sectionResult.replaced;
      result.events.push(...sectionResult.events);
    }

    return result;
  }

  /**
   * Generate events for a specific schedule rule using RRULE-like logic
   */
  private async generateEventsForRule(
    section: Section,
    rule: ScheduleRule,
    options: GenerateEventsOptions
  ): Promise<EventGenerationResult> {
    const result: EventGenerationResult = {
      generated: 0,
      skipped: 0,
      replaced: 0,
      events: [],
    };

    // Determine date range for generation
    const startDate = options.startDate ? new Date(options.startDate) : new Date(rule.startDate);
    const endDate = options.endDate ? new Date(options.endDate) : new Date(rule.endDate);
    
    // Ensure we don't go outside the rule's date range
    const ruleStartDate = new Date(rule.startDate);
    const ruleEndDate = new Date(rule.endDate);
    
    const effectiveStartDate = startDate > ruleStartDate ? startDate : ruleStartDate;
    const effectiveEndDate = endDate < ruleEndDate ? endDate : ruleEndDate;

    if (effectiveStartDate >= effectiveEndDate) {
      return result;
    }

    // Get skip dates as Date objects for easier comparison
    const skipDates = new Set(rule.skipDates?.map(date => date) || []);

    // Generate events for each occurrence
    const currentDate = new Date(effectiveStartDate);
    
    // Find the first occurrence of the target day of week
    while (currentDate.getDay() !== rule.dayOfWeek && currentDate <= effectiveEndDate) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Generate events weekly
    while (currentDate <= effectiveEndDate) {
      const eventDateString = this.formatDate(currentDate);
      
      // Skip if this date is in the skip list
      if (skipDates.has(eventDateString)) {
        result.skipped++;
        currentDate.setDate(currentDate.getDate() + 7); // Move to next week
        continue;
      }

      // Check if event already exists
      const existingEvents = await this.localEventRepository.findBySectionId(section.id);
      const existingEvent = existingEvents.find(
        event => event.eventDate === eventDateString && 
                event.startTime === rule.startTime &&
                event.endTime === rule.endTime
      );

      if (existingEvent && !options.replaceExisting) {
        result.skipped++;
      } else {
        // Create or replace event
        const eventData: Partial<LocalEvent> = {
          userId: section.subject.userId,
          subjectId: section.subjectId,
          sectionId: section.id,
          eventDate: eventDateString,
          startTime: rule.startTime,
          endTime: rule.endTime,
          room: section.room,
          status: 'planned',
        };

        if (existingEvent && options.replaceExisting) {
          // Update existing event
          const updatedEvent = await this.localEventRepository.update(existingEvent.id, eventData);
          if (updatedEvent) {
            result.events.push(updatedEvent);
            result.replaced++;
          }
        } else if (!existingEvent) {
          // Create new event
          const newEvent = await this.localEventRepository.create(eventData);
          result.events.push(newEvent);
          result.generated++;
        }
      }

      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);
    }

    return result;
  }

  /**
   * Delete all generated events for a section
   */
  async deleteEventsForSection(userId: string, sectionId: string): Promise<number> {
    const section = await this.sectionRepository.findById(sectionId);
    
    if (!section) {
      throw new NotFoundException(`Section with ID '${sectionId}' not found`);
    }

    // Verify section belongs to user through subject
    if (section.subject.userId !== userId) {
      throw new NotFoundException(`Section with ID '${sectionId}' not found`);
    }

    const events = await this.localEventRepository.findBySectionId(sectionId);
    let deletedCount = 0;

    for (const event of events) {
      if (event.status === 'planned') {
        // Hard delete planned events
        const deleted = await this.localEventRepository.delete(event.id);
        if (deleted) deletedCount++;
      } else {
        // Soft delete synced events
        const deleted = await this.localEventRepository.softDelete(event.id);
        if (deleted) deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Regenerate events for a section (delete existing and create new)
   */
  async regenerateEventsForSection(
    userId: string,
    sectionId: string,
    options: GenerateEventsOptions = {}
  ): Promise<EventGenerationResult> {
    // Delete existing events
    const deletedCount = await this.deleteEventsForSection(userId, sectionId);
    
    // Generate new events
    const result = await this.generateEventsForSection(userId, sectionId, options);
    
    return {
      ...result,
      replaced: deletedCount,
    };
  }

  /**
   * Validate date range for event generation
   */
  private validateDateRange(startDate?: string, endDate?: string): void {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start >= end) {
        throw new BadRequestException('Start date must be before end date');
      }
      
      // Limit to reasonable range (max 2 years)
      const maxDuration = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
      if (end.getTime() - start.getTime() > maxDuration) {
        throw new BadRequestException('Date range cannot exceed 2 years');
      }
    }
  }

  /**
   * Format date as YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}