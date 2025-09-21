import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infra/database/database.module';
import { RedisModule } from './infra/redis/redis.module';
import { PerformanceModule } from './common/performance.module';
import { MonitoringModule } from './common/monitoring.module';
import { AuthModule } from './modules/auth/auth.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { SectionsModule } from './modules/sections/sections.module';
import { EventsModule } from './modules/events/events.module';
import { SpotlightModule } from './modules/spotlight/spotlight.module';
import { ImportModule } from './modules/import/import.module';
import { SecurityHeadersMiddleware, RequestLoggingMiddleware } from './modules/auth/middleware/security.middleware';
import { CorsMiddleware } from './modules/auth/middleware/cors.middleware';
import { RateLimitMiddleware, AuthRateLimitMiddleware } from './modules/auth/middleware/rate-limit.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    RedisModule,
    PerformanceModule,
    MonitoringModule,
    AuthModule,
    SubjectsModule,
    SectionsModule,
    EventsModule,
    SpotlightModule,
    ImportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply CORS middleware first
    consumer
      .apply(CorsMiddleware)
      .forRoutes('*');

    // Apply security headers to all routes
    consumer
      .apply(SecurityHeadersMiddleware)
      .forRoutes('*');

    // Apply request logging to all routes
    consumer
      .apply(RequestLoggingMiddleware)
      .forRoutes('*');

    // Apply general rate limiting to all routes
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes('*');

    // Apply stricter rate limiting to auth routes
    consumer
      .apply(AuthRateLimitMiddleware)
      .forRoutes('/auth/*');
  }
}