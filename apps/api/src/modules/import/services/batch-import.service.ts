import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ImportJobRepositoryInterface } from '../../../infra/database/repositories/interfaces/import-job-repository.interface';
import { ImportItemRepositoryInterface } from '../../../infra/database/repositories/interfaces/import-item-repository.interface';
import { SubjectRepositoryInterface } from '../../../infra/database/repositories/interfaces/subject-repository.interface';
import { SectionRepositoryInterface } from '../../../infra/database/repositories/interfaces/section-repository.interface';
import { LocalEventRepositoryInterface } from '../../../infra/database/repositories/interfaces/local-event-repository.interface';
import { 
  IMPORT_JOB_REPOSITORY, 
  IMPORT_ITEM_REPOSITORY,
  SUBJECT_REPOSITORY,
  SECTION_REPOSITORY,
  LOCAL_EVENT_REPOSITORY
} from '../../../infra/database/repositories/repository.module';
import { EventGenerationService } from '../../events/event-generation.service';
import { ImportJob } from '../../../infra/database/entities/import-job.entity';
import { ImportItem } from '../../../infra/database/entities/import-item.entity';
import { Subject } from '../../../infra/database/entities/subject.entity';
import { Section } from '../../../infra/database/entities/section.entity';

export interface ImportResult {
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  details: ImportDetail[];
  errors: ImportError[];
}

export interface ImportDetail {
  row: number;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  subjectName?: string;
  sectionCode?: string;
  message?: string;
  eventsCreated?: number;
}

export interface ImportError {
  row: number;
  message: string;
  data?: any;
}

