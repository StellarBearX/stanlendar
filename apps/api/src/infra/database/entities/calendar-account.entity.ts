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
import { IsNotEmpty, IsIn, IsOptional, IsDate } from 'class-validator';
import { User } from './user.entity';

@Entity('calendar_account')
@Unique(['provider', 'googleSub'])
export class CalendarAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  @IsIn(['google'])
  provider: 'google';

  @Column({ name: 'google_sub' })
  @IsNotEmpty()
  googleSub: string;

  @Column({ name: 'access_token_enc' })
  @IsNotEmpty()
  accessTokenEnc: string;

  @Column({ name: 'refresh_token_enc' })
  @IsNotEmpty()
  refreshTokenEnc: string;

  @Column({ name: 'token_expires_at' })
  @IsDate()
  tokenExpiresAt: Date;

  @Column({ name: 'primary_calendar_id', nullable: true })
  @IsOptional()
  primaryCalendarId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.calendarAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}