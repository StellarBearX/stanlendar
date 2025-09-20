import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { CalendarAccount } from './entities/calendar-account.entity';
import { Subject } from './entities/subject.entity';
import { Section } from './entities/section.entity';
import { LocalEvent } from './entities/local-event.entity';
import { SavedFilter } from './entities/saved-filter.entity';
import { ImportJob } from './entities/import-job.entity';
import { ImportItem } from './entities/import-item.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [
          User,
          CalendarAccount,
          Subject,
          Section,
          LocalEvent,
          SavedFilter,
          ImportJob,
          ImportItem,
        ],
        migrations: ['dist/infra/database/migrations/*.js'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
        // Connection pooling configuration
        extra: {
          max: parseInt(configService.get('DB_POOL_MAX', '20')), // Maximum connections
          min: parseInt(configService.get('DB_POOL_MIN', '5')),  // Minimum connections
          idleTimeoutMillis: parseInt(configService.get('DB_IDLE_TIMEOUT', '30000')), // 30 seconds
          connectionTimeoutMillis: parseInt(configService.get('DB_CONNECTION_TIMEOUT', '2000')), // 2 seconds
          acquireTimeoutMillis: parseInt(configService.get('DB_ACQUIRE_TIMEOUT', '60000')), // 60 seconds
        },
        // Query performance monitoring
        maxQueryExecutionTime: parseInt(configService.get('DB_SLOW_QUERY_THRESHOLD', '10000')), // 10 seconds
        // Retry configuration
        retryAttempts: parseInt(configService.get('DB_RETRY_ATTEMPTS', '3')),
        retryDelay: parseInt(configService.get('DB_RETRY_DELAY', '3000')), // 3 seconds
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}