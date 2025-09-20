# Implementation Plan

- [x] 1. Project Setup and Core Infrastructure
  - Set up monorepo structure with Next.js frontend and NestJS backend
  - Configure TypeScript, ESLint, and Prettier for both apps
  - Set up PostgreSQL database with TypeORM and initial migration
  - Configure Redis for caching and session management
  - Set up environment configuration and validation
  - _Requirements: All requirements depend on proper infrastructure_

- [x] 2. Database Schema and Models Implementation
- [x] 2.1 Create database entities and migrations
  - Implement User, CalendarAccount, Subject, Section, LocalEvent entities with TypeORM
  - Create database migration files with proper constraints and indexes
  - Add unique constraints for data integrity (user+subject+name, subject+section, etc.)
  - Write unit tests for entity validation and relationships
  - _Requirements: 1.3, 2.1, 4.3, 5.4, 6.2_

- [x] 2.2 Implement repository pattern and basic CRUD operations
  - Create repository interfaces and implementations for all entities
  - Add database connection pooling and error handling
  - Implement soft delete functionality for LocalEvent status management
  - Write integration tests for repository operations
  - _Requirements: 4.3, 5.4, 6.2, 8.2_

- [x] 3. Authentication and Security Foundation
- [x] 3.1 Implement Google OAuth2 with PKCE
  - Set up Google OAuth2 strategy with Passport.js
  - Implement PKCE flow with state parameter validation
  - Create OAuth callback handler and token exchange logic
  - Write unit tests for OAuth flow components
  - _Requirements: 1.1, 1.2, 1.4, 10.3_

- [x] 3.2 Implement JWT token management and encryption
  - Create CryptoService for AES-256-GCM token encryption
  - Implement JWT access/refresh token generation with rotation
  - Add refresh token reuse detection for security
  - Create AuthGuard for protecting API endpoints
  - Write security tests for token handling
  - _Requirements: 1.2, 1.4, 10.1, 10.2, 10.5_

- [x] 3.3 Implement session management and middleware
  - Set up Redis-based session storage
  - Create authentication middleware for request validation
  - Implement rate limiting and security headers
  - Add CORS configuration for frontend integration
  - Write integration tests for authentication flow
  - _Requirements: 1.1, 1.5, 10.4, 10.6_

- [x] 4. Core Subject and Section Management
- [x] 4.1 Implement Subject CRUD operations
  - Create SubjectService with validation and business logic
  - Implement Subject controller with proper error handling
  - Add color validation and normalization logic
  - Create API endpoints for subject management
  - Write unit and integration tests for subject operations
  - _Requirements: 4.2, 4.3, 4.4, 8.2_

- [x] 4.2 Implement Section management with schedule rules
  - Create SectionService with schedule rule validation
  - Implement section creation with time/day validation
  - Add schedule rule parsing and normalization
  - Create section CRUD API endpoints
  - Write tests for schedule rule validation and edge cases
  - _Requirements: 4.2, 4.3, 4.4, 9.1, 9.2_

- [x] 4.3 Implement local event generation from sections
  - Create EventGenerationService for recurring event creation
  - Implement RRULE-based event generation logic
  - Add skip date handling and exception management
  - Create API endpoint for generating events from sections
  - Write tests for event generation with various schedule patterns
  - _Requirements: 4.4, 4.5, 6.2, 9.1, 9.3_

- [x] 5. Google Calendar Integration Core
- [x] 5.1 Implement Google Calendar API client
  - Create GoogleCalendarService with proper authentication
  - Implement token refresh logic with error handling
  - Add rate limiting and quota management
  - Create batch operation support for API efficiency
  - Write unit tests with mocked Google API responses
  - _Requirements: 6.1, 6.3, 6.6, 7.1_

- [x] 5.2 Implement calendar event creation and RRULE handling
  - Create event formatting logic for Google Calendar
  - Implement RRULE generation for recurring weekly classes
  - Add Google color mapping from subject colors
  - Create single event creation with proper error handling
  - Write tests for event formatting and RRULE generation
  - _Requirements: 6.2, 6.3, 7.1, 7.3_

