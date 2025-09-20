import { Test, TestingModule } from '@nestjs/testing';
import { SavedFiltersController } from '../saved-filters.controller';
import { SavedFiltersService } from '../saved-filters.service';
import { User } from '../../../infra/database/entities/user.entity';
import { CreateSavedFilterDto, UpdateSavedFilterDto, DuplicateSavedFilterDto } from '../dto/saved-filter.dto';

describe('SavedFiltersController', () => {
  let controller: SavedFiltersController;
  let service: jest.Mocked<SavedFiltersService>;

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

  const mockSavedFilter = {
    id: 'filter-123',
    name: 'My Filter',
    query: { text: 'mathematics' }
  };

  beforeEach(async () => {
    const mockService = {
      getUserSavedFilters: jest.fn(),
      saveFilter: jest.fn(),
      getFilter: jest.fn(),
      updateFilter: jest.fn(),
      deleteFilter: jest.fn(),
      duplicateFilter: jest.fn(),
      exportFilters: jest.fn(),
      importFilters: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedFiltersController],
      providers: [
        {
          provide: SavedFiltersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<SavedFiltersController>(SavedFiltersController);
    service = module.get(SavedFiltersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSavedFilters', () => {
    it('should return user saved filters', async () => {
      service.getUserSavedFilters.mockResolvedValue([mockSavedFilter]);

      const result = await controller.getUserSavedFilters(mockUser);

      expect(service.getUserSavedFilters).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([mockSavedFilter]);
    });
  });

  describe('createSavedFilter', () => {
    it('should create a new saved filter', async () => {
      const createDto: CreateSavedFilterDto = {
        name: 'New Filter',
        query: { text: 'physics' }
      };

      service.saveFilter.mockResolvedValue(mockSavedFilter);

      const result = await controller.createSavedFilter(mockUser, createDto);

      expect(service.saveFilter).toHaveBeenCalledWith(mockUser.id, createDto);
      expect(result).toEqual(mockSavedFilter);
    });
  });

  describe('getSavedFilter', () => {
    it('should return a specific saved filter', async () => {
      const filterId = 'filter-123';

      service.getFilter.mockResolvedValue(mockSavedFilter);

      const result = await controller.getSavedFilter(mockUser, filterId);

      expect(service.getFilter).toHaveBeenCalledWith(mockUser.id, filterId);
      expect(result).toEqual(mockSavedFilter);
    });
  });

  describe('updateSavedFilter', () => {
    it('should update a saved filter', async () => {
      const filterId = 'filter-123';
      const updateDto: UpdateSavedFilterDto = {
        name: 'Updated Filter',
        query: { text: 'chemistry' }
      };

      const updatedFilter = { ...mockSavedFilter, ...updateDto };
      service.updateFilter.mockResolvedValue(updatedFilter);

      const result = await controller.updateSavedFilter(mockUser, filterId, updateDto);

      expect(service.updateFilter).toHaveBeenCalledWith(mockUser.id, filterId, updateDto);
      expect(result).toEqual(updatedFilter);
    });
  });

  describe('deleteSavedFilter', () => {
    it('should delete a saved filter', async () => {
      const filterId = 'filter-123';

      service.deleteFilter.mockResolvedValue(undefined);

      await controller.deleteSavedFilter(mockUser, filterId);

      expect(service.deleteFilter).toHaveBeenCalledWith(mockUser.id, filterId);
    });
  });

  describe('duplicateSavedFilter', () => {
    it('should duplicate a saved filter', async () => {
      const filterId = 'filter-123';
      const duplicateDto: DuplicateSavedFilterDto = {
        newName: 'Duplicated Filter'
      };

      const duplicatedFilter = { ...mockSavedFilter, id: 'new-id', name: duplicateDto.newName };
      service.duplicateFilter.mockResolvedValue(duplicatedFilter);

      const result = await controller.duplicateSavedFilter(mockUser, filterId, duplicateDto);

      expect(service.duplicateFilter).toHaveBeenCalledWith(mockUser.id, filterId, duplicateDto.newName);
      expect(result).toEqual(duplicatedFilter);
    });
  });

  describe('exportSavedFilters', () => {
    it('should export all saved filters', async () => {
      const filters = [mockSavedFilter];
      service.exportFilters.mockResolvedValue(filters);

      const result = await controller.exportSavedFilters(mockUser);

      expect(service.exportFilters).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(filters);
    });
  });

  describe('importSavedFilters', () => {
    it('should import saved filters', async () => {
      const importDto = {
        filters: [
          { name: 'Filter 1', query: { text: 'math' } },
          { name: 'Filter 2', query: { text: 'physics' } }
        ]
      };

      const importedFilters = [
        { id: '1', name: 'Filter 1', query: { text: 'math' } },
        { id: '2', name: 'Filter 2', query: { text: 'physics' } }
      ];

      service.importFilters.mockResolvedValue(importedFilters);

      const result = await controller.importSavedFilters(mockUser, importDto);

      expect(service.importFilters).toHaveBeenCalledWith(mockUser.id, importDto.filters);
      expect(result).toEqual(importedFilters);
    });
  });
});