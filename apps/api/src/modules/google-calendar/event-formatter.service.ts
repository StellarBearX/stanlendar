import { Injectable } from '@nestjs/common';
import { LocalEvent } from '../../infra/database/entities/local-event.entity';
import { Subject } from '../../infra/database/entities/subject.entity';
import { Section } from '../../infra/database/entities/section.entity';
import { GoogleCalendarEvent } from './google-calendar.service';

export interface EventFormattingOptions {
  includeReminders?: boolean;
  defaultReminderMinutes?: number;
  useRecurrence?: boolean;
  timezone?: string;
}

export interface RRuleOptions {
  frequency: 'WEEKLY';
  interval: number;
  byDay: string[];
  until?: string;
  count?: number;
}

export interface ColorMapping {
  id: string;
  hex: string;
}

@Injectable()
export class EventFormatterService {
  private readonly timezone = 'Asia/Bangkok';
  
  // Google Calendar color palette
  private readonly googleColorPalette: ColorMapping[] = [
    { id: '1', hex: '#a4bdfc' }, // Lavender
    { id: '2', hex: '#7ae7bf' }, // Sage
    { id: '3', hex: '#dbadff' }, // Grape
    { id: '4', hex: '#ff887c' }, // Flamingo
    { id: '5', hex: '#fbd75b' }, // Banana
    { id: '6', hex: '#ffb878' }, // Tangerine
    { id: '7', hex: '#46d6db' }, // Peacock
    { id: '8', hex: '#e1e1e1' }, // Graphite
    { id: '9', hex: '#5484ed' }, // Blueberry
    { id: '10', hex: '#51b749' }, // Basil
    { id: '11', hex: '#dc2127' }, // Tomato
  ];

