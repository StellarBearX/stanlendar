import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ImportJob } from './import-job.entity';

@Entity('import_item')
export class ImportItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'import_job_id' })
  importJobId: string;

  @Column({ name: 'raw_row', type: 'jsonb' })
  rawRow: Record<string, any>;

  @Column({ name: 'subject_id', nullable: true })
  subjectId?: string;

  @Column({ name: 'section_id', nullable: true })
  sectionId?: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate?: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string;

  @Column({ name: 'days_of_week', nullable: true })
  daysOfWeek?: string;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime?: string;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime?: string;

  @Column({ nullable: true })
  room?: string;

  @Column({ nullable: true })
  note?: string;

  @Column({ default: 'preview' })
  status: 'preview' | 'created' | 'skipped' | 'failed';

  @ManyToOne(() => ImportJob, (job) => job.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'import_job_id' })
  importJob: ImportJob;
}