import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyMiddleware } from './idempotency.middleware';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { SyncJobProcessor } from './jobs/sync-job.processor';
import { JobService } from './jobs/job.service';
import { JobMonitorService } from './jobs/job-monitor.service';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB') || 0,
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'sync',
    }),
  ],
  providers: [
    IdempotencyService,
    IdempotencyMiddleware,
    IdempotencyInterceptor,
    SyncJobProcessor,
    JobService,
    JobMonitorService,
  ],
  exports: [
    BullModule,
    IdempotencyService,
    IdempotencyMiddleware,
    IdempotencyInterceptor,
    JobService,
    JobMonitorService,
  ],
})
export class RedisModule {}