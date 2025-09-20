import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleCalendarService } from './google-calendar.service';
import { EventFormatterService } from './event-formatter.service';
import { CalendarSyncService } from './calendar-sync.service';
import { ReminderService } from './reminder.service';
import { ReminderController } from './reminder.controller';
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
  controllers: [ReminderController],
  providers: [GoogleCalendarService, EventFormatterService, CalendarSyncService, ReminderService],
  exports: [GoogleCalendarService, EventFormatterService, CalendarSyncService, ReminderService],
})
export class GoogleCalendarModule {}