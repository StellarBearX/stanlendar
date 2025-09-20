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
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}