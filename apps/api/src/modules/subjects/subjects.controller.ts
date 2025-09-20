import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { QuickAddService, QuickAddResult } from './quick-add.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { QuickAddClassDto } from './dto/quick-add-class.dto';
import { SubjectResponseDto } from './dto/subject-response.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('subjects')
@UseGuards(JwtAuthGuard)
export class SubjectsController {
  constructor(
    private readonly subjectsService: SubjectsService,
    private readonly quickAddService: QuickAddService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('id') userId: string,
    @Body() createSubjectDto: CreateSubjectDto,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.create(userId, createSubjectDto);
  }

  @Post('quick-add')
  @HttpCode(HttpStatus.CREATED)
  async quickAddClass(
    @CurrentUser('id') userId: string,
    @Body() quickAddDto: QuickAddClassDto,
  ): Promise<QuickAddResult> {
    return this.quickAddService.quickAddClass(userId, quickAddDto);
  }

  @Get()
  async findAll(@CurrentUser('id') userId: string): Promise<SubjectResponseDto[]> {
    return this.subjectsService.findAll(userId);
  }

  @Get('search')
  async search(
    @CurrentUser('id') userId: string,
    @Query('q') searchText: string,
  ): Promise<SubjectResponseDto[]> {
    return this.subjectsService.search(userId, searchText);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.findOne(userId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
  ): Promise<SubjectResponseDto> {
    return this.subjectsService.update(userId, id, updateSubjectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.subjectsService.remove(userId, id);
  }
}