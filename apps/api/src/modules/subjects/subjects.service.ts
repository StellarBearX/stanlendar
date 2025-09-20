import { Injectable, ConflictException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { SubjectRepository } from '../../infra/database/repositories/interfaces/subject-repository.interface';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectResponseDto } from './dto/subject-response.dto';
import { Subject } from '../../infra/database/entities/subject.entity';

@Injectable()
export class SubjectsService {
  constructor(
    @Inject('SubjectRepository')
    private readonly subjectRepository: SubjectRepository
  ) {}

  async create(userId: string, createSubjectDto: CreateSubjectDto): Promise<SubjectResponseDto> {
    // Validate and normalize color
    const normalizedColor = this.normalizeColor(createSubjectDto.colorHex);
    
    // Check for duplicate subject (same user + code + name combination)
    if (createSubjectDto.code) {
      const existingByCode = await this.subjectRepository.findByUserIdAndCode(userId, createSubjectDto.code);
      if (existingByCode) {
        throw new ConflictException(`Subject with code '${createSubjectDto.code}' already exists`);
      }
    }

    const existingByName = await this.subjectRepository.findByUserIdAndName(userId, createSubjectDto.name);
    if (existingByName) {
      throw new ConflictException(`Subject with name '${createSubjectDto.name}' already exists`);
    }

    // Create subject
    const subjectData: Partial<Subject> = {
      userId,
      code: createSubjectDto.code,
      name: createSubjectDto.name.trim(),
      colorHex: normalizedColor,
      meta: createSubjectDto.meta || {},
    };

    const subject = await this.subjectRepository.create(subjectData);
    return SubjectResponseDto.fromEntity(subject);
  }

  async findAll(userId: string): Promise<SubjectResponseDto[]> {
    const subjects = await this.subjectRepository.findByUserId(userId);
    return SubjectResponseDto.fromEntities(subjects);
  }

  async findOne(userId: string, id: string): Promise<SubjectResponseDto> {
    const subject = await this.subjectRepository.findById(id);
    
    if (!subject || subject.userId !== userId) {
      throw new NotFoundException(`Subject with ID '${id}' not found`);
    }

    return SubjectResponseDto.fromEntity(subject);
  }

  async update(userId: string, id: string, updateSubjectDto: UpdateSubjectDto): Promise<SubjectResponseDto> {
    const existingSubject = await this.subjectRepository.findById(id);
    
    if (!existingSubject || existingSubject.userId !== userId) {
      throw new NotFoundException(`Subject with ID '${id}' not found`);
    }

    // Check for conflicts if updating code or name
    if (updateSubjectDto.code && updateSubjectDto.code !== existingSubject.code) {
      const existingByCode = await this.subjectRepository.findByUserIdAndCode(userId, updateSubjectDto.code);
      if (existingByCode && existingByCode.id !== id) {
        throw new ConflictException(`Subject with code '${updateSubjectDto.code}' already exists`);
      }
    }

    if (updateSubjectDto.name && updateSubjectDto.name !== existingSubject.name) {
      const existingByName = await this.subjectRepository.findByUserIdAndName(userId, updateSubjectDto.name);
      if (existingByName && existingByName.id !== id) {
        throw new ConflictException(`Subject with name '${updateSubjectDto.name}' already exists`);
      }
    }

    // Prepare update data
    const updateData: Partial<Subject> = {};
    
    if (updateSubjectDto.code !== undefined) {
      updateData.code = updateSubjectDto.code;
    }
    
    if (updateSubjectDto.name !== undefined) {
      updateData.name = updateSubjectDto.name.trim();
    }
    
    if (updateSubjectDto.colorHex !== undefined) {
      updateData.colorHex = this.normalizeColor(updateSubjectDto.colorHex);
    }
    
    if (updateSubjectDto.meta !== undefined) {
      updateData.meta = updateSubjectDto.meta;
    }

    const updatedSubject = await this.subjectRepository.update(id, updateData);
    
    if (!updatedSubject) {
      throw new NotFoundException(`Subject with ID '${id}' not found`);
    }

    return SubjectResponseDto.fromEntity(updatedSubject);
  }

  async remove(userId: string, id: string): Promise<void> {
    const subject = await this.subjectRepository.findById(id);
    
    if (!subject || subject.userId !== userId) {
      throw new NotFoundException(`Subject with ID '${id}' not found`);
    }

    // Check if subject has sections or events
    if (subject.sections && subject.sections.length > 0) {
      throw new BadRequestException('Cannot delete subject with existing sections. Delete sections first.');
    }

    if (subject.events && subject.events.length > 0) {
      throw new BadRequestException('Cannot delete subject with existing events. Delete events first.');
    }

    const deleted = await this.subjectRepository.delete(id);
    
    if (!deleted) {
      throw new NotFoundException(`Subject with ID '${id}' not found`);
    }
  }

  async search(userId: string, searchText: string): Promise<SubjectResponseDto[]> {
    if (!searchText || searchText.trim().length === 0) {
      return this.findAll(userId);
    }

    const subjects = await this.subjectRepository.searchByText(userId, searchText.trim());
    return SubjectResponseDto.fromEntities(subjects);
  }

  /**
   * Normalize and validate hex color
   */
  private normalizeColor(colorHex: string): string {
    if (!colorHex) {
      throw new BadRequestException('Color is required');
    }

    // Remove # if present and convert to lowercase
    let normalized = colorHex.replace('#', '').toLowerCase();
    
    // Validate hex format
    if (!/^[0-9a-f]{6}$/.test(normalized)) {
      throw new BadRequestException('Invalid hex color format. Expected format: #RRGGBB or RRGGBB');
    }

    // Return with # prefix
    return `#${normalized}`;
  }
}