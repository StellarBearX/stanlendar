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

@Entity('calendar_account')
@Unique(['provider', 'googleSub'])
export class CalendarAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  provider: 'google';

  @Column({ name: 'google_sub' })
  googleSub: string;

  @Column({ name: 'access_token_enc' })
  accessTokenEnc: string;

  @Column({ name: 'refresh_token_enc' })
  refreshTokenEnc: string;

  @Column({ name: 'token_expires_at' })
  tokenExpiresAt: Date;

  @Column({ name: 'primary_calendar_id', nullable: true })
  primaryCalendarId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.calendarAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}