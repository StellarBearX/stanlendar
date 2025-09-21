# Production Deployment Checklist

## Pre-Deployment Setup

### Infrastructure Setup
- [ ] **Supabase PostgreSQL Database**
  - [ ] Create Supabase project
  - [ ] Configure connection pooling (max 10 connections)
  - [ ] Enable Row Level Security (RLS)
  - [ ] Set up automated backups (daily)
  - [ ] Configure SSL/TLS encryption
  - [ ] Note connection string for environment variables

- [ ] **Redis Cloud Cache**
  - [ ] Create Redis Cloud account and database
  - [ ] Enable persistence (RDB + AOF)
  - [ ] Configure memory policy: `allkeys-lru`
  - [ ] Set max memory: 256MB
  - [ ] Enable TLS encryption
  - [ ] Note connection URL for environment variables

- [ ] **Google Cloud Console**
  - [ ] Create or select Google Cloud project
  - [ ] Enable Google Calendar API
  - [ ] Enable Google+ API (for OAuth)
  - [ ] Create OAuth2 credentials (Web application)
  - [ ] Configure authorized redirect URIs
  - [ ] Note Client ID and Client Secret

### Security Setup
- [ ] **Generate Secrets**
  - [ ] JWT Secret (minimum 32 characters): `openssl rand -base64 32`
  - [ ] Encryption Key (32 bytes in hex): `openssl rand -hex 32`
  - [ ] Session Secret (minimum 32 characters): `openssl rand -base64 32`
  - [ ] CSRF Secret (minimum 32 characters): `openssl rand -base64 32`

- [ ] **Domain Configuration**
  - [ ] Purchase/configure custom domain
  - [ ] Set up DNS records
  - [ ] Configure SSL certificates

## Backend Deployment (Railway)

### Railway Setup
- [ ] **Create Railway Project**
  - [ ] Connect GitHub repository
  - [ ] Set root directory to `apps/api`
  - [ ] Configure build command: `cd ../.. && npm ci && npm run build:api`
  - [ ] Configure start command: `npm run start:prod`
  - [ ] Enable health check on `/health`

- [ ] **Environment Variables**
  ```bash
  NODE_ENV=production
  PORT=3001
  DATABASE_URL=postgresql://postgres:[password]@[host]:5432/[database]?sslmode=require
  REDIS_URL=redis://:[password]@[host]:[port]
  JWT_SECRET=[generated-secret]
  ENCRYPTION_KEY=[generated-key]
  SESSION_SECRET=[generated-secret]
  CSRF_SECRET=[generated-secret]
  GOOGLE_CLIENT_ID=[from-google-console]
  GOOGLE_CLIENT_SECRET=[from-google-console]
  FRONTEND_URL=https://[your-domain].vercel.app
  GOOGLE_REDIRECT_URI=https://[your-domain].vercel.app/auth/callback
  CORS_ORIGIN=https://[your-domain].vercel.app
  LOG_LEVEL=info
  RATE_LIMIT_WINDOW=60
  RATE_LIMIT_MAX=100
  GOOGLE_API_QUOTA_LIMIT=3000
  ```

- [ ] **Database Migration**
  - [ ] Run initial migration: `npm run migration:run`
  - [ ] Verify tables created correctly
  - [ ] Check indexes are in place

- [ ] **Health Check Verification**
  - [ ] Test `/health` endpoint returns 200
  - [ ] Test `/health/ready` endpoint returns 200
  - [ ] Test `/health/live` endpoint returns 200
  - [ ] Verify database and Redis connectivity

## Frontend Deployment (Vercel)

### Vercel Setup
- [ ] **Create Vercel Project**
  - [ ] Connect GitHub repository
  - [ ] Set root directory to `apps/web`
  - [ ] Framework preset: Next.js
  - [ ] Build command: `cd ../.. && npm run build:web`
  - [ ] Install command: `cd ../.. && npm ci`

- [ ] **Environment Variables**
  ```bash
  NEXT_PUBLIC_API_URL=https://[your-api].railway.app
  NEXT_PUBLIC_GOOGLE_CLIENT_ID=[from-google-console]
  NEXT_PUBLIC_APP_ENV=production
  ```

- [ ] **Domain Configuration**
  - [ ] Add custom domain
  - [ ] Configure DNS records
  - [ ] Verify SSL certificate

## Security Configuration

### Google OAuth Setup
- [ ] **Update OAuth Configuration**
  - [ ] Add production redirect URI: `https://[domain]/auth/callback`
  - [ ] Add production JavaScript origins: `https://[domain]`
  - [ ] Remove development URLs from production credentials
  - [ ] Test OAuth flow in production

### CORS and Security Headers
- [ ] **Verify Security Headers**
  - [ ] X-Frame-Options: DENY
  - [ ] X-Content-Type-Options: nosniff
  - [ ] Referrer-Policy: strict-origin-when-cross-origin
  - [ ] Content-Security-Policy configured
  - [ ] CORS origin matches frontend domain

