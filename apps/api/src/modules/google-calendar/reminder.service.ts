import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from '../../infra/database/entities/subject.entity';
import { LocalEvent } from '../../infra/database/entities/local-event.entity';

export interface ReminderSettings {
  enabled: boolean;
  minutes: number;
  method: 'email' | 'popup';
}

export interface SubjectReminderSettings {
  subjectId: string;
  defaultReminder: ReminderSettings;
  customReminders?: ReminderSettings[];
}

export interface UserReminderPreferences {
  userId: string;
  globalDefault: ReminderSettings;
  subjectSettings: Record<string, ReminderSettings>;
}

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  // Default reminder settings
  private readonly DEFAULT_REMINDER: ReminderSettings = {
    enabled: true,
    minutes: 15,
    method: 'popup'
  };

  constructor(
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
    @InjectRepository(LocalEvent)
    private readonly localEventRepository: Repository<LocalEvent>,
  ) {}

  /**
   * Get user's reminder preferences
   */
  async getUserReminderPreferences(userId: string): Promise<UserReminderPreferences> {
    // For now, we'll store preferences in the subject metadata
    // In a full implementation, this would be a separate table
    const subjects = await this.subjectRepository.find({
      where: { userId },
      select: ['id', 'name', 'meta']
    });

    const subjectSettings: Record<string, ReminderSettings> = {};
    
    subjects.forEach(subject => {
      const reminderSettings = subject.meta?.reminderSettings;
      if (reminderSettings) {
        subjectSettings[subject.id] = reminderSettings;
      }
    });

    return {
      userId,
      globalDefault: this.DEFAULT_REMINDER,
      subjectSettings
    };
  }

  /**
   * Update reminder preferences for a user
   */
  async updateUserReminderPreferences(
    userId: string, 
    preferences: Partial<UserReminderPreferences>
  ): Promise<UserReminderPreferences> {
    // Update subject-specific settings
    if (preferences.subjectSettings) {
      for (const [subjectId, settings] of Object.entries(preferences.subjectSettings)) {
        await this.updateSubjectReminderSettings(userId, subjectId, settings);
      }
    }

    return this.getUserReminderPreferences(userId);
  }

  /**
   * Update reminder settings for a specific subject
   */
  async updateSubjectReminderSettings(
    userId: string,
    subjectId: string,
    settings: ReminderSettings
  ): Promise<void> {
    const subject = await this.subjectRepository.findOne({
      where: { id: subjectId, userId }
    });

    if (!subject) {
      throw new Error(`Subject ${subjectId} not found for user ${userId}`);
    }

    // Update subject metadata with reminder settings
    const updatedMeta = {
      ...subject.meta,
      reminderSettings: settings
    };

    await this.subjectRepository.update(subjectId, {
      meta: updatedMeta
    });

    this.logger.debug(`Updated reminder settings for subject ${subjectId}: ${JSON.stringify(settings)}`);
  }

  /**
   * Get reminder settings for a specific event
   */
  async getEventReminderSettings(eventId: string): Promise<ReminderSettings[]> {
    const event = await this.localEventRepository.findOne({
      where: { id: eventId },
      relations: ['subject']
    });

    if (!event) {
      return [this.DEFAULT_REMINDER];
    }

    // Check if subject has custom reminder settings
    const subjectReminderSettings = event.subject?.meta?.reminderSettings;
    if (subjectReminderSettings) {
      return [subjectReminderSettings];
    }

    // Fall back to default
    return [this.DEFAULT_REMINDER];
  }

  /**
   * Get reminder settings for multiple events
   */
  async getEventsReminderSettings(eventIds: string[]): Promise<Record<string, ReminderSettings[]>> {
    const events = await this.localEventRepository.find({
      where: { id: { $in: eventIds } as any },
      relations: ['subject']
    });

    const reminderSettings: Record<string, ReminderSettings[]> = {};

    for (const event of events) {
      const settings = await this.getEventReminderSettings(event.id);
      reminderSettings[event.id] = settings;
    }

    return reminderSettings;
  }

  /**
   * Format reminder settings for Google Calendar API
   */
  formatRemindersForGoogle(reminderSettings: ReminderSettings[]): any {
    if (!reminderSettings || reminderSettings.length === 0) {
      return { useDefault: false };
    }

    const enabledReminders = reminderSettings.filter(r => r.enabled);
    
    if (enabledReminders.length === 0) {
      return { useDefault: false };
    }

    return {
      useDefault: false,
      overrides: enabledReminders.map(reminder => ({
        method: reminder.method,
        minutes: reminder.minutes
      }))
    };
  }

  /**
   * Get default reminder settings for a subject
   */
  async getSubjectDefaultReminder(subjectId: string): Promise<ReminderSettings> {
    const subject = await this.subjectRepository.findOne({
      where: { id: subjectId },
      select: ['meta']
    });

    if (subject?.meta?.reminderSettings) {
      return subject.meta.reminderSettings;
    }

    return this.DEFAULT_REMINDER;
  }

  /**
   * Apply reminder settings to Google Calendar event data
   */
  async applyRemindersToGoogleEvent(eventData: any, localEventId: string): Promise<any> {
    const reminderSettings = await this.getEventReminderSettings(localEventId);
    const googleReminders = this.formatRemindersForGoogle(reminderSettings);

    return {
      ...eventData,
      reminders: googleReminders
    };
  }

  /**
   * Bulk update reminder settings for all events of a subject
   */
  async updateSubjectEventsReminders(
    userId: string,
    subjectId: string,
    reminderSettings: ReminderSettings
  ): Promise<{ updated: number; failed: number }> {
    // First update the subject's default reminder settings
    await this.updateSubjectReminderSettings(userId, subjectId, reminderSettings);

    // Get all events for this subject that are synced to Google
    const events = await this.localEventRepository.find({
      where: { 
        userId, 
        subjectId,
        status: 'synced',
        gcalEventId: { $ne: null } as any
      }
    });

    let updated = 0;
    let failed = 0;

    // Note: In a full implementation, this would trigger a background job
    // to update all Google Calendar events with the new reminder settings
    for (const event of events) {
      try {
        // Mark event as needing sync update
        await this.localEventRepository.update(event.id, {
          // Add a flag to indicate reminders need updating
          meta: {
            ...event.meta,
            remindersNeedUpdate: true
          }
        });
        updated++;
      } catch (error) {
        this.logger.error(`Failed to mark event ${event.id} for reminder update:`, error);
        failed++;
      }
    }

    this.logger.debug(`Marked ${updated} events for reminder update, ${failed} failed`);

    return { updated, failed };
  }

  /**
   * Get reminder presets for UI
   */
  getReminderPresets(): Array<{ label: string; minutes: number; method: 'email' | 'popup' }> {
    return [
      { label: '5 minutes before', minutes: 5, method: 'popup' },
      { label: '10 minutes before', minutes: 10, method: 'popup' },
      { label: '15 minutes before', minutes: 15, method: 'popup' },
      { label: '30 minutes before', minutes: 30, method: 'popup' },
      { label: '1 hour before', minutes: 60, method: 'popup' },
      { label: '2 hours before', minutes: 120, method: 'popup' },
      { label: '1 day before', minutes: 1440, method: 'email' },
      { label: '2 days before', minutes: 2880, method: 'email' },
    ];
  }

  /**
   * Validate reminder settings
   */
  validateReminderSettings(settings: ReminderSettings): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (settings.minutes < 0) {
      errors.push('Reminder minutes cannot be negative');
    }

    if (settings.minutes > 40320) { // 4 weeks in minutes
      errors.push('Reminder cannot be more than 4 weeks before the event');
    }

    if (!['email', 'popup'].includes(settings.method)) {
      errors.push('Reminder method must be either "email" or "popup"');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}