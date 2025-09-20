import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { IsIn, IsOptional, IsObject } from 'class-validator';
import { User } from './user.entity';
import { ImportItem } from './import-item.entity';

@Entity('import_job')
export class ImportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'source_type' })
  @IsIn(['csv', 'xlsx'])
  sourceType: 'csv' | 'xlsx';

  @Column({ name: 'column_map', type: 'jsonb', nullable: true })
  @IsOptional()
  @IsObject()
  columnMap?: Record<string, string>;

  @Column()
  @IsIn(['pending', 'preview', 'applied', 'failed'])
  state: 'pending' | 'preview' | 'applied' | 'failed';

  @Column({ name: 'error_message', nullable: true })
  @IsOptional()
  errorMessage?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.importJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => ImportItem, (item) => item.importJob)
  items: ImportItem[];
}