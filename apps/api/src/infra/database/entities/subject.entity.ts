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
  code?: string;

  @Column()
  name: string;

  @Column({ name: 'color_hex' })
  colorHex: string;

  @Column({ type: 'jsonb', nullable: true })
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