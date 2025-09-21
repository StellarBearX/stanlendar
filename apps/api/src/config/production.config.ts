import { registerAs } from '@nestjs/config';

export default registerAs('production', () => ({
  // Application
  nodeEnv: process.env.NODE_ENV || 'production',
  port: parseInt(process.env.PORT, 10) || 3001,
  apiVersion: process.env.API_VERSION || 'v1',
  
  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'https://localhost:3000',
  
  // Database
  database: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
    timeout: parseInt(process.env.DB_TIMEOUT, 10) || 30000,
    logging: process.env.NODE_ENV === 'development',
    synchronize: false, // Never true in production
    migrationsRun: true,
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL,
    tls: process.env.REDIS_TLS === 'true',
    poolSize: parseInt(process.env.REDIS_POOL_SIZE, 10) || 5,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  
  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    encryptionKey: process.env.ENCRYPTION_KEY,
    sessionSecret: process.env.SESSION_SECRET,
  },
  
  // Google OAuth & API
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    apiQuotaLimit: parseInt(process.env.GOOGLE_API_QUOTA_LIMIT, 10) || 3000,
    batchSize: parseInt(process.env.GOOGLE_API_BATCH_SIZE, 10) || 50,
  },
  
  // Rate Limiting
  rateLimit: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 60,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    globalMax: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX, 10) || 1000,
  },
  
  // Security
  security: {
    corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL,
    csrfSecret: process.env.CSRF_SECRET,
    enableCsrf: true,
    enableHelmet: true,
    enableRateLimit: true,
  },
  
  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
    timeout: parseInt(process.env.UPLOAD_TIMEOUT, 10) || 30000,
    allowedMimeTypes: [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  
  // Monitoring
  monitoring: {
    logLevel: process.env.LOG_LEVEL || 'info',
    sentryDsn: process.env.SENTRY_DSN,
    enableMetrics: true,
    enableTracing: process.env.NODE_ENV === 'production',
  },
  
  // Performance
  performance: {
    enableCompression: true,
    enableCaching: true,
    cacheTimeout: 300, // 5 minutes
    enableQueryOptimization: true,
  },
}));