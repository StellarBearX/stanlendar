import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { ImportJobRepositoryInterface } from '../../../infra/database/repositories/interfaces/import-job-repository.interface';
import { ImportItemRepositoryInterface } from '../../../infra/database/repositories/interfaces/import-item-repository.interface';
import { IMPORT_JOB_REPOSITORY, IMPORT_ITEM_REPOSITORY } from '../../../infra/database/repositories/repository.module';
import { FileParserService } from './file-parser.service';
import { ImportPreview, ParsedRow, ImportError, ColumnMapping, ValidationResult } from '../dto/upload-file.dto';
import { ImportJob } from '../../../infra/database/entities/import-job.entity';
import { ImportItem } from '../../../infra/database/entities/import-item.entity';

@Injectable()
export class ImportService {
  constructor(
    @Inject(IMPORT_JOB_REPOSITORY)
    private readonly importJobRepository: ImportJobRepositoryInterface,
    @Inject(IMPORT_ITEM_REPOSITORY)
    private readonly importItemRepository: ImportItemRepositoryInterface,
    private readonly fileParserService: FileParserService,
  ) {}

  async createImportJob(
    userId: string,
    file: Express.Multer.File,
  ): Promise<ImportPreview> {
    // Validate file
    this.fileParserService.validateFileSize(file.size);
    const fileType = this.fileParserService.validateFileType(file.originalname, file.mimetype);

    // Parse file
    let parseResult: { headers: string[]; rows: ParsedRow[]; errors: ImportError[] };
    
    if (fileType === 'csv') {
      parseResult = await this.fileParserService.parseCSV(file.buffer);
    } else {
      parseResult = await this.fileParserService.parseXLSX(file.buffer);
    }

    // Create import job
    const importJob = await this.importJobRepository.create({
      userId,
      sourceType: fileType,
      state: 'pending',
    });

    // Create import items for each row
    const importItems = parseResult.rows.map((row, index) => ({
      importJobId: importJob.id,
      rawRow: row,
      status: 'preview' as const,
    }));

    if (importItems.length > 0) {
      await this.importItemRepository.bulkCreate(importItems);
    }

    // Update job state to preview
    await this.importJobRepository.update(importJob.id, { state: 'preview' });

    return {
      jobId: importJob.id,
      headers: parseResult.headers,
      rows: parseResult.rows.slice(0, 10), // Return first 10 rows for preview
      totalRows: parseResult.rows.length,
      errors: parseResult.errors,
    };
  }

  async getImportJob(jobId: string, userId: string): Promise<ImportJob> {
    const job = await this.importJobRepository.findById(jobId);
    
    if (!job || job.userId !== userId) {
      throw new NotFoundException('Import job not found');
    }

    return job;
  }

  async getImportPreview(jobId: string, userId: string): Promise<ImportPreview> {
    const job = await this.getImportJob(jobId, userId);
    const items = await this.importItemRepository.findByImportJobId(jobId);

    // Extract headers from first item's raw data
    const headers = items.length > 0 ? Object.keys(items[0].rawRow) : [];
    
    return {
      jobId: job.id,
      headers,
      rows: items.slice(0, 10).map(item => item.rawRow), // First 10 rows for preview
      totalRows: items.length,
      errors: [], // Parse errors would have been caught during creation
    };
  }

  async updateColumnMapping(
    jobId: string,
    userId: string,
    columnMapping: ColumnMapping,
  ): Promise<void> {
    const job = await this.getImportJob(jobId, userId);
    
    if (job.state !== 'preview') {
      throw new BadRequestException('Can only update column mapping for jobs in preview state');
    }

    await this.importJobRepository.update(jobId, { columnMap: columnMapping });
  }