- [x] 5.3 Implement sync service with conflict resolution
  - Create CalendarSyncService with ETag-based conflict detection
  - Implement bidirectional mapping between local and Google events
  - Add conflict resolution logic for outdated ETags
  - Create sync summary reporting and error handling
  - Write integration tests for sync operations and conflict scenarios
  - _Requirements: 6.1, 6.3, 6.4, 6.5_

- [x] 6. Idempotency and Job Processing
- [x] 6.1 Implement idempotency service
  - Create IdempotencyService with Redis-based deduplication
  - Add idempotency key validation and TTL management
  - Implement request fingerprinting for duplicate detection
  - Create middleware for automatic idempotency handling
  - Write tests for idempotency scenarios and edge cases
  - _Requirements: 6.5, 6.6_

- [x] 6.2 Implement background job processing with Bull
  - Set up Bull queue configuration with Redis
  - Create job processors for sync operations
  - Implement retry logic with exponential backoff
  - Add job monitoring and failure handling
  - Write tests for job processing and retry scenarios
  - _Requirements: 6.5, 6.6_

- [x] 7. Frontend Calendar Dashboard
- [x] 7.1 Create Next.js app structure and routing
  - Set up Next.js 14 with App Router
  - Configure Tailwind CSS and component structure
  - Create authentication pages and protected routes
  - Set up TanStack Query for API state management
  - Write component tests with React Testing Library
  - _Requirements: 2.1, 2.3, 2.5_

- [x] 7.2 Implement FullCalendar integration
  - Create CalendarDashboard component with FullCalendar
  - Implement month/week/agenda view switching
  - Add event rendering with subject color coding
  - Create event click handlers and tooltips
  - Write tests for calendar component interactions
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7.3 Implement authentication UI and Google OAuth flow
  - Create login page with Google Sign-in button
  - Implement OAuth callback handling in frontend
  - Add authentication state management with Zustand
  - Create protected route wrapper components
  - Write E2E tests for authentication flow
  - _Requirements: 1.1, 1.5_

- [ ] 8. Spotlight Filter System
- [ ] 8.1 Implement backend filter query processing
  - Create SpotlightService with full-text search capabilities
  - Implement PostgreSQL tsvector search for subjects/rooms/teachers
  - Add filter combination logic (AND/OR operations)
  - Create optimized database queries with proper indexing
  - Write performance tests for filter queries with large datasets
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [ ] 8.2 Create Spotlight filter UI components
  - Create SpotlightFilter component with search input
  - Implement subject/section chip selection interface
  - Add filter mode toggle (hide/dim others)
  - Create real-time filter application with debouncing
  - Write component tests for filter interactions
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [ ] 8.3 Implement saved filters functionality
  - Create SavedFilter entity and repository
  - Implement filter saving and loading API endpoints
  - Add saved filter management UI
  - Create filter sharing and export capabilities
  - Write tests for saved filter persistence and retrieval
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 9. Quick Add Class Feature
- [ ] 9.1 Create Quick Add form component
  - Design and implement QuickAddClass form with validation
  - Add time picker and day selection components
  - Implement date range picker for semester dates
  - Create form validation with proper error messages
  - Write component tests for form validation and submission
  - _Requirements: 4.1, 4.2, 4.3, 9.1, 9.2_

- [ ] 9.2 Implement Quick Add backend processing
  - Create QuickAddService with input validation
  - Implement subject/section creation or lookup logic
  - Add event generation from quick add data
  - Create API endpoint with proper error handling
  - Write integration tests for quick add scenarios
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 9.1, 9.4_

- [ ] 10. CSV/XLSX Import System
- [ ] 10.1 Implement file upload and parsing
  - Create file upload component with drag-and-drop
  - Implement CSV/XLSX parsing with proper error handling
  - Add column detection and data type validation
  - Create import job creation and tracking
  - Write tests for various file formats and edge cases
  - _Requirements: 5.1, 5.3, 5.6_

