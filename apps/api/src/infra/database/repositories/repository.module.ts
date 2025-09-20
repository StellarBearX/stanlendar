import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { CalendarAccount } from '../entities/calendar-account.entity';
import { Subject } from '../entities/subject.entity';
import { Section } from '../entities/section.entity';
import { LocalEvent } from '../entities/local-event.entity';
import { SavedFilter } from '../entities/saved-filter.entity';
import { ImportJob } from '../entities/import-job.entity';
import { ImportItem } from '../entities/import-item.entity';

import { TypeOrmUserRepository } from './typeorm-user.repository';
import { TypeOrmCalendarAccountRepository } from './typeorm-calendar-account.repository';
import { TypeOrmSubjectRepository } from './typeorm-subject.repository';
import { TypeOrmSectionRepository } from './typeorm-section.repository';
import { TypeOrmLocalEventRepository } from './typeorm-local-event.repository';
import { TypeOrmImportJobRepository } from './typeorm-import-job.repository';
import { TypeOrmImportItemRepository } from './typeorm-import-item.repository';

// Repository tokens for dependency injection
export const USER_REPOSITORY = 'USER_REPOSITORY';
export const CALENDAR_ACCOUNT_REPOSITORY = 'CALENDAR_ACCOUNT_REPOSITORY';
export const SUBJECT_REPOSITORY = 'SUBJECT_REPOSITORY';
export const SECTION_REPOSITORY = 'SECTION_REPOSITORY';
export const LOCAL_EVENT_REPOSITORY = 'LOCAL_EVENT_REPOSITORY';
export const IMPORT_JOB_REPOSITORY = 'IMPORT_JOB_REPOSITORY';
export const IMPORT_ITEM_REPOSITORY = 'IMPORT_ITEM_REPOSITORY';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      CalendarAccount,
      Subject,
      Section,
      LocalEvent,
      SavedFilter,
      ImportJob,
      ImportItem,
    ]),
  ],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },
    {
      provide: CALENDAR_ACCOUNT_REPOSITORY,
      useClass: TypeOrmCalendarAccountRepository,
    },
    {
      provide: SUBJECT_REPOSITORY,
      useClass: TypeOrmSubjectRepository,
    },
    {
      provide: SECTION_REPOSITORY,
      useClass: TypeOrmSectionRepository,
    },
    {
      provide: LOCAL_EVENT_REPOSITORY,
      useClass: TypeOrmLocalEventRepository,
    },
    {
      provide: IMPORT_JOB_REPOSITORY,
      useClass: TypeOrmImportJobRepository,
    },
    {
      provide: IMPORT_ITEM_REPOSITORY,
      useClass: TypeOrmImportItemRepository,
    },
  ],
  exports: [
    USER_REPOSITORY,
    CALENDAR_ACCOUNT_REPOSITORY,
    SUBJECT_REPOSITORY,
    SECTION_REPOSITORY,
    LOCAL_EVENT_REPOSITORY,
    IMPORT_JOB_REPOSITORY,
    IMPORT_ITEM_REPOSITORY,
  ],
})
export class RepositoryModule {}