import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  Logger,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../infra/database/entities/user.entity';
import { SavedFiltersService } from './saved-filters.service';
import { 
  CreateSavedFilterDto, 
  UpdateSavedFilterDto, 
  DuplicateSavedFilterDto,
  ImportSavedFiltersDto,
  SavedFilterResponseDto 
} from './dto/saved-filter.dto';

@Controller('spotlight/saved-filters')
@UseGuards(JwtAuthGuard)
export class SavedFiltersController {
  private readonly logger = new Logger(SavedFiltersController.name);

  constructor(private readonly savedFiltersService: SavedFiltersService) {}

  @Get()
  async getUserSavedFilters(@CurrentUser() user: User): Promise<SavedFilterResponseDto[]> {
    this.logger.debug(`Getting saved filters for user ${user.id}`);
    return this.savedFiltersService.getUserSavedFilters(user.id);
  }

  @Post()
  async createSavedFilter(
    @CurrentUser() user: User,
    @Body() createFilterDto: CreateSavedFilterDto
  ): Promise<SavedFilterResponseDto> {
    this.logger.debug(`Creating saved filter "${createFilterDto.name}" for user ${user.id}`);
    return this.savedFiltersService.saveFilter(user.id, createFilterDto);
  }

  @Get(':id')
  async getSavedFilter(
    @CurrentUser() user: User,
    @Param('id') filterId: string
  ): Promise<SavedFilterResponseDto> {
    this.logger.debug(`Getting saved filter ${filterId} for user ${user.id}`);
    return this.savedFiltersService.getFilter(user.id, filterId);
  }

  @Put(':id')
  async updateSavedFilter(
    @CurrentUser() user: User,
    @Param('id') filterId: string,
    @Body() updateFilterDto: UpdateSavedFilterDto
  ): Promise<SavedFilterResponseDto> {
    this.logger.debug(`Updating saved filter ${filterId} for user ${user.id}`);
    return this.savedFiltersService.updateFilter(user.id, filterId, updateFilterDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSavedFilter(
    @CurrentUser() user: User,
    @Param('id') filterId: string
  ): Promise<void> {
    this.logger.debug(`Deleting saved filter ${filterId} for user ${user.id}`);
    await this.savedFiltersService.deleteFilter(user.id, filterId);
  }

  @Post(':id/duplicate')
  async duplicateSavedFilter(
    @CurrentUser() user: User,
    @Param('id') filterId: string,
    @Body() duplicateDto: DuplicateSavedFilterDto
  ): Promise<SavedFilterResponseDto> {
    this.logger.debug(`Duplicating saved filter ${filterId} as "${duplicateDto.newName}" for user ${user.id}`);
    return this.savedFiltersService.duplicateFilter(user.id, filterId, duplicateDto.newName);
  }

  @Get('export/all')
  async exportSavedFilters(@CurrentUser() user: User): Promise<SavedFilterResponseDto[]> {
    this.logger.debug(`Exporting saved filters for user ${user.id}`);
    return this.savedFiltersService.exportFilters(user.id);
  }

  @Post('import')
  async importSavedFilters(
    @CurrentUser() user: User,
    @Body() importDto: ImportSavedFiltersDto
  ): Promise<SavedFilterResponseDto[]> {
    this.logger.debug(`Importing ${importDto.filters.length} saved filters for user ${user.id}`);
    return this.savedFiltersService.importFilters(user.id, importDto.filters);
  }
}