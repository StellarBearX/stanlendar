import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { ImportService } from './services/import.service';
import { BatchImportService, ImportResult } from './services/batch-import.service';
import { ColumnMapping, ImportPreview, ValidationResult } from './dto/upload-file.dto';

@Controller('import')
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly batchImportService: BatchImportService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, callback) => {
      const allowedMimes = [
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        callback(null, true);
      } else {
        callback(new BadRequestException('Only CSV and XLSX files are allowed'), false);
      }
    },
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ): Promise<ImportPreview> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.importService.createImportJob(req.user.id, file);
  }

  @Get('jobs')
  async getUserImportJobs(@Request() req: any) {
    return this.importService.getUserImportJobs(req.user.id);
  }

  @Get('jobs/:jobId')
  async getImportJob(@Param('jobId') jobId: string, @Request() req: any) {
    return this.importService.getImportJob(jobId, req.user.id);
  }

  @Get('jobs/:jobId/preview')
  async getImportPreview(@Param('jobId') jobId: string, @Request() req: any): Promise<ImportPreview> {
    return this.importService.getImportPreview(jobId, req.user.id);
  }

  @Put('jobs/:jobId/mapping')
  async updateColumnMapping(
    @Param('jobId') jobId: string,
    @Body() body: { columnMapping: ColumnMapping },
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    await this.importService.updateColumnMapping(jobId, req.user.id, body.columnMapping);
    return { success: true };
  }

  @Post('jobs/:jobId/validate')
  async validateImportData(
    @Param('jobId') jobId: string,
    @Request() req: any,
  ): Promise<ValidationResult> {
    return this.importService.validateImportData(jobId, req.user.id);
  }

  @Post('jobs/:jobId/apply')
  async applyImport(
    @Param('jobId') jobId: string,
    @Request() req: any,
  ): Promise<ImportResult> {
    return this.batchImportService.processImport(jobId, req.user.id);
  }

  @Get('jobs/:jobId/result')
  async getImportResult(
    @Param('jobId') jobId: string,
    @Request() req: any,
  ): Promise<ImportResult | null> {
    return this.batchImportService.getImportResult(jobId, req.user.id);
  }

  @Delete('jobs/:jobId')
  async deleteImportJob(
    @Param('jobId') jobId: string,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    await this.importService.deleteImportJob(jobId, req.user.id);
    return { success: true };
  }
}