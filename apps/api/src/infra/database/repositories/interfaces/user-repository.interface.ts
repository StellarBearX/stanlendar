import { User } from '../../entities/user.entity';
import { BaseRepository } from './base-repository.interface';

export interface UserRepository extends BaseRepository<User> {
  findByEmail(email: string): Promise<User | null>;
  updateLastLogin(id: string): Promise<void>;
}