  async validateImportData(jobId: string, userId: string): Promise<ValidationResult> {
    const job = await this.getImportJob(jobId, userId);
    
    if (!job.columnMap) {
      throw new BadRequestException('Column mapping is required before validation');
    }

    const items = await this.importItemRepository.findByImportJobId(jobId);
    const errors: ImportError[] = [];
    const warnings: ImportError[] = [];

    // Required fields mapping
    const requiredFields = ['subjectName', 'sectionCode', 'startTime', 'endTime', 'daysOfWeek'];
    const optionalFields = ['room', 'teacher', 'startDate', 'endDate', 'note'];

    // Check if required fields are mapped
    for (const field of requiredFields) {
      const mappedColumn = Object.entries(job.columnMap).find(([_, dbField]) => dbField === field);
      if (!mappedColumn) {
        errors.push({
          row: 0,
          message: `Required field '${field}' is not mapped to any column`,
        });
      }
    }

    // Validate each row
    items.forEach((item, index) => {
      const rowNumber = index + 1;
      const rawRow = item.rawRow;

      // Check required fields have values
      for (const [csvColumn, dbField] of Object.entries(job.columnMap)) {
        if (requiredFields.includes(dbField)) {
          const value = rawRow[csvColumn];
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            errors.push({
              row: rowNumber,
              column: csvColumn,
              message: `Required field '${dbField}' is empty`,
              value,
            });
          }
        }
      }

      // Validate time format
      const startTimeColumn = Object.entries(job.columnMap).find(([_, field]) => field === 'startTime')?.[0];
      const endTimeColumn = Object.entries(job.columnMap).find(([_, field]) => field === 'endTime')?.[0];
      
      if (startTimeColumn && rawRow[startTimeColumn]) {
        const timeValue = String(rawRow[startTimeColumn]);
        if (!this.isValidTimeFormat(timeValue)) {
          errors.push({
            row: rowNumber,
            column: startTimeColumn,
            message: 'Invalid time format. Expected HH:mm (24-hour format)',
            value: timeValue,
          });
        }
      }

      if (endTimeColumn && rawRow[endTimeColumn]) {
        const timeValue = String(rawRow[endTimeColumn]);
        if (!this.isValidTimeFormat(timeValue)) {
          errors.push({
            row: rowNumber,
            column: endTimeColumn,
            message: 'Invalid time format. Expected HH:mm (24-hour format)',
            value: timeValue,
          });
        }
      }

      // Validate days of week
      const daysColumn = Object.entries(job.columnMap).find(([_, field]) => field === 'daysOfWeek')?.[0];
      if (daysColumn && rawRow[daysColumn]) {
        const daysValue = String(rawRow[daysColumn]);
        if (!this.isValidDaysOfWeek(daysValue)) {
          errors.push({
            row: rowNumber,
            column: daysColumn,
            message: 'Invalid days format. Expected comma-separated days (e.g., "MO,WE,FR" or "1,3,5")',
            value: daysValue,
          });
        }
      }

      // Validate date format if provided
      const startDateColumn = Object.entries(job.columnMap).find(([_, field]) => field === 'startDate')?.[0];
      const endDateColumn = Object.entries(job.columnMap).find(([_, field]) => field === 'endDate')?.[0];
      
      if (startDateColumn && rawRow[startDateColumn]) {
        const dateValue = String(rawRow[startDateColumn]);
        if (!this.isValidDateFormat(dateValue)) {
          warnings.push({
            row: rowNumber,
            column: startDateColumn,
            message: 'Invalid date format. Expected YYYY-MM-DD',
            value: dateValue,
          });
        }
      }

      if (endDateColumn && rawRow[endDateColumn]) {
        const dateValue = String(rawRow[endDateColumn]);
        if (!this.isValidDateFormat(dateValue)) {
          warnings.push({
            row: rowNumber,
            column: endDateColumn,
            message: 'Invalid date format. Expected YYYY-MM-DD',
            value: dateValue,
          });
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time.trim());
  }

  private isValidDaysOfWeek(days: string): boolean {
    const dayNames = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    const dayNumbers = ['1', '2', '3', '4', '5', '6', '7'];
    
    const parts = days.split(',').map(d => d.trim().toUpperCase());
    
    // Check if all parts are valid day names or numbers
    return parts.every(part => 
      dayNames.includes(part) || dayNumbers.includes(part)
    );
  }

  private isValidDateFormat(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date.trim())) {
      return false;
    }
    
    // Check if it's a valid date
    const parsedDate = new Date(date.trim());
    return !isNaN(parsedDate.getTime());
  }

  async getUserImportJobs(userId: string): Promise<ImportJob[]> {
    return this.importJobRepository.findByUserId(userId);
  }

  async deleteImportJob(jobId: string, userId: string): Promise<void> {
    const job = await this.getImportJob(jobId, userId);
    
    if (job.state === 'applied') {
      throw new BadRequestException('Cannot delete applied import jobs');
    }

    await this.importJobRepository.delete(jobId);
  }
}