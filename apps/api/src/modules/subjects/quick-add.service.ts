import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { SubjectRepository } from '../../infra/database/repositories/interfaces/subject-repository.interface';
import { SectionRepository } from '../../infra/database/repositories/interfaces/section-repository.interface';
import { QuickAddClassDto } from './dto/quick-add-class.dto';
import { SubjectResponseDto } from './dto/subject-response.dto';
import { SectionResponseDto } from '../sections/dto/section-response.dto';
import { Subject } from '../../infra/database/entities/subject.entity';
import { Section } from '../../infra/database/entities/section.entity';
import { EventGenerationService } from '../events/event-generation.service';

export interface QuickAddResult {
  subject: SubjectResponseDto;
  section: SectionResponseDto;
  eventsGenerated: number;
}

@Injectable()
export class QuickAddService {
  constructor(
    @Inject('SubjectRepository')
    private readonly subjectRepository: SubjectRepository,
    @Inject('SectionRepository')
    private readonly sectionRepository: SectionRepository,
    private readonly eventGenerationService: EventGenerationService,
  ) {}

  async quickAddClass(userId: string, quickAddDto: QuickAddClassDto): Promise<QuickAddResult> {
    // Validate input data
    this.validateQuickAddData(quickAddDto);

    // Step 1: Create or find subject
    const subject = await this.createOrFindSubject(userId, quickAddDto);

    // Step 2: Create section
    const section = await this.createSection(subject.id, quickAddDto);

    // Step 3: Generate events
    const eventsGenerated = await this.eventGenerationService.generateEventsForSection(section.id);

    return {
      subject: SubjectResponseDto.fromEntity(subject),
      section: SectionResponseDto.fromEntity(section),
      eventsGenerated,
    };
  }

  private validateQuickAddData(quickAddDto: QuickAddClassDto): void {
    // Validate time range
    const startTime = this.parseTime(quickAddDto.startTime);
    const endTime = this.parseTime(quickAddDto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException(
        `Start time (${quickAddDto.startTime}) must be before end time (${quickAddDto.endTime})`
      );
    }

    // Check for reasonable duration (at least 15 minutes, max 8 hours)
    const durationMinutes = (endTime - startTime) / (1000 * 60);
    if (durationMinutes < 15) {
      throw new BadRequestException('Class duration must be at least 15 minutes');
    }
    if (durationMinutes > 480) { // 8 hours
      throw new BadRequestException('Class duration cannot exceed 8 hours');
    }

    // Validate date range
    const startDate = new Date(quickAddDto.startDate);
    const endDate = new Date(quickAddDto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException(
        `Start date (${quickAddDto.startDate}) must be before end date (${quickAddDto.endDate})`
      );
    }

    // Check for reasonable duration (max 1 year)
    const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays > 365) {
      throw new BadRequestException('Schedule duration cannot exceed 1 year');
    }

    // Validate skip dates
    if (quickAddDto.skipDates) {
      for (const skipDate of quickAddDto.skipDates) {
        const skip = new Date(skipDate);
        if (skip < startDate || skip > endDate) {
          throw new BadRequestException(
            `Skip date ${skipDate} must be within the schedule date range (${quickAddDto.startDate} to ${quickAddDto.endDate})`
          );
        }
      }
    }

    // Validate color format
    const normalizedColor = this.normalizeColor(quickAddDto.subjectColor);
    if (!normalizedColor) {
      throw new BadRequestException('Invalid hex color format. Expected format: #RRGGBB or RRGGBB');
    }
  }

  private async createOrFindSubject(userId: string, quickAddDto: QuickAddClassDto): Promise<Subject> {
    // First, try to find existing subject by name
    const existingByName = await this.subjectRepository.findByUserIdAndName(userId, quickAddDto.subjectName.trim());
    if (existingByName) {
      // Update the existing subject with new information if provided
      const updateData: Partial<Subject> = {};
      let needsUpdate = false;

      // Update code if provided and different
      if (quickAddDto.subjectCode && quickAddDto.subjectCode !== existingByName.code) {
        // Check if the new code conflicts with another subject
        const existingByCode = await this.subjectRepository.findByUserIdAndCode(userId, quickAddDto.subjectCode);
        if (existingByCode && existingByCode.id !== existingByName.id) {
          throw new BadRequestException(`Subject with code '${quickAddDto.subjectCode}' already exists`);
        }
        updateData.code = quickAddDto.subjectCode;
        needsUpdate = true;
      }

      // Update color if different
      const normalizedColor = this.normalizeColor(quickAddDto.subjectColor);
      if (normalizedColor !== existingByName.colorHex) {
        updateData.colorHex = normalizedColor;
        needsUpdate = true;
      }

      // Update meta if teacher is provided
      if (quickAddDto.teacher) {
        const currentMeta = existingByName.meta || {};
        if (currentMeta.teacher !== quickAddDto.teacher) {
          updateData.meta = { ...currentMeta, teacher: quickAddDto.teacher };
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        const updatedSubject = await this.subjectRepository.update(existingByName.id, updateData);
        return updatedSubject!;
      }

      return existingByName;
    }

    // If subject doesn't exist by name, check if code conflicts
    if (quickAddDto.subjectCode) {
      const existingByCode = await this.subjectRepository.findByUserIdAndCode(userId, quickAddDto.subjectCode);
      if (existingByCode) {
        throw new BadRequestException(`Subject with code '${quickAddDto.subjectCode}' already exists`);
      }
    }

    // Create new subject
    const subjectData: Partial<Subject> = {
      userId,
      code: quickAddDto.subjectCode,
      name: quickAddDto.subjectName.trim(),
      colorHex: this.normalizeColor(quickAddDto.subjectColor),
      meta: quickAddDto.teacher ? { teacher: quickAddDto.teacher } : {},
    };

    return await this.subjectRepository.create(subjectData);
  }

  private async createSection(subjectId: string, quickAddDto: QuickAddClassDto): Promise<Section> {
    // Check for duplicate section code within the subject
    const existingSection = await this.sectionRepository.findBySubjectIdAndSecCode(
      subjectId,
      quickAddDto.sectionCode.trim()
    );
    
    if (existingSection) {
      throw new BadRequestException(
        `Section with code '${quickAddDto.sectionCode}' already exists for this subject`
      );
    }

    // Create section with schedule rule
    const sectionData: Partial<Section> = {
      subjectId,
      secCode: quickAddDto.sectionCode.trim(),
      teacher: quickAddDto.teacher?.trim(),
      room: quickAddDto.room?.trim(),
      scheduleRules: [{
        dayOfWeek: quickAddDto.dayOfWeek,
        startTime: quickAddDto.startTime,
        endTime: quickAddDto.endTime,
        startDate: quickAddDto.startDate,
        endDate: quickAddDto.endDate,
        skipDates: quickAddDto.skipDates || [],
      }],
    };

    return await this.sectionRepository.create(sectionData);
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return new Date(2000, 0, 1, hours, minutes).getTime();
  }

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