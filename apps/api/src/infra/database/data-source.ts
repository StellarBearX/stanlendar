import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './entities/user.entity';
import { CalendarAccount } from './entities/calendar-account.entity';
import { Subject } from './entities/subject.entity';
import { Section } from './entities/section.entity';
import { LocalEvent } from './entities/local-event.entity';
import { SavedFilter } from './entities/saved-filter.entity';
import { ImportJob } from './entities/import-job.entity';
import { ImportItem } from './entities/import-item.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
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
  migrations: ['src/infra/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});