import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { IsNotEmpty, IsOptional, IsIn, IsDateString, Matches } from 'class-validator';
import { User } from './user.entity';
import { Subject } from './subject.entity';
import { Section } from './section.entity';

@Entity('local_event')
@Unique(['userId', 'subjectId', 'sectionId', 'eventDate', 'startTime', 'endTime'])
export class LocalEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'subject_id' })
  subjectId: string;

  @Column({ name: 'section_id' })
  sectionId: string;

  @Column({ name: 'event_date', type: 'date' })
  @IsDateString()
  eventDate: string;

  @Column({ name: 'start_time', type: 'time' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Start time must be in HH:mm format' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'End time must be in HH:mm format' })
  endTime: string;

  @Column({ nullable: true })
  @IsOptional()
  room?: string;

  @Column({ name: 'title_override', nullable: true })
  @IsOptional()
  titleOverride?: string;

  @Column({ default: 'planned' })
  @IsIn(['planned', 'synced', 'deleted'])
  status: 'planned' | 'synced' | 'deleted';

  @Column({ name: 'gcal_event_id', nullable: true })
  @IsOptional()
  gcalEventId?: string;

  @Column({ name: 'gcal_etag', nullable: true })
  @IsOptional()
  gcalEtag?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Subject, (subject) => subject.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @ManyToOne(() => Section, (section) => section.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: Section;
}