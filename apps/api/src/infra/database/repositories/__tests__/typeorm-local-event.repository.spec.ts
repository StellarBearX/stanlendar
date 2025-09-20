import { Repository, Between } from 'typeorm';
import { LocalEvent } from '../../entities/local-event.entity';
import { TypeOrmLocalEventRepository } from '../typeorm-local-event.repository';

describe('TypeOrmLocalEventRepository', () => {
  let repository: TypeOrmLocalEventRepository;
  let mockRepository: jest.Mocked<Repository<LocalEvent>>;

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

    repository = new TypeOrmLocalEventRepository(mockRepository);
  });

  describe('findById', () => {
    it('should call repository.findOne with correct parameters and relations', async () => {
      const eventId = 'test-id';
      const mockEvent = { id: eventId } as LocalEvent;
      mockRepository.findOne.mockResolvedValue(mockEvent);

      const result = await repository.findById(eventId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: eventId },
        relations: ['user', 'subject', 'section']
      });
      expect(result).toBe(mockEvent);
    });
  });

  describe('findByUserId', () => {
    it('should find events by user id with correct ordering', async () => {
      const userId = 'user-123';
      const mockEvents = [{ id: 'event-1' }, { id: 'event-2' }] as LocalEvent[];
      mockRepository.find.mockResolvedValue(mockEvents);

      const result = await repository.findByUserId(userId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        relations: ['subject', 'section'],
        order: { eventDate: 'ASC', startTime: 'ASC' }
      });
      expect(result).toBe(mockEvents);
    });
  });

  describe('findByUserIdAndDateRange', () => {
    it('should find events within date range', async () => {
      const userId = 'user-123';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockEvents = [{ id: 'event-1' }] as LocalEvent[];
      mockRepository.find.mockResolvedValue(mockEvents);

      const result = await repository.findByUserIdAndDateRange(userId, startDate, endDate);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          userId,
          eventDate: Between(startDate, endDate)
        },
        relations: ['subject', 'section'],
        order: { eventDate: 'ASC', startTime: 'ASC' }
      });
      expect(result).toBe(mockEvents);
    });
  });

  describe('findByStatus', () => {
    it('should find events by status', async () => {
      const status = 'planned';
      const mockEvents = [{ id: 'event-1', status }] as LocalEvent[];
      mockRepository.find.mockResolvedValue(mockEvents);

      const result = await repository.findByStatus(status);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { status },
        relations: ['user', 'subject', 'section'],
        order: { eventDate: 'ASC', startTime: 'ASC' }
      });
      expect(result).toBe(mockEvents);
    });
  });

  describe('findByGcalEventId', () => {
    it('should find event by Google Calendar event ID', async () => {
      const gcalEventId = 'gcal-123';
      const mockEvent = { id: 'event-1', gcalEventId } as LocalEvent;
      mockRepository.findOne.mockResolvedValue(mockEvent);

      const result = await repository.findByGcalEventId(gcalEventId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { gcalEventId },
        relations: ['user', 'subject', 'section']
      });
      expect(result).toBe(mockEvent);
    });
  });

  describe('softDelete', () => {
    it('should update status to deleted', async () => {
      const eventId = 'event-123';
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await repository.softDelete(eventId);

      expect(mockRepository.update).toHaveBeenCalledWith(eventId, { status: 'deleted' });
      expect(result).toBe(true);
    });

    it('should return false when no rows affected', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await repository.softDelete('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('findPendingSync', () => {
    it('should find events with planned status for sync', async () => {
      const userId = 'user-123';
      const mockEvents = [{ id: 'event-1', status: 'planned' }] as LocalEvent[];
      mockRepository.find.mockResolvedValue(mockEvents);

      const result = await repository.findPendingSync(userId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { 
          userId,
          status: 'planned'
        },
        relations: ['subject', 'section'],
        order: { eventDate: 'ASC', startTime: 'ASC' }
      });
      expect(result).toBe(mockEvents);
    });
  });

  describe('create', () => {
    it('should create and save a new event', async () => {
      const eventData = {
        userId: 'user-123',
        subjectId: 'subject-123',
        sectionId: 'section-123',
        eventDate: '2024-01-15',
        startTime: '09:00',
        endTime: '10:30',
        status: 'planned' as const,
      };
      const mockEvent = { id: 'event-id', ...eventData } as LocalEvent;
      
      mockRepository.create.mockReturnValue(mockEvent);
      mockRepository.save.mockResolvedValue(mockEvent);

      const result = await repository.create(eventData);

      expect(mockRepository.create).toHaveBeenCalledWith(eventData);
      expect(mockRepository.save).toHaveBeenCalledWith(mockEvent);
      expect(result).toBe(mockEvent);
    });
  });
});