@Injectable()
export class BatchImportService {
  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepositoryInterface,
    @Inject(IMPORT_ITEM_REPOSITORY)
    private readonly importItemRepository: ImportItemRepositoryInterface,
    @Inject(SUBJECT_REPOSITORY)
    private readonly subjectRepository: SubjectRepositoryInterface,
    @Inject(SECTION_REPOSITORY)
    private readonly sectionRepository: SectionRepositoryInterface,
    @Inject(LOCAL_EVENT_REPOSITORY)
    private readonly localEventRepository: LocalEventRepositoryInterface,
    private readonly eventGenerationService: EventGenerationService,
  ) {}

  async processImport(jobId: string, userId: string): Promise<ImportResult> {
    const job = await this.importJobRepository.findById(jobId);
    
    if (!job || job.userId !== userId) {
      throw new BadRequestException('Import job not found');
    }

    if (job.state !== 'preview') {
      throw new BadRequestException('Import job must be in preview state');
    }

    if (!job.columnMap) {
      throw new BadRequestException('Column mapping is required');
    }

    const items = await this.importItemRepository.findByImportJobId(jobId);
    
    const result: ImportResult = {
      summary: {
        totalRows: items.length,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
      details: [],
      errors: [],
    };

    // Process items in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await this.processBatch(batch, job, result);
    }

    // Update job state
    await this.importJobRepository.update(jobId, { 
      state: result.summary.failed === 0 ? 'applied' : 'failed',
      errorMessage: result.errors.length > 0 ? `${result.errors.length} errors occurred` : null,
    });

    return result;
  }

  private async processBatch(
    items: ImportItem[],
    job: ImportJob,
    result: ImportResult,
  ): Promise<void> {
    for (const [index, item] of items.entries()) {
      try {
        const detail = await this.processItem(item, job, index + 1);
        result.details.push(detail);
        
        switch (detail.action) {
          case 'created':
            result.summary.created++;
            break;
          case 'updated':
            result.summary.updated++;
            break;
          case 'skipped':
            result.summary.skipped++;
            break;
          case 'failed':
            result.summary.failed++;
            break;
        }

        // Update item status
        await this.importItemRepository.updateStatus(item.id, 
          detail.action === 'failed' ? 'failed' : 'created'
        );
      } catch (error) {
        result.summary.failed++;
        result.errors.push({
          row: index + 1,
          message: error.message,
          data: item.rawRow,
        });
        
        await this.importItemRepository.updateStatus(item.id, 'failed');
      }
    }
  }

  private async processItem(
    item: ImportItem,
    job: ImportJob,
    rowNumber: number,
  ): Promise<ImportDetail> {
    const mappedData = this.mapRowData(item.rawRow, job.columnMap);
    
    // Validate required fields
    const requiredFields = ['subjectName', 'sectionCode', 'startTime', 'endTime', 'daysOfWeek'];
    for (const field of requiredFields) {
      if (!mappedData[field]) {
        return {
          row: rowNumber,
          action: 'failed',
          message: `Missing required field: ${field}`,
        };
      }
    }

    try {
      // Find or create subject
      const subject = await this.findOrCreateSubject(mappedData, job.userId);
      
      // Find or create section
      const section = await this.findOrCreateSection(mappedData, subject.id);
      
      // Generate events for this section
      const eventsCreated = await this.generateEventsForSection(section, mappedData);
      
      return {
        row: rowNumber,
        action: 'created',
        subjectName: subject.name,
        sectionCode: section.secCode,
        eventsCreated,
      };
    } catch (error) {
      return {
        row: rowNumber,
        action: 'failed',
        message: error.message,
        subjectName: mappedData.subjectName,
        sectionCode: mappedData.sectionCode,
      };
    }
  }

  private mapRowData(rawRow: Record<string, any>, columnMap: Record<string, string>): Record<string, any> {
    const mappedData: Record<string, any> = {};
    
    for (const [csvColumn, dbField] of Object.entries(columnMap)) {
      if (dbField && rawRow[csvColumn] !== undefined) {
        mappedData[dbField] = rawRow[csvColumn];
      }
    }
    
    return mappedData;
  }

  private async findOrCreateSubject(data: Record<string, any>, userId: string): Promise<Subject> {
    const subjectName = String(data.subjectName).trim();
    const subjectCode = data.subjectCode ? String(data.subjectCode).trim() : null;
    
    // Try to find existing subject by name and code
    let subject = await this.subjectRepository.findByUserIdAndName(userId, subjectName);
    
    if (subject) {
      // Update subject code if provided and different
      if (subjectCode && subject.code !== subjectCode) {
        subject = await this.subjectRepository.update(subject.id, { code: subjectCode });
      }
      return subject;
    }
    
    // Create new subject
    const subjectData = {
      userId,
      name: subjectName,
      code: subjectCode,
      colorHex: this.generateRandomColor(),
      meta: {
        teacher: data.teacher || null,
        importedAt: new Date().toISOString(),
      },
    };
    
    return this.subjectRepository.create(subjectData);
  }

  private async findOrCreateSection(data: Record<string, any>, subjectId: string): Promise<Section> {
    const sectionCode = String(data.sectionCode).trim();
    
    // Try to find existing section
    let section = await this.sectionRepository.findBySubjectIdAndSecCode(subjectId, sectionCode);
    
    if (section) {
      // Update section if data has changed
      const updatedScheduleRules = this.buildScheduleRules(data);
      const updatedData = {
        teacher: data.teacher || section.teacher,
        room: data.room || section.room,
        scheduleRules: updatedScheduleRules,
      };
      
      // Check if update is needed
      if (JSON.stringify(section.scheduleRules) !== JSON.stringify(updatedScheduleRules) ||
          section.teacher !== updatedData.teacher ||
          section.room !== updatedData.room) {
        section = await this.sectionRepository.update(section.id, updatedData);
      }
      
      return section;
    }
    
    // Create new section
    const sectionData = {
      subjectId,
      secCode: sectionCode,
      teacher: data.teacher || null,
      room: data.room || null,
      scheduleRules: this.buildScheduleRules(data),
    };
    
    return this.sectionRepository.create(sectionData);
  }

  private buildScheduleRules(data: Record<string, any>): any {
    const startTime = this.normalizeTime(data.startTime);
    const endTime = this.normalizeTime(data.endTime);
    const daysOfWeek = this.normalizeDaysOfWeek(data.daysOfWeek);
    
    const rules = {
      type: 'weekly',
      startTime,
      endTime,
      daysOfWeek,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      skipDates: [],
    };
    
    return rules;
  }

  private normalizeTime(timeValue: any): string {
    if (!timeValue) return '00:00';
    
    const timeStr = String(timeValue).trim();
    
    // Handle various time formats
    if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
      return timeStr.padStart(5, '0');
    }
    
    if (timeStr.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
      return timeStr.substring(0, 5);
    }
    
    // Handle 12-hour format
    const match12Hour = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12Hour) {
      let hours = parseInt(match12Hour[1]);
      const minutes = match12Hour[2];
      const period = match12Hour[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    
    throw new Error(`Invalid time format: ${timeValue}`);
  }

  private normalizeDaysOfWeek(daysValue: any): string[] {
    if (!daysValue) return [];
    
    const daysStr = String(daysValue).trim().toUpperCase();
    const dayMap: Record<string, string> = {
      '1': 'MO', '2': 'TU', '3': 'WE', '4': 'TH', '5': 'FR', '6': 'SA', '7': 'SU',
      'MON': 'MO', 'TUE': 'TU', 'WED': 'WE', 'THU': 'TH', 'FRI': 'FR', 'SAT': 'SA', 'SUN': 'SU',
      'MONDAY': 'MO', 'TUESDAY': 'TU', 'WEDNESDAY': 'WE', 'THURSDAY': 'TH', 
      'FRIDAY': 'FR', 'SATURDAY': 'SA', 'SUNDAY': 'SU',
    };
    
    const parts = daysStr.split(/[,\s]+/).filter(part => part.length > 0);
    const normalizedDays: string[] = [];
    
    for (const part of parts) {
      if (dayMap[part]) {
        normalizedDays.push(dayMap[part]);
      } else if (['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].includes(part)) {
        normalizedDays.push(part);
      } else {
        throw new Error(`Invalid day format: ${part}`);
      }
    }
    
    return [...new Set(normalizedDays)]; // Remove duplicates
  }

  private async generateEventsForSection(section: Section, data: Record<string, any>): Promise<number> {
    const scheduleRules = section.scheduleRules;
    
    // Determine date range
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const endDate = data.endDate ? new Date(data.endDate) : new Date(Date.now() + 120 * 24 * 60 * 60 * 1000); // 4 months from now
    
    // Generate events using the event generation service
    const events = await this.eventGenerationService.generateEventsForSection(
      section.id,
      startDate,
      endDate,
      scheduleRules.skipDates || []
    );
    
    return events.length;
  }

  private generateRandomColor(): string {
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  async getImportResult(jobId: string, userId: string): Promise<ImportResult | null> {
    const job = await this.importJobRepository.findById(jobId);
    
    if (!job || job.userId !== userId) {
      return null;
    }

    if (job.state !== 'applied' && job.state !== 'failed') {
      return null;
    }

    const items = await this.importItemRepository.findByImportJobId(jobId);
    
    const result: ImportResult = {
      summary: {
        totalRows: items.length,
        created: items.filter(item => item.status === 'created').length,
        updated: 0, // Not implemented yet
        skipped: items.filter(item => item.status === 'skipped').length,
        failed: items.filter(item => item.status === 'failed').length,
      },
      details: [],
      errors: [],
    };

    // Build details from items
    items.forEach((item, index) => {
      const mappedData = this.mapRowData(item.rawRow, job.columnMap);
      
      result.details.push({
        row: index + 1,
        action: item.status === 'created' ? 'created' : 
                item.status === 'failed' ? 'failed' : 'skipped',
        subjectName: mappedData.subjectName,
        sectionCode: mappedData.sectionCode,
        message: item.status === 'failed' ? 'Processing failed' : undefined,
      });
    });

    return result;
  }
}