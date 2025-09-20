# Requirements Document

## Introduction

A class schedule management system that allows students to organize their academic timetables with easy filtering capabilities and automatic synchronization with Google Calendar. The system focuses on providing a clean, searchable interface for managing course schedules while maintaining seamless integration with users' existing Google Calendar workflows without locking them into the application.

## Requirements

### Requirement 1

**User Story:** As a student, I want to sign in with my Google account and connect my calendar, so that I can sync my class schedule without creating another account.

#### Acceptance Criteria

1. WHEN a user clicks "Sign in with Google" THEN the system SHALL redirect to Google OAuth2 with appropriate scopes (openid, email, profile, calendar.events)
2. WHEN Google OAuth returns with authorization code THEN the system SHALL exchange it for access and refresh tokens
3. WHEN tokens are received THEN the system SHALL store them encrypted in the database with user profile information
4. IF token refresh is needed THEN the system SHALL automatically refresh using the stored refresh token
5. WHEN authentication is complete THEN the system SHALL redirect user to the main dashboard

### Requirement 2

**User Story:** As a student, I want to view my class schedule in a calendar format with color coding by subject, so that I can easily visualize my weekly/monthly schedule.

#### Acceptance Criteria

1. WHEN user accesses the dashboard THEN the system SHALL display a calendar view with Month/Week/Agenda options
2. WHEN classes are displayed THEN the system SHALL color-code events by subject using user-defined colors
3. WHEN user switches between Month/Week/Agenda views THEN the system SHALL maintain the current date context
4. WHEN events are rendered THEN the system SHALL display subject code, name, section, time, and room information
5. IF no classes exist THEN the system SHALL display an empty state with options to add classes

### Requirement 3

**User Story:** As a student, I want to filter my schedule using Spotlight search by subject, section, room, or instructor, so that I can quickly find specific classes.

#### Acceptance Criteria

1. WHEN user types in the Spotlight filter THEN the system SHALL search across subject names, section codes, room numbers, and instructor names
2. WHEN filter is applied THEN the system SHALL highlight matching events and dim/hide non-matching ones
3. WHEN user selects subject chips THEN the system SHALL filter to show only those subjects
4. WHEN user selects section codes THEN the system SHALL filter to show only those sections
5. WHEN user clears filters THEN the system SHALL restore full calendar view
6. WHEN multiple filters are applied THEN the system SHALL use AND logic between different filter types

### Requirement 4

**User Story:** As a student, I want to quickly add individual classes with basic information, so that I can build my schedule without complex forms.

#### Acceptance Criteria

1. WHEN user clicks "Quick Add Class" THEN the system SHALL display a short form with essential fields
2. WHEN user fills required fields (subject name, section, day, time, room, date range) THEN the system SHALL validate the input
3. WHEN user submits the form THEN the system SHALL create a new subject and section if they don't exist
4. WHEN class is created THEN the system SHALL generate recurring local events based on the schedule rules
5. IF user specifies skip weeks THEN the system SHALL exclude those dates from the recurring pattern
6. WHEN class is saved THEN the system SHALL display it immediately in the calendar view

### Requirement 5

**User Story:** As a student, I want to import my entire semester schedule from a CSV/XLSX file, so that I can set up all my classes at once instead of entering them individually.

#### Acceptance Criteria

1. WHEN user uploads a CSV/XLSX file THEN the system SHALL parse and display a preview of the data
2. WHEN preview is shown THEN the system SHALL allow user to map columns to required fields
3. WHEN user confirms the mapping THEN the system SHALL validate all rows for required data
4. WHEN user applies the import THEN the system SHALL create subjects, sections, and local events in batch
5. IF duplicate subjects/sections exist THEN the system SHALL merge or update existing records
6. WHEN import is complete THEN the system SHALL display a summary of created/updated/skipped items
7. IF import errors occur THEN the system SHALL show detailed error messages for failed rows

### Requirement 6

**User Story:** As a student, I want to sync my local schedule to Google Calendar on-demand, so that I can access my classes from any calendar application.

#### Acceptance Criteria

1. WHEN user clicks "Sync to Google Calendar" THEN the system SHALL create/update events in their Google Calendar
2. WHEN creating events THEN the system SHALL use RRULE for recurring weekly classes to minimize API calls
3. WHEN events are created THEN the system SHALL store Google event IDs and ETags for future updates
4. IF conflicts exist (outdated ETags) THEN the system SHALL fetch latest event data and prompt user to resolve
5. WHEN sync is complete THEN the system SHALL display summary of created/updated/failed events
6. IF rate limits are hit THEN the system SHALL implement backoff and retry logic
7. WHEN events are synced THEN the system SHALL maintain bidirectional mapping between local and Google events

### Requirement 7

**User Story:** As a student, I want automatic reminders for my classes, so that I don't miss important sessions.

#### Acceptance Criteria

1. WHEN events are synced to Google Calendar THEN the system SHALL set default 15-minute reminders
2. WHEN user modifies reminder settings for a subject THEN the system SHALL apply to all future events of that subject
3. WHEN reminder preferences are changed THEN the system SHALL update existing Google Calendar events
4. IF user disables reminders THEN the system SHALL remove reminder settings from Google events
5. WHEN new classes are added THEN the system SHALL apply the default or subject-specific reminder settings

### Requirement 8

**User Story:** As a student, I want to save frequently used filter combinations, so that I can quickly view specific subsets of my schedule.

#### Acceptance Criteria

1. WHEN user applies multiple filters THEN the system SHALL offer option to save the filter combination
2. WHEN user saves a filter THEN the system SHALL store the filter criteria with a user-defined name
3. WHEN user selects a saved filter THEN the system SHALL apply all stored criteria to the calendar view
4. WHEN user manages saved filters THEN the system SHALL allow editing and deleting of saved combinations
5. IF saved filter references deleted subjects/sections THEN the system SHALL handle gracefully and notify user

### Requirement 9

**User Story:** As a student, I want the system to handle timezone consistently, so that my class times are always displayed correctly.

#### Acceptance Criteria

1. WHEN any time data is processed THEN the system SHALL use Asia/Bangkok timezone consistently
2. WHEN events are created in Google Calendar THEN the system SHALL include proper timezone information
3. WHEN displaying times in the UI THEN the system SHALL show times in the user's local timezone context
4. IF system detects timezone conflicts THEN the system SHALL log warnings and maintain Asia/Bangkok as primary
5. WHEN importing data with different timezone formats THEN the system SHALL convert to Asia/Bangkok standard

### Requirement 10

**User Story:** As a student, I want my data to be secure and private, so that my academic information is protected.

#### Acceptance Criteria

1. WHEN storing Google tokens THEN the system SHALL encrypt them at rest in the database
2. WHEN making API calls THEN the system SHALL use HTTPS for all communications
3. WHEN handling OAuth flow THEN the system SHALL implement state parameter and PKCE for security
4. WHEN accessing user data THEN the system SHALL verify user ownership of all resources
5. IF authentication fails THEN the system SHALL clear any cached credentials and redirect to login
6. WHEN user logs out THEN the system SHALL invalidate session and clear client-side data