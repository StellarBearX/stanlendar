import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Subject } from './subject.entity';
import { LocalEvent } from './local-event.entity';

@Entity('section')
@Unique(['subjectId', 'secCode'])
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subject_id' })
  subjectId: string;

  @Column({ name: 'sec_code' })
  secCode: string;

  @Column({ nullable: true })
  teacher?: string;

  @Column({ nullable: true })
  room?: string;

  @Column({ name: 'schedule_rules', type: 'jsonb' })
  scheduleRules: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string;
    skipDates?: string[];
  }>;

  @ManyToOne(() => Subject, (subject) => subject.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @OneToMany(() => LocalEvent, (event) => event.section)
  events: LocalEvent[];
}