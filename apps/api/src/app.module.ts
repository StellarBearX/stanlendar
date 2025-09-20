import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infra/database/database.module';
import { RedisModule } from './infra/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { SecurityHeadersMiddleware, RequestLoggingMiddleware } from './modules/auth/middleware/security.middleware';
import { CorsMiddleware } from './modules/auth/middleware/cors.middleware';
import { RateLimitMiddleware, AuthRateLimitMiddleware } from './modules/auth/middleware/rate-limit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
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