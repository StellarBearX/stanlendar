# Class Schedule Sync

A class schedule management system that allows students to organize their academic timetables with easy filtering capabilities and automatic synchronization with Google Calendar.

## Features

- 🔐 Google OAuth2 authentication
- 📅 Calendar view with color-coded subjects
- 🔍 Spotlight search and filtering
- ⚡ Quick add classes
- 📊 CSV/XLSX import
- 🔄 Google Calendar synchronization
- 💾 Saved filter combinations

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, FullCalendar
- **Backend**: NestJS, TypeScript, TypeORM
- **Database**: PostgreSQL
- **Cache**: Redis
- **Authentication**: Google OAuth2 + JWT
- **Deployment**: Vercel (frontend), Railway/Render (backend)

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Docker and Docker Compose (for local development)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd class-schedule-sync
```

2. Install dependencies:
```bash
npm install
```

3. Start the development services:
```bash
docker-compose up -d
```

4. Copy environment files:
```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

5. Configure your environment variables in `.env` and `apps/web/.env.local`

6. Run database migrations:
```bash
npm run db:migrate
```

7. Start the development servers:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Health Check: http://localhost:3001/api/health

### Environment Configuration

#### Required Environment Variables

**Backend (.env):**
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration
- `JWT_SECRET`: Secret for JWT token signing
- `ENCRYPTION_KEY`: 32-byte key for token encryption
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth2 credentials

**Frontend (apps/web/.env.local):**
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth2 client ID

### Google OAuth2 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Create OAuth2 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/auth/callback`
   - Authorized JavaScript origins: `http://localhost:3000`
5. Copy the client ID and secret to your environment files

### Database Management

```bash
# Run migrations
npm run db:migrate

# Generate new migration
npm run db:migrate:generate -- src/infra/database/migrations/MigrationName

# Revert last migration
npm run db:migrate:revert

# Seed database (optional)
npm run db:seed
```

## Development

### Project Structure

```
apps/
  web/                    # Next.js frontend
    src/
      app/               # App Router pages
      components/        # React components
      lib/              # Utilities and API client
      hooks/            # Custom React hooks
      store/            # Zustand stores
  api/                   # NestJS backend
    src/
      modules/          # Feature modules
      common/           # Shared utilities
      infra/            # Infrastructure (DB, Redis, etc.)
packages/
  types/               # Shared TypeScript types
```

### Available Scripts

```bash
# Development
npm run dev              # Start all services in development mode
npm run build           # Build all applications
npm run test            # Run tests
npm run lint            # Lint all code
npm run type-check      # TypeScript type checking

# Database
npm run db:migrate      # Run database migrations
npm run db:seed         # Seed database with sample data

# Individual apps
cd apps/web && npm run dev     # Frontend only
cd apps/api && npm run dev     # Backend only
```

### Code Quality

The project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety
- **Husky** for git hooks (optional)

## Deployment

### Frontend (Vercel)

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Backend (Railway/Render)

1. Connect your repository to Railway or Render
2. Set environment variables
3. Configure build command: `npm run build`
4. Configure start command: `npm run start:prod`

### Database (Supabase)

1. Create a new Supabase project
2. Copy the connection string to `DATABASE_URL`
3. Run migrations in production

## API Documentation

The API follows RESTful conventions with the following main endpoints:

- `GET /api/health` - Health check
- `POST /api/auth/google` - Google OAuth2 login
- `GET /api/subjects` - List user subjects
- `POST /api/subjects` - Create new subject
- `GET /api/events` - List user events
- `POST /api/sync` - Sync to Google Calendar
- `POST /api/import` - Import from CSV/XLSX

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.