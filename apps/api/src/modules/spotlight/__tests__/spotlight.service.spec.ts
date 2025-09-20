import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SpotlightService } from '../spotlight.service';
import { LocalEvent } from '../../../infra/database/entities/local-event.entity';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { Section } from '../../../infra/database/entities/section.entity';
import { SpotlightQuery } from '../interfaces/spotlight.interface';

describe('SpotlightService', () => {
  let service: SpotlightService;
  let eventRepository: jest.Mocked<Repository<LocalEvent>>;
  let subjectRepository: jest.Mocked<Repository<Subject>>;
  let sectionRepository: jest.Mocked<Repository<Section>>;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<LocalEvent>>;

  const mockUserId = 'user-123';
  const mockSubjectId = 'subject-123';
  const mockSectionId = 'section-123';

  beforeEach(async () => {
    // Create mock query builder
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      getRawMany: jest.fn(),
      select: jest.fn().mockReturnThis(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpotlightService,
        {
          provide: getRepositoryToken(LocalEvent),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            count: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Section),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SpotlightService>(SpotlightService);
    eventRepository = module.get(getRepositoryToken(LocalEvent));
    subjectRepository = module.get(getRepositoryToken(Subject));
    sectionRepository = module.get(getRepositoryToken(Section));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });  
describe('search', () => {
    it('should perform basic search without filters', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          userId: mockUserId,
          subjectId: mockSubjectId,
          sectionId: mockSectionId,
          eventDate: '2024-01-15',
          startTime: '09:00',
          endTime: '10:30',
          status: 'planned'
        }
      ];

      const mockSubjects = [
        {
          id: mockSubjectId,
          userId: mockUserId,
          name: 'Mathematics',
          code: 'MATH101',
          colorHex: '#ff0000'
        }
      ];

      const mockSections = [
        {
          id: mockSectionId,
          subjectId: mockSubjectId,
          secCode: '001',
          teacher: 'Dr. Smith',
          room: 'A101'
        }
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockEvents);
      eventRepository.count.mockResolvedValue(1);
      
      // Mock subject and section queries with separate query builders
      const mockSubjectQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSubjects),
      };
      
      const mockSectionQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockSections),
      };
      
      subjectRepository.createQueryBuilder.mockReturnValue(mockSubjectQueryBuilder as any);
      sectionRepository.createQueryBuilder.mockReturnValue(mockSectionQueryBuilder as any);

      const query: SpotlightQuery = {};
      const result = await service.search({
        userId: mockUserId,
        query,
        includeRelations: true
      });

      expect(result.events).toEqual(mockEvents);
      expect(result.subjects).toEqual(mockSubjects);
      expect(result.sections).toEqual(mockSections);
      expect(result.totalCount).toBe(1);
      expect(result.filteredCount).toBe(1);
    });

    it('should apply text filter with full-text search', async () => {
      const query: SpotlightQuery = {
        text: 'mathematics'
      };

      mockQueryBuilder.getMany.mockResolvedValue([]);
      eventRepository.count.mockResolvedValue(0);

      await service.search({
        userId: mockUserId,
        query,
        includeRelations: true
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        { searchText: 'mathematics' }
      );
    });

    it('should apply subject ID filter', async () => {
      const query: SpotlightQuery = {
        subjectIds: [mockSubjectId]
      };

      mockQueryBuilder.getMany.mockResolvedValue([]);
      eventRepository.count.mockResolvedValue(0);

      await service.search({
        userId: mockUserId,
        query,
        includeRelations: true
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.subjectId IN (:...subjectIds)',
        { subjectIds: [mockSubjectId] }
      );
    });

    it('should apply section code filter', async () => {
      const query: SpotlightQuery = {
        secCodes: ['001', '002']
      };

      mockQueryBuilder.getMany.mockResolvedValue([]);
      eventRepository.count.mockResolvedValue(0);

      await service.search({
        userId: mockUserId,
        query,
        includeRelations: true
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'section.secCode IN (:...secCodes)',
        { secCodes: ['001', '002'] }
      );
    });

    it('should apply date range filter', async () => {
      const query: SpotlightQuery = {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      };

      mockQueryBuilder.getMany.mockResolvedValue([]);
      eventRepository.count.mockResolvedValue(0);

      await service.search({
        userId: mockUserId,
        query,
        includeRelations: true
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.eventDate >= :dateFrom',
        { dateFrom: '2024-01-01' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'event.eventDate <= :dateTo',
        { dateTo: '2024-01-31' }
      );
    });

    it('should apply room filter with full-text search', async () => {
      const query: SpotlightQuery = {
        room: 'A101'
      };

      mockQueryBuilder.getMany.mockResolvedValue([]);
      eventRepository.count.mockResolvedValue(0);

      await service.search({
        userId: mockUserId,
        query,
        includeRelations: true
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        { roomText: 'A101' }
      );
    });

    it('should apply teacher filter with full-text search', async () => {
      const query: SpotlightQuery = {
        teacher: 'Dr. Smith'
      };

      mockQueryBuilder.getMany.mockResolvedValue([]);
      eventRepository.count.mockResolvedValue(0);

      await service.search({
        userId: mockUserId,
        query,
        includeRelations: true
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        { teacherText: 'Dr. Smith' }
      );
    });

    it('should apply pagination', async () => {
      const query: SpotlightQuery = {};

      mockQueryBuilder.getMany.mockResolvedValue([]);
      eventRepository.count.mockResolvedValue(0);

      await service.search({
        userId: mockUserId,
        query,
        includeRelations: true,
        limit: 50,
        offset: 100
      });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(100);
    });
  });

  describe('getSuggestions', () => {
    it('should return empty array for short text', async () => {
      const result = await service.getSuggestions(mockUserId, 'a', 'subjects');
      expect(result).toEqual([]);
    });

    it('should get subject suggestions', async () => {
      const mockSubjects = [
        { name: 'Mathematics', code: 'MATH101' },
        { name: 'Advanced Mathematics', code: 'MATH201' }
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockSubjects);
      subjectRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSuggestions(mockUserId, 'math', 'subjects');

      expect(result).toEqual(['MATH101 Mathematics', 'MATH201 Advanced Mathematics']);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('subject.userId = :userId', { userId: mockUserId });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { searchPattern: '%math%' }
      );
    });

    it('should get room suggestions', async () => {
      const mockRooms = [
        { room: 'A101' },
        { room: 'A102' }
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockRooms);
      sectionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSuggestions(mockUserId, 'A10', 'rooms');

      expect(result).toEqual(['A101', 'A102']);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('DISTINCT section.room', 'room');
    });

    it('should get teacher suggestions', async () => {
      const mockTeachers = [
        { teacher: 'Dr. Smith' },
        { teacher: 'Dr. Johnson' }
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockTeachers);
      sectionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSuggestions(mockUserId, 'Dr', 'teachers');

      expect(result).toEqual(['Dr. Smith', 'Dr. Johnson']);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('DISTINCT section.teacher', 'teacher');
    });

    it('should get section suggestions', async () => {
      const mockSections = [
        { secCode: '001' },
        { secCode: '002' }
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockSections);
      sectionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getSuggestions(mockUserId, '00', 'sections');

      expect(result).toEqual(['001', '002']);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'section.secCode ILIKE :searchPattern',
        { searchPattern: '%00%' }
      );
    });
  });

  describe('performance considerations', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock a large dataset
      const largeEventSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `event-${i}`,
        userId: mockUserId,
        subjectId: mockSubjectId,
        sectionId: mockSectionId,
        eventDate: '2024-01-15',
        startTime: '09:00',
        endTime: '10:30',
        status: 'planned'
      }));

      mockQueryBuilder.getMany.mockResolvedValue(largeEventSet);
      eventRepository.count.mockResolvedValue(1000);

      const query: SpotlightQuery = {
        text: 'mathematics'
      };

      const startTime = Date.now();
      const result = await service.search({
        userId: mockUserId,
        query,
        includeRelations: true,
        limit: 100
      });
      const endTime = Date.now();

      expect(result.filteredCount).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
    });

    it('should use proper indexing for text search', async () => {
      const query: SpotlightQuery = {
        text: 'complex search term with multiple words'
      };

      mockQueryBuilder.getMany.mockResolvedValue([]);
      eventRepository.count.mockResolvedValue(0);

      await service.search({
        userId: mockUserId,
        query,
        includeRelations: true
      });

      // Verify that full-text search is used instead of LIKE queries
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('to_tsvector'),
        expect.objectContaining({ searchText: 'complex search term with multiple words' })
      );
    });
  });
});