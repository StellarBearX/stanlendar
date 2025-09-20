import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { IsEmail, IsNotEmpty, IsOptional, IsDate } from 'class-validator';
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
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Column({ name: 'display_name' })
  @IsNotEmpty()
  displayName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_login_at', nullable: true })
  @IsOptional()
  @IsDate()
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