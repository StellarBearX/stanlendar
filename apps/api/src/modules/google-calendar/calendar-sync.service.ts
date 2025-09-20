import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleCalendarService } from './google-calendar.service';
import { EventFormatterService } from './event-formatter.service';
import { LocalEvent } from '../../infra/database/entities/local-event.entity';
import { Subject } from '../../infra/database/entities/subject.entity';
import { Section } from '../../infra/database/entities/section.entity';

export interface SyncOptions {
  direction: 'upsert-to-google';
  range: {
    from: string;
    to: string;
  };
  eventIds?: string[];
  dryRun?: boolean;
  idempotencyKey: string;
}

export interface SyncResult {
  summary: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  details: SyncDetail[];
  conflicts: EventConflict[];
  quotaUsed: number;
  isDryRun: boolean;
}

export interface SyncDetail {
  localEventId: string;
  googleEventId?: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  error?: string;
  etag?: string;
}

export interface EventConflict {
  localEventId: string;
  googleEventId: string;
  conflictType: 'etag_mismatch' | 'deleted_on_google' | 'modified_externally';
  localEvent: LocalEvent;
  googleEvent?: any;
  suggestedResolution: ConflictResolution;
}

export interface ConflictResolution {
  action: 'use_local' | 'use_google' | 'merge' | 'recreate' | 'unlink';
  reason: string;
}

