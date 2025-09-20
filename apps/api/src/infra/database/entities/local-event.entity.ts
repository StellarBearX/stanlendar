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
  eventDate: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ nullable: true })
  room?: string;

  @Column({ name: 'title_override', nullable: true })
  titleOverride?: string;

  @Column({ default: 'planned' })
  status: 'planned' | 'synced' | 'deleted';

  @Column({ name: 'gcal_event_id', nullable: true })
  gcalEventId?: string;

  @Column({ name: 'gcal_etag', nullable: true })
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