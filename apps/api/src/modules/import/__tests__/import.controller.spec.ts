import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ImportController } from '../import.controller';
import { ImportService } from '../services/import.service';
import { BatchImportService } from '../services/batch-import.service';
import { ImportPreview, ValidationResult } from '../dto/upload-file.dto';

describe('ImportController', () => {
  let controller: ImportController;
  let importService: jest.Mocked<ImportService>;
  let batchImportService: jest.Mocked<BatchImportService>;

  const mockUser = { id: 'user-1', email: 'test@example.com' };
  const mockRequest = { user: mockUser };

  const mockImportPreview: ImportPreview = {
    jobId: 'job-1',
    headers: ['Subject', 'Section'],
    rows: [{ Subject: 'Math 101', Section: '001' }],
    totalRows: 1,
    errors: [],
  };

  beforeEach(async () => {
    const mockImportService = {
      createImportJob: jest.fn(),
      getUserImportJobs: jest.fn(),
      getImportJob: jest.fn(),
      getImportPreview: jest.fn(),
      updateColumnMapping: jest.fn(),
      validateImportData: jest.fn(),
      deleteImportJob: jest.fn(),
    };

    const mockBatchImportService = {
      processImport: jest.fn(),
      getImportResult: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [
        {
          provide: ImportService,
          useValue: mockImportService,
        },
        {
          provide: BatchImportService,
          useValue: mockBatchImportService,
        },
      ],
    }).compile();

    controller = module.get<ImportController>(ImportController);
    importService = module.get(ImportService);
    batchImportService = module.get(BatchImportService);
  });

  describe('uploadFile', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      size: 1024,
      buffer: Buffer.from('test data'),
      destination: '',
      filename: '',
      path: '',
      stream: null,
    };

    it('should upload file successfully', async () => {
      importService.createImportJob.mockResolvedValue(mockImportPreview);

      const result = await controller.uploadFile(mockFile, mockRequest);

      expect(result).toEqual(mockImportPreview);
      expect(importService.createImportJob).toHaveBeenCalledWith('user-1', mockFile);
    });

    it('should throw error when no file is uploaded', async () => {
      await expect(controller.uploadFile(null, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserImportJobs', () => {
    it('should return user import jobs', async () => {
      const mockJobs = [{ id: 'job-1', state: 'preview' }];
      importService.getUserImportJobs.mockResolvedValue(mockJobs as any);

      const result = await controller.getUserImportJobs(mockRequest);

      expect(result).toEqual(mockJobs);
      expect(importService.getUserImportJobs).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getImportJob', () => {
    it('should return specific import job', async () => {
      const mockJob = { id: 'job-1', state: 'preview' };
      importService.getImportJob.mockResolvedValue(mockJob as any);

      const result = await controller.getImportJob('job-1', mockRequest);

      expect(result).toEqual(mockJob);
      expect(importService.getImportJob).toHaveBeenCalledWith('job-1', 'user-1');
    });
  });

  describe('getImportPreview', () => {
    it('should return import preview', async () => {
      importService.getImportPreview.mockResolvedValue(mockImportPreview);

      const result = await controller.getImportPreview('job-1', mockRequest);

      expect(result).toEqual(mockImportPreview);
      expect(importService.getImportPreview).toHaveBeenCalledWith('job-1', 'user-1');
    });
  });

  describe('updateColumnMapping', () => {
    it('should update column mapping successfully', async () => {
      const columnMapping = { Subject: 'subjectName', Section: 'sectionCode' };
      importService.updateColumnMapping.mockResolvedValue(undefined);

      const result = await controller.updateColumnMapping('job-1', { columnMapping }, mockRequest);

      expect(result).toEqual({ success: true });
      expect(importService.updateColumnMapping).toHaveBeenCalledWith('job-1', 'user-1', columnMapping);
    });
  });

  describe('validateImportData', () => {
    it('should validate import data', async () => {
      const mockValidation: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
      };
      importService.validateImportData.mockResolvedValue(mockValidation);

      const result = await controller.validateImportData('job-1', mockRequest);

      expect(result).toEqual(mockValidation);
      expect(importService.validateImportData).toHaveBeenCalledWith('job-1', 'user-1');
    });
  });

  describe('deleteImportJob', () => {
    it('should delete import job successfully', async () => {
      importService.deleteImportJob.mockResolvedValue(undefined);

      const result = await controller.deleteImportJob('job-1', mockRequest);

      expect(result).toEqual({ success: true });
      expect(importService.deleteImportJob).toHaveBeenCalledWith('job-1', 'user-1');
    });
  });
});