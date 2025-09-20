import { Injectable, ConflictException, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { SectionRepository } from '../../infra/database/repositories/interfaces/section-repository.interface';
import { SubjectRepository } from '../../infra/database/repositories/interfaces/subject-repository.interface';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionResponseDto } from './dto/section-response.dto';
import { ScheduleRuleDto } from './dto/schedule-rule.dto';
import { Section } from '../../infra/database/entities/section.entity';

@Injectable()
export class SectionsService {
  constructor(
    @Inject('SectionRepository')
    private readonly sectionRepository: SectionRepository,
    @Inject('SubjectRepository')
    private readonly subjectRepository: SubjectRepository,
  ) {}

  async create(userId: string, createSectionDto: CreateSectionDto): Promise<SectionResponseDto> {
    // Verify subject exists and belongs to user
    const subject = await this.subjectRepository.findById(createSectionDto.subjectId);
    if (!subject || subject.userId !== userId) {
      throw new NotFoundException(`Subject with ID '${createSectionDto.subjectId}' not found`);
    }

    // Check for duplicate section code within the subject
    const existingSection = await this.sectionRepository.findBySubjectIdAndSecCode(
      createSectionDto.subjectId,
      createSectionDto.secCode
    );
    if (existingSection) {
      throw new ConflictException(
        `Section with code '${createSectionDto.secCode}' already exists for this subject`
      );
    }

    // Validate schedule rules
    this.validateScheduleRules(createSectionDto.scheduleRules);

    // Create section
    const sectionData: Partial<Section> = {
      subjectId: createSectionDto.subjectId,
      secCode: createSectionDto.secCode.trim(),
      teacher: createSectionDto.teacher?.trim(),
      room: createSectionDto.room?.trim(),
      scheduleRules: this.normalizeScheduleRules(createSectionDto.scheduleRules),
    };

    const section = await this.sectionRepository.create(sectionData);
    return SectionResponseDto.fromEntity(section);
  }

  async findBySubject(userId: string, subjectId: string): Promise<SectionResponseDto[]> {
    // Verify subject exists and belongs to user
    const subject = await this.subjectRepository.findById(subjectId);
    if (!subject || subject.userId !== userId) {
      throw new NotFoundException(`Subject with ID '${subjectId}' not found`);
    }

    const sections = await this.sectionRepository.findBySubjectId(subjectId);
    return SectionResponseDto.fromEntities(sections);
  }

  async findOne(userId: string, id: string): Promise<SectionResponseDto> {
    const section = await this.sectionRepository.findById(id);
    
    if (!section) {
      throw new NotFoundException(`Section with ID '${id}' not found`);
    }

    // Verify section belongs to user through subject
    if (section.subject.userId !== userId) {
      throw new NotFoundException(`Section with ID '${id}' not found`);
    }

    return SectionResponseDto.fromEntity(section);
  }

  async update(userId: string, id: string, updateSectionDto: UpdateSectionDto): Promise<SectionResponseDto> {
    const existingSection = await this.sectionRepository.findById(id);
    
    if (!existingSection) {
      throw new NotFoundException(`Section with ID '${id}' not found`);
    }

    // Verify section belongs to user through subject
    if (existingSection.subject.userId !== userId) {
      throw new NotFoundException(`Section with ID '${id}' not found`);
    }

    // Check for conflicts if updating section code
    if (updateSectionDto.secCode && updateSectionDto.secCode !== existingSection.secCode) {
      const existingByCode = await this.sectionRepository.findBySubjectIdAndSecCode(
        existingSection.subjectId,
        updateSectionDto.secCode
      );
      if (existingByCode && existingByCode.id !== id) {
        throw new ConflictException(
          `Section with code '${updateSectionDto.secCode}' already exists for this subject`
        );
      }
    }

    // Prepare update data
    const updateData: Partial<Section> = {};
    
    if (updateSectionDto.secCode !== undefined) {
      updateData.secCode = updateSectionDto.secCode.trim();
    }
    
    if (updateSectionDto.teacher !== undefined) {
      updateData.teacher = updateSectionDto.teacher?.trim();
    }
    
    if (updateSectionDto.room !== undefined) {
      updateData.room = updateSectionDto.room?.trim();
    }
    
    if (updateSectionDto.scheduleRules !== undefined) {
      this.validateScheduleRules(updateSectionDto.scheduleRules);
      updateData.scheduleRules = this.normalizeScheduleRules(updateSectionDto.scheduleRules);
    }

    const updatedSection = await this.sectionRepository.update(id, updateData);
    
    if (!updatedSection) {
      throw new NotFoundException(`Section with ID '${id}' not found`);
    }

    return SectionResponseDto.fromEntity(updatedSection);
  }