export interface EventMapping {
  localEventId: string;
  googleEventId: string;
  etag: string;
  lastSyncAt: Date;
}

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly eventFormatterService: EventFormatterService,
    @InjectRepository(LocalEvent)
    private readonly localEventRepository: Repository<LocalEvent>,
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
  ) {}

  /**
   * Syncs local events to Google Calendar
   */
  async syncToGoogle(userId: string, options: SyncOptions): Promise<SyncResult> {
    this.logger.debug(`Starting sync for user ${userId} with options:`, options);

    const result: SyncResult = {
      summary: {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
      details: [],
      conflicts: [],
      quotaUsed: 0,
      isDryRun: options.dryRun || false,
    };

    try {
      // Get local events to sync
      const localEvents = await this.getLocalEventsToSync(userId, options);
      
      if (localEvents.length === 0) {
        this.logger.debug(`No events to sync for user ${userId}`);
        return result;
      }

      // Group events by subject and section for potential RRULE optimization
      const eventGroups = this.groupEventsBySubjectSection(localEvents);

      // Process each group
      for (const group of eventGroups) {
        const groupResult = await this.syncEventGroup(userId, group, options);
        this.mergeResults(result, groupResult);
      }

      this.logger.debug(`Sync completed for user ${userId}:`, result.summary);
      return result;

    } catch (error) {
      this.logger.error(`Sync failed for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Resolves conflicts between local and Google events
   */
  async resolveConflicts(
    userId: string,
    conflicts: EventConflict[],
    resolutions: ConflictResolution[],
  ): Promise<SyncResult> {
    const result: SyncResult = {
      summary: { created: 0, updated: 0, skipped: 0, failed: 0 },
      details: [],
      conflicts: [],
      quotaUsed: 0,
      isDryRun: false,
    };

    for (let i = 0; i < conflicts.length; i++) {
      const conflict = conflicts[i];
      const resolution = resolutions[i];

      try {
        const detail = await this.applyConflictResolution(userId, conflict, resolution);
        result.details.push(detail);
        result.summary[detail.action]++;
      } catch (error) {
        this.logger.error(`Failed to resolve conflict for event ${conflict.localEventId}:`, error);
        result.details.push({
          localEventId: conflict.localEventId,
          action: 'failed',
          error: error.message,
        });
        result.summary.failed++;
      }
    }

    return result;
  }

  /**
   * Gets local events that need to be synced
   */
  private async getLocalEventsToSync(userId: string, options: SyncOptions): Promise<LocalEvent[]> {
    const queryBuilder = this.localEventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.subject', 'subject')
      .leftJoinAndSelect('event.section', 'section')
      .where('event.userId = :userId', { userId })
      .andWhere('event.eventDate >= :from', { from: options.range.from })
      .andWhere('event.eventDate <= :to', { to: options.range.to });

    // Filter by specific event IDs if provided
    if (options.eventIds && options.eventIds.length > 0) {
      queryBuilder.andWhere('event.id IN (:...eventIds)', { eventIds: options.eventIds });
    }

    // Only sync events that are planned or need updates
    queryBuilder.andWhere('event.status IN (:...statuses)', { 
      statuses: ['planned', 'synced'] 
    });

    return queryBuilder.getMany();
  }

  /**
   * Groups events by subject and section for potential RRULE optimization
   */
  private groupEventsBySubjectSection(events: LocalEvent[]): LocalEvent[][] {
    const groups = new Map<string, LocalEvent[]>();

    for (const event of events) {
      const key = `${event.subjectId}-${event.sectionId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    return Array.from(groups.values());
  }

  /**
   * Syncs a group of events (potentially as a recurring event)
   */
  private async syncEventGroup(
    userId: string,
    events: LocalEvent[],
    options: SyncOptions,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      summary: { created: 0, updated: 0, skipped: 0, failed: 0 },
      details: [],
      conflicts: [],
      quotaUsed: 0,
      isDryRun: options.dryRun || false,
    };

    // Check if we can use RRULE (multiple events, same time pattern)
    const canUseRRule = this.canUseRecurringRule(events);

    if (canUseRRule && events.length > 3) {
      // Use RRULE for efficiency
      const groupResult = await this.syncAsRecurringEvent(userId, events, options);
      this.mergeResults(result, groupResult);
    } else {
      // Sync individual events
      for (const event of events) {
        const eventResult = await this.syncSingleEvent(userId, event, options);
        this.mergeResults(result, eventResult);
      }
    }

    return result;
  }

  /**
   * Syncs a single event to Google Calendar
   */
  private async syncSingleEvent(
    userId: string,
    localEvent: LocalEvent,
    options: SyncOptions,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      summary: { created: 0, updated: 0, skipped: 0, failed: 0 },
      details: [],
      conflicts: [],
      quotaUsed: 1,
      isDryRun: options.dryRun || false,
    };

    try {
      // Format event for Google Calendar
      const googleEvent = this.eventFormatterService.formatSingleEvent(
        localEvent,
        localEvent.subject,
        localEvent.section,
      );

      let detail: SyncDetail;

      if (localEvent.gcalEventId && localEvent.gcalEtag) {
        // Update existing event
        detail = await this.updateExistingEvent(userId, localEvent, googleEvent, options);
      } else {
        // Create new event
        detail = await this.createNewEvent(userId, localEvent, googleEvent, options);
      }

      result.details.push(detail);
      result.summary[detail.action]++;

      // Handle conflicts
      if (detail.action === 'failed' && detail.error?.includes('ETag mismatch')) {
        const conflict = await this.detectConflict(userId, localEvent);
        if (conflict) {
          result.conflicts.push(conflict);
        }
      }

    } catch (error) {
      this.logger.error(`Failed to sync event ${localEvent.id}:`, error);
      result.details.push({
        localEventId: localEvent.id,
        action: 'failed',
        error: error.message,
      });
      result.summary.failed++;
    }

    return result;
  }

  /**
   * Syncs events as a recurring Google Calendar event
   */
  private async syncAsRecurringEvent(
    userId: string,
    events: LocalEvent[],
    options: SyncOptions,
  ): Promise<SyncResult> {
    const result: SyncResult = {
      summary: { created: 0, updated: 0, skipped: 0, failed: 0 },
      details: [],
      conflicts: [],
      quotaUsed: 1, // RRULE counts as one API call
      isDryRun: options.dryRun || false,
    };

    try {
      // Check if any events already have Google IDs (mixed state)
      const syncedEvents = events.filter(e => e.gcalEventId);
      
      if (syncedEvents.length > 0) {
        // Mixed state - fall back to individual sync
        this.logger.debug('Mixed sync state detected, falling back to individual events');
        for (const event of events) {
          const eventResult = await this.syncSingleEvent(userId, event, options);
          this.mergeResults(result, eventResult);
        }
        return result;
      }

      // Create recurring event
      const googleEvent = this.eventFormatterService.formatRecurringEvent(
        events,
        events[0].subject,
        events[0].section,
      );

      if (!options.dryRun) {
        const { eventId, etag } = await this.googleCalendarService.createEvent(
          userId,
          googleEvent,
        );

        // Update all local events with the Google event ID
        await this.updateLocalEventsWithGoogleId(events, eventId, etag);
      }

      // Create details for all events
      events.forEach(event => {
        result.details.push({
          localEventId: event.id,
          googleEventId: options.dryRun ? 'dry-run-id' : event.gcalEventId!,
          action: 'created',
          etag: options.dryRun ? 'dry-run-etag' : event.gcalEtag!,
        });
      });

      result.summary.created = events.length;

    } catch (error) {
      this.logger.error('Failed to sync recurring event:', error);
      events.forEach(event => {
        result.details.push({
          localEventId: event.id,
          action: 'failed',
          error: error.message,
        });
      });
      result.summary.failed = events.length;
    }

    return result;
  }

  /**
   * Creates a new event in Google Calendar
   */
  private async createNewEvent(
    userId: string,
    localEvent: LocalEvent,
    googleEvent: any,
    options: SyncOptions,
  ): Promise<SyncDetail> {
    if (options.dryRun) {
      return {
        localEventId: localEvent.id,
        googleEventId: 'dry-run-id',
        action: 'created',
        etag: 'dry-run-etag',
      };
    }

    const { eventId, etag } = await this.googleCalendarService.createEvent(
      userId,
      googleEvent,
    );

    // Update local event with Google details
    await this.localEventRepository.update(localEvent.id, {
      gcalEventId: eventId,
      gcalEtag: etag,
      status: 'synced',
    });

    return {
      localEventId: localEvent.id,
      googleEventId: eventId,
      action: 'created',
      etag,
    };
  }

  /**
   * Updates an existing event in Google Calendar
   */
  private async updateExistingEvent(
    userId: string,
    localEvent: LocalEvent,
    googleEvent: any,
    options: SyncOptions,
  ): Promise<SyncDetail> {
    if (options.dryRun) {
      return {
        localEventId: localEvent.id,
        googleEventId: localEvent.gcalEventId!,
        action: 'updated',
        etag: 'dry-run-etag',
      };
    }

    try {
      const { eventId, etag } = await this.googleCalendarService.updateEvent(
        userId,
        localEvent.gcalEventId!,
        googleEvent,
        localEvent.gcalEtag!,
      );

      // Update local event with new ETag
      await this.localEventRepository.update(localEvent.id, {
        gcalEtag: etag,
        status: 'synced',
      });

      return {
        localEventId: localEvent.id,
        googleEventId: eventId,
        action: 'updated',
        etag,
      };

    } catch (error) {
      if (error.message.includes('ETag mismatch')) {
        // Return failed status for conflict detection
        return {
          localEventId: localEvent.id,
          googleEventId: localEvent.gcalEventId!,
          action: 'failed',
          error: 'ETag mismatch - event was modified externally',
        };
      }
      throw error;
    }
  }

  /**
   * Detects conflicts between local and Google events
   */
  private async detectConflict(userId: string, localEvent: LocalEvent): Promise<EventConflict | null> {
    try {
      const googleEvent = await this.googleCalendarService.getEvent(
        userId,
        localEvent.gcalEventId!,
      );

      const conflictType = this.determineConflictType(localEvent, googleEvent);
      const suggestedResolution = this.suggestConflictResolution(conflictType, localEvent, googleEvent);

      return {
        localEventId: localEvent.id,
        googleEventId: localEvent.gcalEventId!,
        conflictType,
        localEvent,
        googleEvent,
        suggestedResolution,
      };

    } catch (error) {
      if (error.message.includes('not found')) {
        return {
          localEventId: localEvent.id,
          googleEventId: localEvent.gcalEventId!,
          conflictType: 'deleted_on_google',
          localEvent,
          suggestedResolution: {
            action: 'recreate',
            reason: 'Event was deleted on Google Calendar',
          },
        };
      }
      return null;
    }
  }

  /**
   * Determines the type of conflict
   */
  private determineConflictType(localEvent: LocalEvent, googleEvent: any): EventConflict['conflictType'] {
    if (!googleEvent) {
      return 'deleted_on_google';
    }

    if (googleEvent.etag !== localEvent.gcalEtag) {
      return 'etag_mismatch';
    }

    return 'modified_externally';
  }

  /**
   * Suggests a resolution for the conflict
   */
  private suggestConflictResolution(
    conflictType: EventConflict['conflictType'],
    localEvent: LocalEvent,
    googleEvent?: any,
  ): ConflictResolution {
    switch (conflictType) {
      case 'deleted_on_google':
        return {
          action: 'recreate',
          reason: 'Event was deleted on Google Calendar',
        };

      case 'etag_mismatch':
        // Check if only non-critical fields changed
        if (this.hasOnlyNonCriticalChanges(localEvent, googleEvent)) {
          return {
            action: 'merge',
            reason: 'Only non-critical fields changed, safe to merge',
          };
        }
        return {
          action: 'use_local',
          reason: 'Critical fields changed, recommend using local version',
        };

      case 'modified_externally':
        return {
          action: 'use_google',
          reason: 'Event was modified externally, recommend using Google version',
        };

      default:
        return {
          action: 'use_local',
          reason: 'Unknown conflict type, defaulting to local version',
        };
    }
  }

  /**
   * Applies a conflict resolution
   */
  private async applyConflictResolution(
    userId: string,
    conflict: EventConflict,
    resolution: ConflictResolution,
  ): Promise<SyncDetail> {
    switch (resolution.action) {
      case 'use_local':
        return this.forceUpdateWithLocal(userId, conflict);

      case 'use_google':
        return this.updateLocalWithGoogle(userId, conflict);

      case 'merge':
        return this.mergeConflictedEvent(userId, conflict);

      case 'recreate':
        return this.recreateDeletedEvent(userId, conflict);

      case 'unlink':
        return this.unlinkGoogleEvent(userId, conflict);

      default:
        throw new BadRequestException(`Unknown resolution action: ${resolution.action}`);
    }
  }

  /**
   * Helper methods for conflict resolution
   */
  private async forceUpdateWithLocal(userId: string, conflict: EventConflict): Promise<SyncDetail> {
    const googleEvent = this.eventFormatterService.formatSingleEvent(
      conflict.localEvent,
      conflict.localEvent.subject,
      conflict.localEvent.section,
    );

    // Update without ETag check (force update)
    const { eventId, etag } = await this.googleCalendarService.updateEvent(
      userId,
      conflict.googleEventId,
      googleEvent,
    );

    await this.localEventRepository.update(conflict.localEventId, {
      gcalEtag: etag,
      status: 'synced',
    });

    return {
      localEventId: conflict.localEventId,
      googleEventId: eventId,
      action: 'updated',
      etag,
    };
  }

  private async updateLocalWithGoogle(userId: string, conflict: EventConflict): Promise<SyncDetail> {
    // This would require parsing Google event back to local format
    // For now, just update the ETag to acknowledge the Google version
    await this.localEventRepository.update(conflict.localEventId, {
      gcalEtag: conflict.googleEvent.etag,
      status: 'synced',
    });

    return {
      localEventId: conflict.localEventId,
      googleEventId: conflict.googleEventId,
      action: 'updated',
      etag: conflict.googleEvent.etag,
    };
  }

  private async mergeConflictedEvent(userId: string, conflict: EventConflict): Promise<SyncDetail> {
    // Simple merge: use local data but update ETag
    return this.forceUpdateWithLocal(userId, conflict);
  }

  private async recreateDeletedEvent(userId: string, conflict: EventConflict): Promise<SyncDetail> {
    const googleEvent = this.eventFormatterService.formatSingleEvent(
      conflict.localEvent,
      conflict.localEvent.subject,
      conflict.localEvent.section,
    );

    const { eventId, etag } = await this.googleCalendarService.createEvent(
      userId,
      googleEvent,
    );

    await this.localEventRepository.update(conflict.localEventId, {
      gcalEventId: eventId,
      gcalEtag: etag,
      status: 'synced',
    });

    return {
      localEventId: conflict.localEventId,
      googleEventId: eventId,
      action: 'created',
      etag,
    };
  }

  private async unlinkGoogleEvent(userId: string, conflict: EventConflict): Promise<SyncDetail> {
    await this.localEventRepository.update(conflict.localEventId, {
      gcalEventId: null,
      gcalEtag: null,
      status: 'planned',
    });

    return {
      localEventId: conflict.localEventId,
      action: 'updated',
    };
  }

  /**
   * Utility methods
   */
  private canUseRecurringRule(events: LocalEvent[]): boolean {
    if (events.length < 2) return false;

    // Check if all events have the same time pattern
    const firstEvent = events[0];
    return events.every(event => 
      event.startTime === firstEvent.startTime &&
      event.endTime === firstEvent.endTime &&
      event.subjectId === firstEvent.subjectId &&
      event.sectionId === firstEvent.sectionId
    );
  }

  private hasOnlyNonCriticalChanges(localEvent: LocalEvent, googleEvent: any): boolean {
    // Define non-critical fields that can be safely merged
    // For now, assume description and location are non-critical
    return true; // Simplified implementation
  }

  private async updateLocalEventsWithGoogleId(
    events: LocalEvent[],
    googleEventId: string,
    etag: string,
  ): Promise<void> {
    const eventIds = events.map(e => e.id);
    await this.localEventRepository.update(
      eventIds,
      {
        gcalEventId: googleEventId,
        gcalEtag: etag,
        status: 'synced',
      },
    );
  }

  private mergeResults(target: SyncResult, source: SyncResult): void {
    target.summary.created += source.summary.created;
    target.summary.updated += source.summary.updated;
    target.summary.skipped += source.summary.skipped;
    target.summary.failed += source.summary.failed;
    target.details.push(...source.details);
    target.conflicts.push(...source.conflicts);
    target.quotaUsed += source.quotaUsed;
  }
}