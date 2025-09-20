import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleCalendarService } from './google-calendar.service';
import { EventFormatterService } from './event-formatter.service';
import { CalendarSyncService } from './calendar-sync.service';
import { AuthModule } from '../auth/auth.module';
import { CalendarAccount } from '../../infra/database/entities/calendar-account.entity';
import { LocalEvent } from '../../infra/database/entities/local-event.entity';
import { Subject } from '../../infra/database/entities/subject.entity';
import { Section } from '../../infra/database/entities/section.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarAccount, LocalEvent, Subject, Section]),
    AuthModule,
  ],
  providers: [GoogleCalendarService, EventFormatterService, CalendarSyncService],
  exports: [GoogleCalendarService, EventFormatterService, CalendarSyncService],
})
export class GoogleCalendarModule {}