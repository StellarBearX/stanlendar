import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { TypeOrmUserRepository } from '../typeorm-user.repository';

describe('TypeOrmUserRepository', () => {
  let repository: TypeOrmUserRepository;
  let mockRepository: jest.Mocked<Repository<User>>;

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    } as any;

    repository = new TypeOrmUserRepository(mockRepository);
  });

  describe('findById', () => {
    it('should call repository.findOne with correct parameters', async () => {
      const userId = 'test-id';
      const mockUser = { id: userId, email: 'test@example.com' } as User;
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await repository.findById(userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
      expect(result).toBe(mockUser);
    });

    it('should return null when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should call repository.findOne with email parameter', async () => {
      const email = 'test@example.com';
      const mockUser = { id: 'test-id', email } as User;
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await repository.findByEmail(email);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(result).toBe(mockUser);
    });
  });

  describe('create', () => {
    it('should create and save a new user', async () => {
      const userData = { email: 'test@example.com', displayName: 'Test User' };
      const mockUser = { id: 'test-id', ...userData } as User;
      
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await repository.create(userData);

      expect(mockRepository.create).toHaveBeenCalledWith(userData);
      expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toBe(mockUser);
    });
  });

  describe('update', () => {
    it('should update user and return updated user', async () => {
      const userId = 'test-id';
      const updates = { displayName: 'Updated Name' };
      const mockUser = { id: userId, displayName: 'Updated Name' } as User;

      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await repository.update(userId, updates);

      expect(mockRepository.update).toHaveBeenCalledWith(userId, updates);
      expect(result).toBe(mockUser);
    });

    it('should return null when no rows affected', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await repository.update('non-existent-id', {});

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete user and return true', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await repository.delete('test-id');

      expect(mockRepository.delete).toHaveBeenCalledWith('test-id');
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const result = await repository.delete('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('updateLastLogin', () => {
    it('should update lastLoginAt timestamp', async () => {
      const userId = 'test-id';
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      await repository.updateLastLogin(userId);

      expect(mockRepository.update).toHaveBeenCalledWith(userId, { 
        lastLoginAt: expect.any(Date) 
      });
    });
  });

  describe('count', () => {
    it('should return user count', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await repository.count();

      expect(mockRepository.count).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });
});