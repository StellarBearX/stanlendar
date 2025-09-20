import { Test, TestingModule } from '@nestjs/testing';
import { SpotlightController } from '../spotlight.controller';
import { SpotlightService } from '../spotlight.service';
import { User } from '../../../infra/database/entities/user.entity';
import { SpotlightQueryDto } from '../dto/spotlight-query.dto';

describe('SpotlightController', () => {
  let controller: SpotlightController;
  let spotlightService: jest.Mocked<SpotlightService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    createdAt: new Date(),
    lastLoginAt: new Date(),
    subjects: [],
    events: [],
    calendarAccounts: [],
    savedFilters: [],
    importJobs: []
  };

  beforeEach(async () => {
    const mockSpotlightService = {
      search: jest.fn(),
      getSuggestions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpotlightController],
      providers: [
        {
          provide: SpotlightService,
          useValue: mockSpotlightService,
        },
      ],
    }).compile();

    controller = module.get<SpotlightController>(SpotlightController);
    spotlightService = module.get(SpotlightService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should perform search with query parameters', async () => {
      const queryDto: SpotlightQueryDto = {
        text: 'mathematics',
        subjectIds: ['subject-1'],
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      };

      const mockResult = {
        events: [],
        subjects: [],
        sections: [],
        totalCount: 0,
        filteredCount: 0
      };

      spotlightService.search.mockResolvedValue(mockResult);

      const result = await controller.search(mockUser, queryDto, 50, 10);

      expect(spotlightService.search).toHaveBeenCalledWith({
        userId: mockUser.id,
        query: {
          text: 'mathematics',
          subjectIds: ['subject-1'],
          sectionIds: undefined,
          secCodes: undefined,
          room: undefined,
          teacher: undefined,
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
          viewMode: undefined
        },
        includeRelations: true,
        limit: 50,
        offset: 10
      });

      expect(result).toEqual(mockResult);
    });

    it('should use default pagination values', async () => {
      const queryDto: SpotlightQueryDto = {};
      const mockResult = {
        events: [],
        subjects: [],
        sections: [],
        totalCount: 0,
        filteredCount: 0
      };

      spotlightService.search.mockResolvedValue(mockResult);

      await controller.search(mockUser, queryDto, 100, 0);

      expect(spotlightService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
          offset: 0
        })
      );
    });
  });

  describe('suggestion endpoints', () => {
    it('should get subject suggestions', async () => {
      const mockSuggestions = ['MATH101 Mathematics', 'MATH201 Advanced Math'];
      spotlightService.getSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getSubjectSuggestions(mockUser, 'math');

      expect(spotlightService.getSuggestions).toHaveBeenCalledWith(
        mockUser.id,
        'math',
        'subjects'
      );
      expect(result).toEqual(mockSuggestions);
    });

    it('should return empty array for short subject text', async () => {
      const result = await controller.getSubjectSuggestions(mockUser, 'a');
      expect(result).toEqual([]);
      expect(spotlightService.getSuggestions).not.toHaveBeenCalled();
    });

    it('should get room suggestions', async () => {
      const mockSuggestions = ['A101', 'A102', 'A103'];
      spotlightService.getSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getRoomSuggestions(mockUser, 'A10');

      expect(spotlightService.getSuggestions).toHaveBeenCalledWith(
        mockUser.id,
        'A10',
        'rooms'
      );
      expect(result).toEqual(mockSuggestions);
    });

    it('should get teacher suggestions', async () => {
      const mockSuggestions = ['Dr. Smith', 'Dr. Johnson'];
      spotlightService.getSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getTeacherSuggestions(mockUser, 'Dr');

      expect(spotlightService.getSuggestions).toHaveBeenCalledWith(
        mockUser.id,
        'Dr',
        'teachers'
      );
      expect(result).toEqual(mockSuggestions);
    });

    it('should get section suggestions', async () => {
      const mockSuggestions = ['001', '002', '003'];
      spotlightService.getSuggestions.mockResolvedValue(mockSuggestions);

      const result = await controller.getSectionSuggestions(mockUser, '00');

      expect(spotlightService.getSuggestions).toHaveBeenCalledWith(
        mockUser.id,
        '00',
        'sections'
      );
      expect(result).toEqual(mockSuggestions);
    });

    it('should handle empty text in suggestions', async () => {
      const result = await controller.getRoomSuggestions(mockUser, '');
      expect(result).toEqual([]);
      expect(spotlightService.getSuggestions).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only text in suggestions', async () => {
      const result = await controller.getTeacherSuggestions(mockUser, '   ');
      expect(result).toEqual([]);
      expect(spotlightService.getSuggestions).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      const queryDto: SpotlightQueryDto = { text: 'test' };
      spotlightService.search.mockRejectedValue(new Error('Database error'));

      await expect(controller.search(mockUser, queryDto, 100, 0))
        .rejects.toThrow('Database error');
    });

    it('should handle suggestion service errors gracefully', async () => {
      spotlightService.getSuggestions.mockRejectedValue(new Error('Database error'));

      await expect(controller.getSubjectSuggestions(mockUser, 'test'))
        .rejects.toThrow('Database error');
    });
  });
});