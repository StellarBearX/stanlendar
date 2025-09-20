import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedFilter } from '../../infra/database/entities/saved-filter.entity';
import { SpotlightQuery } from './interfaces/spotlight.interface';

export interface SavedFilterData {
  name: string;
  query: SpotlightQuery;
}

export interface SavedFilterResponse {
  id: string;
  name: string;
  query: SpotlightQuery;
}

@Injectable()
export class SavedFiltersService {
  private readonly logger = new Logger(SavedFiltersService.name);

  constructor(
    @InjectRepository(SavedFilter)
    private readonly savedFilterRepository: Repository<SavedFilter>,
  ) {}

  async getUserSavedFilters(userId: string): Promise<SavedFilterResponse[]> {
    this.logger.debug(`Getting saved filters for user ${userId}`);

    const filters = await this.savedFilterRepository.find({
      where: { userId },
      order: { name: 'ASC' }
    });

    return filters.map(filter => ({
      id: filter.id,
      name: filter.name,
      query: filter.query
    }));
  }

  async saveFilter(userId: string, filterData: SavedFilterData): Promise<SavedFilterResponse> {
    this.logger.debug(`Saving filter "${filterData.name}" for user ${userId}`);

    // Check if filter with same name already exists
    const existingFilter = await this.savedFilterRepository.findOne({
      where: { userId, name: filterData.name }
    });

    if (existingFilter) {
      throw new ConflictException(`Filter with name "${filterData.name}" already exists`);
    }

    // Validate query has at least one filter
    if (!this.hasActiveFilters(filterData.query)) {
      throw new ConflictException('Cannot save empty filter');
    }

    const savedFilter = this.savedFilterRepository.create({
      userId,
      name: filterData.name,
      query: filterData.query
    });

    const result = await this.savedFilterRepository.save(savedFilter);

    this.logger.debug(`Saved filter "${filterData.name}" with ID ${result.id}`);

    return {
      id: result.id,
      name: result.name,
      query: result.query
    };
  }

  async updateFilter(userId: string, filterId: string, filterData: SavedFilterData): Promise<SavedFilterResponse> {
    this.logger.debug(`Updating filter ${filterId} for user ${userId}`);

    const existingFilter = await this.savedFilterRepository.findOne({
      where: { id: filterId, userId }
    });

    if (!existingFilter) {
      throw new NotFoundException('Filter not found');
    }

    // Check if new name conflicts with another filter
    if (filterData.name !== existingFilter.name) {
      const nameConflict = await this.savedFilterRepository.findOne({
        where: { userId, name: filterData.name }
      });

      if (nameConflict) {
        throw new ConflictException(`Filter with name "${filterData.name}" already exists`);
      }
    }

    // Validate query has at least one filter
    if (!this.hasActiveFilters(filterData.query)) {
      throw new ConflictException('Cannot save empty filter');
    }

    existingFilter.name = filterData.name;
    existingFilter.query = filterData.query;

    const result = await this.savedFilterRepository.save(existingFilter);

    this.logger.debug(`Updated filter ${filterId}`);

    return {
      id: result.id,
      name: result.name,
      query: result.query
    };
  }

  async deleteFilter(userId: string, filterId: string): Promise<void> {
    this.logger.debug(`Deleting filter ${filterId} for user ${userId}`);

    const result = await this.savedFilterRepository.delete({
      id: filterId,
      userId
    });

    if (result.affected === 0) {
      throw new NotFoundException('Filter not found');
    }

    this.logger.debug(`Deleted filter ${filterId}`);
  }

  async getFilter(userId: string, filterId: string): Promise<SavedFilterResponse> {
    this.logger.debug(`Getting filter ${filterId} for user ${userId}`);

    const filter = await this.savedFilterRepository.findOne({
      where: { id: filterId, userId }
    });

    if (!filter) {
      throw new NotFoundException('Filter not found');
    }

    return {
      id: filter.id,
      name: filter.name,
      query: filter.query
    };
  }

  async duplicateFilter(userId: string, filterId: string, newName: string): Promise<SavedFilterResponse> {
    this.logger.debug(`Duplicating filter ${filterId} as "${newName}" for user ${userId}`);

    const originalFilter = await this.savedFilterRepository.findOne({
      where: { id: filterId, userId }
    });

    if (!originalFilter) {
      throw new NotFoundException('Filter not found');
    }

    // Check if new name already exists
    const nameConflict = await this.savedFilterRepository.findOne({
      where: { userId, name: newName }
    });

    if (nameConflict) {
      throw new ConflictException(`Filter with name "${newName}" already exists`);
    }

    const duplicatedFilter = this.savedFilterRepository.create({
      userId,
      name: newName,
      query: originalFilter.query
    });

    const result = await this.savedFilterRepository.save(duplicatedFilter);

    this.logger.debug(`Duplicated filter ${filterId} as ${result.id}`);

    return {
      id: result.id,
      name: result.name,
      query: result.query
    };
  }

  async exportFilters(userId: string): Promise<SavedFilterResponse[]> {
    this.logger.debug(`Exporting filters for user ${userId}`);

    const filters = await this.getUserSavedFilters(userId);
    
    this.logger.debug(`Exported ${filters.length} filters for user ${userId}`);
    
    return filters;
  }

  async importFilters(userId: string, filters: SavedFilterData[]): Promise<SavedFilterResponse[]> {
    this.logger.debug(`Importing ${filters.length} filters for user ${userId}`);

    const results: SavedFilterResponse[] = [];
    const errors: string[] = [];

    for (const filterData of filters) {
      try {
        // Check if filter name already exists
        const existingFilter = await this.savedFilterRepository.findOne({
          where: { userId, name: filterData.name }
        });

        let finalName = filterData.name;
        if (existingFilter) {
          // Generate unique name
          let counter = 1;
          while (await this.savedFilterRepository.findOne({
            where: { userId, name: `${filterData.name} (${counter})` }
          })) {
            counter++;
          }
          finalName = `${filterData.name} (${counter})`;
        }

        const result = await this.saveFilter(userId, {
          name: finalName,
          query: filterData.query
        });

        results.push(result);
      } catch (error) {
        errors.push(`Failed to import "${filterData.name}": ${error.message}`);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`Import completed with errors: ${errors.join(', ')}`);
    }

    this.logger.debug(`Imported ${results.length} filters for user ${userId}`);

    return results;
  }

  private hasActiveFilters(query: SpotlightQuery): boolean {
    return !!(
      query.text?.trim() ||
      (query.subjectIds && query.subjectIds.length > 0) ||
      (query.sectionIds && query.sectionIds.length > 0) ||
      (query.secCodes && query.secCodes.length > 0) ||
      query.room?.trim() ||
      query.teacher?.trim() ||
      query.dateFrom ||
      query.dateTo
    );
  }
}