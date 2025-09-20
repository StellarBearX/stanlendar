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
  // Connection pooling configuration
  extra: {
    max: 20, // Maximum number of connections in the pool
    min: 5,  // Minimum number of connections in the pool
    idleTimeoutMillis: 30000, // Close connections after 30 seconds of inactivity
    connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
    acquireTimeoutMillis: 60000, // Return error after 60 seconds if connection cannot be acquired
  },
  // Connection retry configuration
  maxQueryExecutionTime: 10000, // Log queries that take longer than 10 seconds
});