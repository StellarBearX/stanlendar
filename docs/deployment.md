# Deployment Guide

This guide covers deploying the Class Schedule Sync application to production using Vercel (frontend) and Railway (backend).

## Prerequisites

- Vercel account
- Railway account (or Render as alternative)
- Supabase account for PostgreSQL
- Redis Cloud account
- Google Cloud Console project with OAuth2 and Calendar API enabled

## Infrastructure Setup

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Go to Settings > Database and note the connection string
3. Enable Row Level Security (RLS) for all tables
4. Run the database migrations:
   ```sql
   -- Copy and execute the SQL from apps/api/src/infra/database/migrations/
   ```
5. Create database indexes for performance:
   ```sql
   CREATE INDEX CONCURRENTLY idx_event_user_date ON local_event (user_id, event_date);
   CREATE INDEX CONCURRENTLY idx_subject_search ON subject USING GIN (to_tsvector('english', name || ' ' || COALESCE(code, '')));
   ```

### 2. Redis Setup (Redis Cloud)

1. Create a Redis Cloud account
2. Create a new database with persistence enabled
3. Note the connection URL with TLS enabled
4. Configure memory policy: `allkeys-lru`
5. Set max memory: 256MB (adjust based on usage)

### 3. Google Cloud Setup

1. Go to Google Cloud Console
2. Create a new project or select existing
3. Enable APIs:
   - Google Calendar API
   - Google+ API (for OAuth)
4. Create OAuth2 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://your-app.vercel.app/auth/callback`
   - Note Client ID and Client Secret

## Backend Deployment (Railway)

### 1. Deploy to Railway

1. Connect your GitHub repository to Railway
2. Create a new project from the repository
3. Set the root directory to `apps/api`
4. Configure build command: `cd ../.. && npm ci && npm run build:api`
5. Configure start command: `npm run start:prod`

### 2. Environment Variables

Set these variables in Railway dashboard:

```bash
# Copy from apps/api/.env.production and fill in actual values
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
# ... (see .env.production for complete list)
```

### 3. Health Check Configuration

Railway will automatically use the `/health` endpoint for health checks.

### 4. Custom Domain (Optional)

1. Go to Railway project settings
2. Add custom domain
3. Update DNS records as instructed
4. Update CORS_ORIGIN environment variable

## Frontend Deployment (Vercel)

### 1. Deploy to Vercel

1. Connect your GitHub repository to Vercel
2. Set root directory to `apps/web`
3. Framework preset: Next.js
4. Build command: `cd ../.. && npm run build:web`
5. Install command: `cd ../.. && npm ci`

### 2. Environment Variables

Set these variables in Vercel dashboard:

```bash
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_APP_ENV=production
```

### 3. Domain Configuration

1. Add custom domain in Vercel dashboard
2. Update DNS records
3. Update Google OAuth redirect URIs
4. Update backend CORS_ORIGIN and FRONTEND_URL

## Security Configuration

### 1. SSL/TLS

- Vercel provides automatic HTTPS
- Railway provides automatic HTTPS
- Ensure all external services use TLS

### 2. Environment Variables

- Never commit secrets to version control
- Use platform-specific secret management
- Rotate secrets regularly

### 3. CORS Configuration

Update CORS settings in backend to match your domains:

```typescript
// In main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
});
```

## Monitoring Setup

### 1. Application Monitoring

- Set up Sentry for error tracking
- Configure structured logging
- Set up health check monitoring

### 2. Performance Monitoring

- Enable Vercel Analytics
- Monitor Railway metrics
- Set up database performance monitoring in Supabase

### 3. Alerting

Configure alerts for:
- High error rates
- Database connection issues
- Google API quota exhaustion
- High response times

## Backup and Recovery

### 1. Database Backups

- Supabase provides automatic daily backups
- Configure point-in-time recovery
- Test backup restoration process

### 2. Redis Persistence

- Enable Redis persistence in Redis Cloud
- Configure backup frequency
- Test data recovery

## Scaling Considerations

### 1. Database Scaling

- Monitor connection pool usage
- Consider read replicas for heavy read workloads
- Implement connection pooling with PgBouncer if needed

### 2. API Scaling

- Railway auto-scales based on traffic
- Monitor memory and CPU usage
- Consider horizontal scaling for high traffic

### 3. Frontend Scaling

- Vercel Edge Network provides global CDN
- Implement code splitting for large bundles
- Use ISR (Incremental Static Regeneration) where appropriate

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check connection string format
   - Verify SSL configuration
   - Check connection pool limits

2. **Google API Errors**
   - Verify OAuth configuration
   - Check API quotas and limits
   - Validate redirect URIs

3. **CORS Issues**
   - Verify origin configuration
   - Check preflight request handling
   - Validate headers configuration

### Debugging

1. Check application logs in Railway/Vercel
2. Monitor database logs in Supabase
3. Use browser developer tools for frontend issues
4. Check Google Cloud Console for API errors

## Maintenance

### Regular Tasks

1. Update dependencies monthly
2. Rotate secrets quarterly
3. Review and update security configurations
4. Monitor and optimize database performance
5. Review and clean up old data

### Updates and Deployments

1. Use feature flags for gradual rollouts
2. Implement blue-green deployments for critical updates
3. Test in staging environment before production
4. Monitor metrics after deployments

## Cost Optimization

### 1. Database

- Monitor query performance
- Implement proper indexing
- Clean up old data regularly

### 2. API

- Implement caching strategies
- Optimize Google API usage
- Monitor and optimize memory usage

### 3. Frontend

- Optimize bundle size
- Use image optimization
- Implement proper caching headers