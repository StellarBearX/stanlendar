import { 
  Controller, 
  Get, 
  Query, 
  UseGuards, 
  Logger,
  ParseIntPipe,
  DefaultValuePipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../infra/database/entities/user.entity';
import { SpotlightService } from './spotlight.service';
import { SpotlightQueryDto, SpotlightResultDto } from './dto/spotlight-query.dto';
import { SpotlightQuery } from './interfaces/spotlight.interface';

@Controller('spotlight')
@UseGuards(JwtAuthGuard)
export class SpotlightController {
  private readonly logger = new Logger(SpotlightController.name);

  constructor(private readonly spotlightService: SpotlightService) {}

  @Get('search')
  async search(
    @CurrentUser() user: User,
    @Query() queryDto: SpotlightQueryDto,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<SpotlightResultDto> {
    this.logger.debug(`Spotlight search request from user ${user.id}`, { queryDto, limit, offset });

    const query: SpotlightQuery = {
      subjectIds: queryDto.subjectIds,
      sectionIds: queryDto.sectionIds,
      secCodes: queryDto.secCodes,
      text: queryDto.text,
      room: queryDto.room,
      teacher: queryDto.teacher,
      dateFrom: queryDto.dateFrom,
      dateTo: queryDto.dateTo,
      viewMode: queryDto.viewMode
    };

    const result = await this.spotlightService.search({
      userId: user.id,
      query,
      includeRelations: true,
      limit,
      offset
    });

    return {
      events: result.events,
      subjects: result.subjects,
      sections: result.sections,
      totalCount: result.totalCount,
      filteredCount: result.filteredCount
    };
  }

  @Get('suggestions/subjects')
  async getSubjectSuggestions(
    @CurrentUser() user: User,
    @Query('text') text: string,
  ): Promise<string[]> {
    if (!text || text.trim().length < 2) {
      return [];
    }

    return this.spotlightService.getSuggestions(user.id, text, 'subjects');
  }

  @Get('suggestions/rooms')
  async getRoomSuggestions(
    @CurrentUser() user: User,
    @Query('text') text: string,
  ): Promise<string[]> {
    if (!text || text.trim().length < 2) {
      return [];
    }

    return this.spotlightService.getSuggestions(user.id, text, 'rooms');
  }

  @Get('suggestions/teachers')
  async getTeacherSuggestions(
    @CurrentUser() user: User,
    @Query('text') text: string,
  ): Promise<string[]> {
    if (!text || text.trim().length < 2) {
      return [];
    }

    return this.spotlightService.getSuggestions(user.id, text, 'teachers');
  }

  @Get('suggestions/sections')
  async getSectionSuggestions(
    @CurrentUser() user: User,
    @Query('text') text: string,
  ): Promise<string[]> {
    if (!text || text.trim().length < 2) {
      return [];
    }

    return this.spotlightService.getSuggestions(user.id, text, 'sections');
  }
}