- [ ] 10.2 Create import preview and column mapping
  - Design ImportPreview component with data table
  - Implement column mapping interface with dropdowns
  - Add data validation preview with error highlighting
  - Create mapping save and load functionality
  - Write tests for column mapping and validation scenarios
  - _Requirements: 5.1, 5.2, 5.3, 5.7_

- [ ] 10.3 Implement batch import processing
  - Create ImportService with batch processing logic
  - Implement subject/section creation from import data
  - Add duplicate detection and merge logic
  - Create import summary reporting with detailed results
  - Write integration tests for large import scenarios
  - _Requirements: 5.4, 5.5, 5.6, 5.7_

- [ ] 11. Calendar Synchronization Features
- [ ] 11.1 Create sync UI and controls
  - Design sync button and progress indicators
  - Implement sync options (date range, dry run)
  - Add sync history and status display
  - Create conflict resolution UI for user decisions
  - Write tests for sync UI interactions
  - _Requirements: 6.1, 6.5_

- [ ] 11.2 Implement reminder management
  - Create ReminderService for Google Calendar reminders
  - Implement default and per-subject reminder settings
  - Add reminder configuration UI
  - Create reminder sync with Google Calendar events
  - Write tests for reminder functionality
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 12. Error Handling and User Experience
- [ ] 12.1 Implement comprehensive error handling
  - Create GlobalExceptionFilter for consistent error responses
  - Add user-friendly error messages and recovery suggestions
  - Implement offline detection and queue management
  - Create error boundary components for React
  - Write tests for error scenarios and recovery flows
  - _Requirements: 6.4, 6.6, 10.5_

- [ ] 12.2 Add loading states and optimistic updates
  - Implement loading spinners and skeleton screens
  - Add optimistic updates for better perceived performance
  - Create toast notifications for user feedback
  - Implement retry mechanisms for failed operations
  - Write tests for loading states and user feedback
  - _Requirements: 2.5, 6.5_

- [ ] 13. Security Hardening and Performance
- [ ] 13.1 Implement security middleware and validation
  - Add input sanitization and validation pipes
  - Implement CSRF protection for state-changing operations
  - Add security headers and CSP configuration
  - Create audit logging for sensitive operations
  - Write security tests and penetration testing scenarios
  - _Requirements: 10.1, 10.2, 10.4, 10.6_

- [ ] 13.2 Optimize performance and caching
  - Implement Redis caching for frequently accessed data
  - Add database query optimization and connection pooling
  - Create frontend code splitting and lazy loading
  - Implement virtual scrolling for large event lists
  - Write performance tests and benchmarking
  - _Requirements: 2.3, 3.6_

- [ ] 14. Testing and Quality Assurance
- [ ] 14.1 Create comprehensive test suite
  - Write unit tests for all services and components
  - Implement integration tests for API endpoints
  - Create E2E tests for critical user journeys
  - Add performance and load testing scenarios
  - Set up continuous integration and test automation
  - _Requirements: All requirements need proper test coverage_

- [ ] 14.2 Implement monitoring and observability
  - Set up structured logging with correlation IDs
  - Add application metrics and health checks
  - Implement error tracking and alerting
  - Create performance monitoring and dashboards
  - Write monitoring tests and alert validation
  - _Requirements: 6.6, 10.6_

- [ ] 15. Deployment and Production Setup
- [ ] 15.1 Configure production deployment
  - Set up Vercel deployment for Next.js frontend
  - Configure Railway/Render deployment for NestJS backend
  - Set up Supabase PostgreSQL with proper security
  - Configure Redis Cloud with persistence
  - Create environment-specific configuration management
  - _Requirements: 9.1, 9.2, 10.1, 10.2_

- [ ] 15.2 Final integration and acceptance testing
  - Run complete E2E test suite in production environment
  - Perform security audit and vulnerability assessment
  - Execute performance benchmarking and optimization
  - Create user documentation and deployment guides
  - Conduct final acceptance testing with all requirements
  - _Requirements: All requirements must pass acceptance criteria_