### Rate Limiting
- [ ] **Configure Rate Limits**
  - [ ] API rate limiting: 100 req/min per user
  - [ ] Global rate limiting: 1000 req/hour per IP
  - [ ] File upload limits: 10MB max
  - [ ] Request timeout: 30 seconds

## Testing and Validation

### Automated Testing
- [ ] **Run Test Suite**
  - [ ] Unit tests pass: `npm run test:unit`
  - [ ] Integration tests pass: `npm run test:e2e`
  - [ ] Security tests pass: `npm run test:security`
  - [ ] Performance tests pass: `npm run test:performance`

- [ ] **Security Audit**
  - [ ] Run `npm audit --audit-level=high`
  - [ ] Run Snyk security scan
  - [ ] Check for known vulnerabilities
  - [ ] Verify dependency updates

### Manual Testing
- [ ] **Authentication Flow**
  - [ ] Google OAuth login works
  - [ ] JWT tokens are properly encrypted
  - [ ] Session management works
  - [ ] Logout clears session

- [ ] **Core Functionality**
  - [ ] Quick Add Class works
  - [ ] CSV/XLSX import works
  - [ ] Calendar sync to Google works
  - [ ] Spotlight filter works
  - [ ] Reminder settings work

- [ ] **Error Handling**
  - [ ] 404 pages display correctly
  - [ ] 500 errors are handled gracefully
  - [ ] Network errors show user-friendly messages
  - [ ] Offline state is detected

### Performance Testing
- [ ] **Load Testing**
  - [ ] API can handle 100 concurrent users
  - [ ] Database queries complete within 200ms
  - [ ] Google API sync completes within 5 seconds
  - [ ] Frontend loads within 2 seconds

- [ ] **Resource Monitoring**
  - [ ] Memory usage stays below 512MB
  - [ ] CPU usage stays below 80%
  - [ ] Database connections stay below limit
  - [ ] Redis memory usage is reasonable

## Monitoring Setup

### Application Monitoring
- [ ] **Error Tracking**
  - [ ] Set up Sentry for error tracking
  - [ ] Configure error alerting
  - [ ] Test error reporting

- [ ] **Performance Monitoring**
  - [ ] Enable Vercel Analytics
  - [ ] Monitor Railway metrics
  - [ ] Set up database monitoring
  - [ ] Configure performance alerts

### Health Monitoring
- [ ] **Uptime Monitoring**
  - [ ] Set up external uptime monitoring
  - [ ] Configure downtime alerts
  - [ ] Test alert notifications

- [ ] **Log Monitoring**
  - [ ] Configure structured logging
  - [ ] Set up log aggregation
  - [ ] Configure log-based alerts

## Post-Deployment

### Smoke Testing
- [ ] **Run Smoke Tests**
  - [ ] `npm run test:smoke` passes
  - [ ] All health checks return healthy
  - [ ] Authentication flow works end-to-end
  - [ ] Critical user journeys work

### Documentation
- [ ] **Update Documentation**
  - [ ] Update README with production URLs
  - [ ] Document environment variables
  - [ ] Create user documentation
  - [ ] Document troubleshooting steps

### Backup and Recovery
- [ ] **Verify Backups**
  - [ ] Database backups are running
  - [ ] Redis persistence is enabled
  - [ ] Test backup restoration process
  - [ ] Document recovery procedures

## Go-Live Checklist

### Final Verification
- [ ] **Production URLs**
  - [ ] Frontend: https://[your-domain]
  - [ ] API: https://[your-api-domain]
  - [ ] Health check: https://[your-api-domain]/health

- [ ] **DNS and SSL**
  - [ ] DNS records propagated
  - [ ] SSL certificates valid
  - [ ] HTTPS redirects working

- [ ] **Monitoring**
  - [ ] All monitoring systems active
  - [ ] Alerts configured and tested
  - [ ] Team has access to dashboards

### Launch
- [ ] **Soft Launch**
  - [ ] Test with limited users
  - [ ] Monitor for issues
  - [ ] Verify performance under load

- [ ] **Full Launch**
  - [ ] Announce to users
  - [ ] Monitor metrics closely
  - [ ] Be ready for quick rollback if needed

## Post-Launch Maintenance

### Regular Tasks
- [ ] **Weekly**
  - [ ] Review error logs
  - [ ] Check performance metrics
  - [ ] Monitor resource usage

- [ ] **Monthly**
  - [ ] Update dependencies
  - [ ] Review security alerts
  - [ ] Optimize database performance
  - [ ] Review and rotate secrets

- [ ] **Quarterly**
  - [ ] Security audit
  - [ ] Performance optimization
  - [ ] Backup restoration test
  - [ ] Disaster recovery drill

## Rollback Plan

### Emergency Procedures
- [ ] **Rollback Steps**
  1. Revert to previous deployment in Vercel/Railway
  2. Restore database from backup if needed
  3. Clear Redis cache
  4. Verify health checks pass
  5. Notify users of any issues

- [ ] **Communication Plan**
  - [ ] Status page updates
  - [ ] User notifications
  - [ ] Team communication channels
  - [ ] Post-incident review process