// User and Authentication Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface CalendarAccount {
  id: string;
  userId: string;
  provider: 'google';
  googleSub: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  tokenExpiresAt: Date;
  primaryCalendarId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Subject and Section Types
export interface Subject {
  id: string;
  userId: string;
  code?: string;
  name: string;
  colorHex: string;
  meta?: Record<string, any>;
  createdAt: Date;
}

export interface Section {
  id: string;
  subjectId: string;
  secCode: string;
  teacher?: string;
  room?: string;
  scheduleRules: ScheduleRule[];
}

export interface ScheduleRule {
  dayOfWeek: number; // 1=Monday, 7=Sunday
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  skipDates?: string[]; // YYYY-MM-DD format
}

// Event Types
export interface LocalEvent {
  id: string;
  userId: string;
  subjectId: string;
  sectionId: string;
  eventDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  room?: string;
  titleOverride?: string;
  status: 'planned' | 'synced' | 'deleted';
  gcalEventId?: string;
  gcalEtag?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Spotlight Filter Types
export interface SpotlightQuery {
  subjectIds?: string[];
  secCodes?: string[];
  text?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  viewMode?: 'hide_others' | 'dim_others';
}

export interface SavedFilter {
  id: string;
  userId: string;
  name: string;
  query: SpotlightQuery;
}

// Import Types
export interface ImportJob {
  id: string;
  userId: string;
  sourceType: 'csv' | 'xlsx';
  columnMap?: Record<string, string>;
  state: 'pending' | 'preview' | 'applied' | 'failed';
  errorMessage?: string;
  createdAt: Date;
}

export interface ImportItem {
  id: string;
  importJobId: string;
  rawRow: Record<string, any>;
  subjectId?: string;
  sectionId?: string;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  note?: string;
  status: 'preview' | 'created' | 'skipped' | 'failed';
}

// API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface SyncRequest {
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
  gcalEventId?: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  error?: string;
}

export interface EventConflict {
  localEventId: string;
  gcalEventId: string;
  conflictType: 'etag_mismatch' | 'deleted_remote' | 'time_conflict';
  localEvent: LocalEvent;
  remoteEvent?: any;
}

// Google Calendar Types
export interface GoogleCalendarEvent {
  summary: string;
  location?: string;
  description?: string;
  start: {
    dateTime: string;
  };
  end: {
    dateTime: string;
  };
  recurrence?: string[];
  colorId?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

// Authentication Types
export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface TokenResult {
  accessToken: string;
  refreshToken?: string;
}