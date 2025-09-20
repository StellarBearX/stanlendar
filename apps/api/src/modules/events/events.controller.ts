import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventGenerationService } from './event-generation.service';
import { GenerateEventsDto } from './dto/generate-events.dto';
import { EventGenerationResultDto } from './dto/event-generation-result.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventGenerationService: EventGenerationService) {}

  @Post('generate/section/:sectionId')
  @HttpCode(HttpStatus.CREATED)
  async generateEventsForSection(
    @CurrentUser('id') userId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() generateEventsDto: GenerateEventsDto,
  ): Promise<EventGenerationResultDto> {
    const result = await this.eventGenerationService.generateEventsForSection(
      userId,
      sectionId,
      generateEventsDto
    );
    return EventGenerationResultDto.fromResult(result);
  }

  @Post('generate/subject/:subjectId')
  @HttpCode(HttpStatus.CREATED)
  async generateEventsForSubject(
    @CurrentUser('id') userId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Body() generateEventsDto: GenerateEventsDto,
  ): Promise<EventGenerationResultDto> {
    const result = await this.eventGenerationService.generateEventsForSubject(
      userId,
      subjectId,
      generateEventsDto
    );
    return EventGenerationResultDto.fromResult(result);
  }

  @Post('regenerate/section/:sectionId')
  @HttpCode(HttpStatus.CREATED)
  async regenerateEventsForSection(
    @CurrentUser('id') userId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() generateEventsDto: GenerateEventsDto,
  ): Promise<EventGenerationResultDto> {
    const result = await this.eventGenerationService.regenerateEventsForSection(
      userId,
      sectionId,
      generateEventsDto
    );
    return EventGenerationResultDto.fromResult(result);
  }

  @Delete('section/:sectionId')
  @HttpCode(HttpStatus.OK)
  async deleteEventsForSection(
    @CurrentUser('id') userId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ): Promise<{ deleted: number }> {
    const deleted = await this.eventGenerationService.deleteEventsForSection(userId, sectionId);
    return { deleted };
  }
}