  /**
   * Formats a local event into a Google Calendar event
   */
  formatSingleEvent(
    localEvent: LocalEvent,
    subject: Subject,
    section: Section,
    options: EventFormattingOptions = {},
  ): GoogleCalendarEvent {
    const {
      includeReminders = true,
      defaultReminderMinutes = 15,
      timezone = this.timezone,
    } = options;

    // Create event title
    const summary = this.createEventTitle(subject, section);
    
    // Create description
    const description = this.createEventDescription(subject, section, localEvent);
    
    // Format date and time
    const startDateTime = this.formatDateTime(localEvent.eventDate, localEvent.startTime, timezone);
    const endDateTime = this.formatDateTime(localEvent.eventDate, localEvent.endTime, timezone);
    
    // Map color
    const colorId = this.mapSubjectColorToGoogle(subject.colorHex);

    const googleEvent: GoogleCalendarEvent = {
      summary,
      description,
      location: localEvent.room || section.room || '',
      start: {
        dateTime: startDateTime,
        timeZone: timezone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: timezone,
      },
      colorId,
    };

    // Add reminders if requested
    if (includeReminders) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: [
          {
            method: 'popup',
            minutes: defaultReminderMinutes,
          },
        ],
      };
    }

    return googleEvent;
  }

  /**
   * Formats a recurring event with RRULE for weekly classes
   */
  formatRecurringEvent(
    localEvents: LocalEvent[],
    subject: Subject,
    section: Section,
    options: EventFormattingOptions = {},
  ): GoogleCalendarEvent {
    if (localEvents.length === 0) {
      throw new Error('Cannot create recurring event from empty event list');
    }

    // Sort events by date to get the first occurrence
    const sortedEvents = localEvents.sort((a, b) => 
      new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );
    
    const firstEvent = sortedEvents[0];
    const lastEvent = sortedEvents[sortedEvents.length - 1];

    const {
      includeReminders = true,
      defaultReminderMinutes = 15,
      timezone = this.timezone,
    } = options;

    // Create base event
    const baseEvent = this.formatSingleEvent(firstEvent, subject, section, {
      ...options,
      useRecurrence: false,
    });

    // Generate RRULE
    const rrule = this.generateRRule(localEvents, lastEvent.eventDate);
    
    // Add recurrence rule
    baseEvent.recurrence = [rrule];

    return baseEvent;
  }

  /**
   * Generates RRULE string for recurring weekly classes
   */
  generateRRule(events: LocalEvent[], endDate: Date): string {
    // Group events by day of week to determine pattern
    const dayMap = new Map<number, LocalEvent[]>();
    
    events.forEach(event => {
      const dayOfWeek = new Date(event.eventDate).getDay();
      if (!dayMap.has(dayOfWeek)) {
        dayMap.set(dayOfWeek, []);
      }
      dayMap.get(dayOfWeek)!.push(event);
    });

    // Convert JavaScript day (0=Sunday) to RRULE day format
    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const byDay = Array.from(dayMap.keys())
      .sort()
      .map(day => dayNames[day]);

    // Format end date for UNTIL parameter
    const untilDate = this.formatDateForRRule(endDate);

    // Build RRULE string
    const rruleParts = [
      'FREQ=WEEKLY',
      'INTERVAL=1',
      `BYDAY=${byDay.join(',')}`,
      `UNTIL=${untilDate}`,
    ];

    return `RRULE:${rruleParts.join(';')}`;
  }

  /**
   * Maps subject color to closest Google Calendar color
   */
  mapSubjectColorToGoogle(subjectColorHex: string): string {
    const subjectRgb = this.hexToRgb(subjectColorHex);
    
    let minDistance = Infinity;
    let closestColorId = '1'; // Default to lavender

    for (const color of this.googleColorPalette) {
      const googleRgb = this.hexToRgb(color.hex);
      const distance = this.calculateColorDistance(subjectRgb, googleRgb);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestColorId = color.id;
      }
    }

    return closestColorId;
  }

  /**
   * Creates event title in format: "SUBJECT_CODE SUBJECT_NAME (SEC)"
   */
  private createEventTitle(subject: Subject, section: Section): string {
    const parts = [];
    
    if (subject.code) {
      parts.push(subject.code);
    }
    
    parts.push(subject.name);
    
    if (section.secCode) {
      parts.push(`(${section.secCode})`);
    }

    return parts.join(' ');
  }

  /**
   * Creates event description with additional details
   */
  private createEventDescription(
    subject: Subject,
    section: Section,
    localEvent: LocalEvent,
  ): string {
    const parts = [];

    if (section.teacher) {
      parts.push(`Teacher: ${section.teacher}`);
    }

    if (localEvent.room || section.room) {
      parts.push(`Room: ${localEvent.room || section.room}`);
    }

    if (subject.meta && typeof subject.meta === 'object') {
      Object.entries(subject.meta).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          parts.push(`${key}: ${value}`);
        }
      });
    }

    return parts.join('\n');
  }

  /**
   * Formats date and time for Google Calendar API
   */
  private formatDateTime(date: Date, time: string, timezone: string): string {
    // Parse time (format: "HH:mm")
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create datetime object using the date components to avoid timezone issues
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    const dateTime = new Date(year, month, day, hours, minutes, 0, 0);
    
    // Return ISO string without Z (Google Calendar expects local time format)
    return dateTime.toISOString().replace('Z', '');
  }

  /**
   * Formats date for RRULE UNTIL parameter (YYYYMMDDTHHMMSSZ)
   */
  private formatDateForRRule(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Set to end of day (23:59:59)
    return `${year}${month}${day}T235959Z`;
  }

  /**
   * Converts hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    
    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);
    
    return { r, g, b };
  }

  /**
   * Calculates Euclidean distance between two RGB colors
   */
  private calculateColorDistance(
    rgb1: { r: number; g: number; b: number },
    rgb2: { r: number; g: number; b: number },
  ): number {
    const rDiff = rgb1.r - rgb2.r;
    const gDiff = rgb1.g - rgb2.g;
    const bDiff = rgb1.b - rgb2.b;
    
    return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
  }

  /**
   * Gets all available Google Calendar colors
   */
  getAvailableColors(): ColorMapping[] {
    return [...this.googleColorPalette];
  }

  /**
   * Validates RRULE string format
   */
  validateRRule(rrule: string): boolean {
    // Basic RRULE validation
    const requiredParts = ['FREQ=WEEKLY'];
    return requiredParts.every(part => rrule.includes(part));
  }
}