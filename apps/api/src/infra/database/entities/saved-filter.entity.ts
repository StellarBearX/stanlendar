import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { IsNotEmpty, IsObject } from 'class-validator';
import { User } from './user.entity';

@Entity('saved_filter')
@Unique(['userId', 'name'])
export class SavedFilter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  @IsNotEmpty()
  name: string;

  @Column({ type: 'jsonb' })
  @IsObject()
  query: {
    subjectIds?: string[];
    secCodes?: string[];
    text?: string;
    dateRange?: {
      from: string;
      to: string;
    };
    viewMode?: 'hide_others' | 'dim_others';
  };

  @ManyToOne(() => User, (user) => user.savedFilters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}