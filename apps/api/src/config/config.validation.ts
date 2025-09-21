import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  API_VERSION: Joi.string().default('v1'),
  
  // Frontend
  FRONTEND_URL: Joi.string().uri().required(),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_SIZE: Joi.number().min(1).max(50).default(10),
  DB_TIMEOUT: Joi.number().min(1000).default(30000),
  
  // Redis
  REDIS_URL: Joi.string().required(),
  REDIS_TLS: Joi.boolean().default(false),
  REDIS_POOL_SIZE: Joi.number().min(1).max(20).default(5),
  
  // Authentication - Strict validation for production
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  ENCRYPTION_KEY: Joi.string().length(64).required(), // 32 bytes in hex
  SESSION_SECRET: Joi.string().min(32).required(),
  
  // Google OAuth & API
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_REDIRECT_URI: Joi.string().uri().required(),
  GOOGLE_API_QUOTA_LIMIT: Joi.number().min(100).default(3000),
  GOOGLE_API_BATCH_SIZE: Joi.number().min(1).max(100).default(50),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: Joi.number().min(1).default(60),
  RATE_LIMIT_MAX: Joi.number().min(1).default(100),
  RATE_LIMIT_GLOBAL_MAX: Joi.number().min(100).default(1000),
  
  // Security
  CORS_ORIGIN: Joi.string().uri().required(),
  CSRF_SECRET: Joi.string().min(32).required(),
  
  // File Upload
  MAX_FILE_SIZE: Joi.number().min(1024).max(52428800).default(10485760), // 1KB to 50MB
  UPLOAD_TIMEOUT: Joi.number().min(5000).default(30000),
  
  // Monitoring
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  SENTRY_DSN: Joi.string().uri().optional(),
});

export const validateConfig = (config: Record<string, unknown>) => {
  const { error, value } = configValidationSchema.validate(config, {
    allowUnknown: true,
    abortEarly: false,
  });

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }

  return value;
};