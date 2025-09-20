import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('saved_filter')
@Unique(['userId', 'name'])
export class SavedFilter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb' })
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