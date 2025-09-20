import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Subject } from './subject.entity';
import { LocalEvent } from './local-event.entity';

export class ScheduleRule {
  @IsNotEmpty()
  dayOfWeek: number;

  @IsNotEmpty()
  startTime: string;

  @IsNotEmpty()
  endTime: string;

  @IsNotEmpty()
  startDate: string;

  @IsNotEmpty()
  endDate: string;

  @IsOptional()
  @IsArray()
  skipDates?: string[];
}

@Entity('section')
@Unique(['subjectId', 'secCode'])
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subject_id' })
  subjectId: string;

  @Column({ name: 'sec_code' })
  @IsNotEmpty()
  secCode: string;

  @Column({ nullable: true })
  @IsOptional()
  teacher?: string;

  @Column({ nullable: true })
  @IsOptional()
  room?: string;

  @Column({ name: 'schedule_rules', type: 'jsonb' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleRule)
  scheduleRules: ScheduleRule[];

  @ManyToOne(() => Subject, (subject) => subject.sections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @OneToMany(() => LocalEvent, (event) => event.section)
  events: LocalEvent[];
}