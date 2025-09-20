import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { CalendarAccount } from './calendar-account.entity';
import { Subject } from './subject.entity';
import { LocalEvent } from './local-event.entity';
import { SavedFilter } from './saved-filter.entity';
import { ImportJob } from './import-job.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt?: Date;

  @OneToMany(() => CalendarAccount, (account) => account.user)
  calendarAccounts: CalendarAccount[];

  @OneToMany(() => Subject, (subject) => subject.user)
  subjects: Subject[];

  @OneToMany(() => LocalEvent, (event) => event.user)
  events: LocalEvent[];

  @OneToMany(() => SavedFilter, (filter) => filter.user)
  savedFilters: SavedFilter[];

  @OneToMany(() => ImportJob, (job) => job.user)
  importJobs: ImportJob[];
}