  async remove(userId: string, id: string): Promise<void> {
    const section = await this.sectionRepository.findById(id);
    
    if (!section) {
      throw new NotFoundException(`Section with ID '${id}' not found`);
    }

    // Verify section belongs to user through subject
    if (section.subject.userId !== userId) {
      throw new NotFoundException(`Section with ID '${id}' not found`);
    }

    // Check if section has events
    if (section.events && section.events.length > 0) {
      throw new BadRequestException('Cannot delete section with existing events. Delete events first.');
    }

    const deleted = await this.sectionRepository.delete(id);
    
    if (!deleted) {
      throw new NotFoundException(`Section with ID '${id}' not found`);
    }
  }

  /**
   * Validate schedule rules for logical consistency
   */
  private validateScheduleRules(scheduleRules: ScheduleRuleDto[]): void {
    if (!scheduleRules || scheduleRules.length === 0) {
      throw new BadRequestException('At least one schedule rule is required');
    }

    for (const rule of scheduleRules) {
      // Validate time format and logic
      this.validateTimeRule(rule);
      
      // Validate date range
      this.validateDateRange(rule);
      
      // Validate skip dates
      this.validateSkipDates(rule);
    }

    // Check for overlapping rules
    this.validateNoOverlappingRules(scheduleRules);
  }

  private validateTimeRule(rule: ScheduleRuleDto): void {
    const startTime = this.parseTime(rule.startTime);
    const endTime = this.parseTime(rule.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException(
        `Start time (${rule.startTime}) must be before end time (${rule.endTime})`
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
  }

  private validateDateRange(rule: ScheduleRuleDto): void {
    const startDate = new Date(rule.startDate);
    const endDate = new Date(rule.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException(
        `Start date (${rule.startDate}) must be before end date (${rule.endDate})`
      );
    }

    // Check for reasonable duration (max 1 year)
    const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays > 365) {
      throw new BadRequestException('Schedule duration cannot exceed 1 year');
    }
  }

  private validateSkipDates(rule: ScheduleRuleDto): void {
    if (!rule.skipDates) return;

    const startDate = new Date(rule.startDate);
    const endDate = new Date(rule.endDate);

    for (const skipDate of rule.skipDates) {
      const skip = new Date(skipDate);
      if (skip < startDate || skip > endDate) {
        throw new BadRequestException(
          `Skip date ${skipDate} must be within the schedule date range (${rule.startDate} to ${rule.endDate})`
        );
      }
    }
  }

  private validateNoOverlappingRules(scheduleRules: ScheduleRuleDto[]): void {
    for (let i = 0; i < scheduleRules.length; i++) {
      for (let j = i + 1; j < scheduleRules.length; j++) {
        const rule1 = scheduleRules[i];
        const rule2 = scheduleRules[j];

        if (this.rulesOverlap(rule1, rule2)) {
          throw new BadRequestException(
            `Schedule rules overlap: Rule ${i + 1} and Rule ${j + 1} have conflicting times`
          );
        }
      }
    }
  }

  private rulesOverlap(rule1: ScheduleRuleDto, rule2: ScheduleRuleDto): boolean {
    // Different days don't overlap
    if (rule1.dayOfWeek !== rule2.dayOfWeek) {
      return false;
    }

    // Check date range overlap
    const start1 = new Date(rule1.startDate);
    const end1 = new Date(rule1.endDate);
    const start2 = new Date(rule2.startDate);
    const end2 = new Date(rule2.endDate);

    const dateOverlap = start1 <= end2 && start2 <= end1;
    if (!dateOverlap) {
      return false;
    }

    // Check time overlap
    const time1Start = this.parseTime(rule1.startTime);
    const time1End = this.parseTime(rule1.endTime);
    const time2Start = this.parseTime(rule2.startTime);
    const time2End = this.parseTime(rule2.endTime);

    return time1Start < time2End && time2Start < time1End;
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return new Date(2000, 0, 1, hours, minutes).getTime();
  }

  private normalizeScheduleRules(scheduleRules: ScheduleRuleDto[]) {
    return scheduleRules.map(rule => ({
      ...rule,
      skipDates: rule.skipDates || [],
    }));
  }
}