import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IsObject, IsOptional, IsDateString, Matches, IsIn } from 'class-validator';
import { ImportJob } from './import-job.entity';

@Entity('import_item')
export class ImportItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'import_job_id' })
  importJobId: string;

  @Column({ name: 'raw_row', type: 'jsonb' })
  @IsObject()
  rawRow: Record<string, any>;

  @Column({ name: 'subject_id', nullable: true })
  @IsOptional()
  subjectId?: string;

  @Column({ name: 'section_id', nullable: true })
  @IsOptional()
  sectionId?: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Column({ name: 'days_of_week', nullable: true })
  @IsOptional()
  daysOfWeek?: string;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Start time must be in HH:mm format' })
  startTime?: string;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'End time must be in HH:mm format' })
  endTime?: string;

  @Column({ nullable: true })
  @IsOptional()
  room?: string;

  @Column({ nullable: true })
  @IsOptional()
  note?: string;

  @Column({ default: 'preview' })
  @IsIn(['preview', 'created', 'skipped', 'failed'])
  status: 'preview' | 'created' | 'skipped' | 'failed';

  @ManyToOne(() => ImportJob, (job) => job.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_job_id' })
  importJob: ImportJob;
}