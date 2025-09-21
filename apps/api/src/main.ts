import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SanitizationPipe, SqlInjectionPipe, XssProtectionPipe } from './common/pipes/sanitization.pipe';
import { CsrfGuard } from './common/guards/csrf.guard';
import { 
  EnhancedSecurityMiddleware, 
  RequestSizeMiddleware, 
  AuditLoggingMiddleware,
  IpWhitelistMiddleware 
} from './common/middleware/security-enhanced.middleware';
import { RateLimitMiddleware } from './modules/auth/middleware/rate-limit.middleware';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Security middleware (order matters)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        mediaSrc: ["'none'"],
        objectSrc: ["'none'"],
        childSrc: ["'none'"],
        frameSrc: ["'none'"],
        workerSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
  
  // Custom security middleware
  app.use(new EnhancedSecurityMiddleware(app.get('ConfigService')).use.bind(
    new EnhancedSecurityMiddleware(app.get('ConfigService'))
  ));
  app.use(new RequestSizeMiddleware().use.bind(new RequestSizeMiddleware()));
  app.use(new AuditLoggingMiddleware().use.bind(new AuditLoggingMiddleware()));
  app.use(new IpWhitelistMiddleware(app.get('ConfigService')).use.bind(
    new IpWhitelistMiddleware(app.get('ConfigService'))
  ));
  app.use(new RateLimitMiddleware(app.get('ConfigService')).use.bind(
    new RateLimitMiddleware(app.get('ConfigService'))
  ));
  
  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());
  
  // Global security guards
  app.useGlobalGuards(new CsrfGuard(app.get('Reflector')));
  
  // Global validation and sanitization pipes
  app.useGlobalPipes(
    new SqlInjectionPipe(),
    new XssProtectionPipe(),
    new SanitizationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🚀 API server running on http://localhost:${port}`);
  console.log(`🔒 Security middleware enabled`);
}

bootstrap();