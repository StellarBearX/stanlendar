import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SavedFiltersService } from '../saved-filters.service';
import { SavedFilter } from '../../../infra/database/entities/saved-filter.entity';
import { SpotlightQuery } from '../interfaces/spotlight.interface';

describe('SavedFiltersService', () => {
  let service: SavedFiltersService;
  let repository: jest.Mocked<Repository<SavedFilter>>;

  const mockUserId = 'user-123';
  const mockFilterId = 'filter-123';

  const mockQuery: SpotlightQuery = {
    text: 'mathematics',
    subjectIds: ['subject-1'],
    dateFrom: '2024-01-01',
    dateTo: '2024-01-31'
  };

  const mockSavedFilter: SavedFilter = {
    id: mockFilterId,
    userId: mockUserId,
    name: 'My Math Filter',
    query: mockQuery,
    user: null
  };

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedFiltersService,
        {
          provide: getRepositoryToken(SavedFilter),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SavedFiltersService>(SavedFiltersService);
    repository = module.get(getRepositoryToken(SavedFilter));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSavedFilters', () => {
    it('should return user saved filters', async () => {
      repository.find.mockResolvedValue([mockSavedFilter]);

      const result = await service.getUserSavedFilters(mockUserId);

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { name: 'ASC' }
      });

      expect(result).toEqual([{
        id: mockFilterId,
        name: 'My Math Filter',
        query: mockQuery
      }]);
    });

    it('should return empty array when no filters exist', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.getUserSavedFilters(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('saveFilter', () => {
    it('should save a new filter', async () => {
      const filterData = {
        name: 'New Filter',
        query: mockQuery
      };

      repository.findOne.mockResolvedValue(null); // No existing filter
      repository.create.mockReturnValue(mockSavedFilter);
      repository.save.mockResolvedValue(mockSavedFilter);

      const result = await service.saveFilter(mockUserId, filterData);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { userId: mockUserId, name: filterData.name }
      });
      expect(repository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        name: filterData.name,
        query: filterData.query
      });
      expect(repository.save).toHaveBeenCalledWith(mockSavedFilter);

      expect(result).toEqual({
        id: mockFilterId,
        name: 'My Math Filter',
        query: mockQuery
      });
    });

    it('should throw ConflictException when filter name already exists', async () => {
      const filterData = {
        name: 'Existing Filter',
        query: mockQuery
      };

      repository.findOne.mockResolvedValue(mockSavedFilter);

      await expect(service.saveFilter(mockUserId, filterData))
        .rejects.toThrow(ConflictException);

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when trying to save empty filter', async () => {
      const filterData = {
        name: 'Empty Filter',
        query: {} // Empty query
      };

      repository.findOne.mockResolvedValue(null);

      await expect(service.saveFilter(mockUserId, filterData))
        .rejects.toThrow(ConflictException);

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateFilter', () => {
    it('should update an existing filter', async () => {
      const filterData = {
        name: 'Updated Filter',
        query: { text: 'physics' }
      };

      const updatedFilter = { ...mockSavedFilter, ...filterData };

      repository.findOne
        .mockResolvedValueOnce(mockSavedFilter) // First call for existing filter
        .mockResolvedValueOnce(null); // Second call for name conflict check (no conflict)
      repository.save.mockResolvedValue(updatedFilter);

      const result = await service.updateFilter(mockUserId, mockFilterId, filterData);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockFilterId, userId: mockUserId }
      });
      expect(repository.save).toHaveBeenCalled();

      expect(result).toEqual({
        id: mockFilterId,
        name: 'Updated Filter',
        query: { text: 'physics' }
      });
    });

    it('should throw NotFoundException when filter does not exist', async () => {
      const filterData = {
        name: 'Updated Filter',
        query: mockQuery
      };

      repository.findOne.mockResolvedValue(null);

      await expect(service.updateFilter(mockUserId, mockFilterId, filterData))
        .rejects.toThrow(NotFoundException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when new name conflicts', async () => {
      const filterData = {
        name: 'Conflicting Name',
        query: mockQuery
      };

      const existingFilter = { ...mockSavedFilter, name: 'Original Name' };
      const conflictingFilter = { ...mockSavedFilter, id: 'other-id', name: 'Conflicting Name' };

      repository.findOne
        .mockResolvedValueOnce(existingFilter) // First call for existing filter
        .mockResolvedValueOnce(conflictingFilter); // Second call for name conflict check

      await expect(service.updateFilter(mockUserId, mockFilterId, filterData))
        .rejects.toThrow(ConflictException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteFilter', () => {
    it('should delete an existing filter', async () => {
      repository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.deleteFilter(mockUserId, mockFilterId);

      expect(repository.delete).toHaveBeenCalledWith({
        id: mockFilterId,
        userId: mockUserId
      });
    });

    it('should throw NotFoundException when filter does not exist', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(service.deleteFilter(mockUserId, mockFilterId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getFilter', () => {
    it('should return a specific filter', async () => {
      repository.findOne.mockResolvedValue(mockSavedFilter);

      const result = await service.getFilter(mockUserId, mockFilterId);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockFilterId, userId: mockUserId }
      });

      expect(result).toEqual({
        id: mockFilterId,
        name: mockSavedFilter.name,
        query: mockSavedFilter.query
      });
    });

    it('should throw NotFoundException when filter does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getFilter(mockUserId, mockFilterId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('duplicateFilter', () => {
    it('should duplicate an existing filter', async () => {
      const newName = 'Duplicated Filter';
      const duplicatedFilter = { ...mockSavedFilter, id: 'new-id', name: newName };

      repository.findOne
        .mockResolvedValueOnce(mockSavedFilter) // Original filter
        .mockResolvedValueOnce(null); // No name conflict
      repository.create.mockReturnValue(duplicatedFilter);
      repository.save.mockResolvedValue(duplicatedFilter);

      const result = await service.duplicateFilter(mockUserId, mockFilterId, newName);

      expect(repository.create).toHaveBeenCalledWith({
        userId: mockUserId,
        name: newName,
        query: mockSavedFilter.query
      });

      expect(result).toEqual({
        id: 'new-id',
        name: newName,
        query: mockSavedFilter.query
      });
    });

    it('should throw NotFoundException when original filter does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.duplicateFilter(mockUserId, mockFilterId, 'New Name'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when new name already exists', async () => {
      const newName = 'Existing Name';
      const conflictingFilter = { ...mockSavedFilter, name: newName };

      repository.findOne
        .mockResolvedValueOnce(mockSavedFilter) // Original filter
        .mockResolvedValueOnce(conflictingFilter); // Name conflict

      await expect(service.duplicateFilter(mockUserId, mockFilterId, newName))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('importFilters', () => {
    it('should import multiple filters', async () => {
      const filtersToImport = [
        { name: 'Filter 1', query: { text: 'math' } },
        { name: 'Filter 2', query: { text: 'physics' } }
      ];

      repository.findOne.mockResolvedValue(null); // No conflicts
      repository.create.mockReturnValue(mockSavedFilter);
      repository.save.mockResolvedValue(mockSavedFilter);

      const result = await service.importFilters(mockUserId, filtersToImport);

      expect(result).toHaveLength(2);
      expect(repository.save).toHaveBeenCalledTimes(2);
    });

    it('should handle name conflicts by appending counter', async () => {
      const filtersToImport = [
        { name: 'Existing Filter', query: { text: 'math' } }
      ];

      const existingFilter = { ...mockSavedFilter, name: 'Existing Filter' };
      const renamedFilter = { ...mockSavedFilter, name: 'Existing Filter (1)' };

      repository.findOne
        .mockResolvedValueOnce(existingFilter) // Name conflict
        .mockResolvedValueOnce(null) // No conflict with renamed
        .mockResolvedValueOnce(null); // No conflict check for save

      repository.create.mockReturnValue(renamedFilter);
      repository.save.mockResolvedValue(renamedFilter);

      const result = await service.importFilters(mockUserId, filtersToImport);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Existing Filter (1)');
    });
  });
});