import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { IsNotEmpty, IsOptional, IsHexColor, IsObject } from 'class-validator';
import { User } from './user.entity';
import { Section } from './section.entity';
import { LocalEvent } from './local-event.entity';

@Entity('subject')
@Unique(['userId', 'code', 'name'])
export class Subject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ nullable: true })
  @IsOptional()
  code?: string;

  @Column()
  @IsNotEmpty()
  name: string;

  @Column({ name: 'color_hex' })
  @IsHexColor()
  colorHex: string;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.subjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Section, (section) => section.subject)
  sections: Section[];

  @OneToMany(() => LocalEvent, (event) => event.subject)
  events: LocalEvent[];
}