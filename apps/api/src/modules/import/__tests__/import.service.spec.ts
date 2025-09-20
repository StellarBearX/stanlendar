import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImportService } from '../services/import.service';
import { FileParserService } from '../services/file-parser.service';
import { ImportJobRepositoryInterface } from '../../../infra/database/repositories/interfaces/import-job-repository.interface';
import { ImportItemRepositoryInterface } from '../../../infra/database/repositories/interfaces/import-item-repository.interface';
import { IMPORT_JOB_REPOSITORY, IMPORT_ITEM_REPOSITORY } from '../../../infra/database/repositories/repository.module';
import { ImportJob } from '../../../infra/database/entities/import-job.entity';
import { ImportItem } from '../../../infra/database/entities/import-item.entity';

describe('ImportService', () => {
  let service: ImportService;
  let importJobRepository: jest.Mocked<ImportJobRepositoryInterface>;
  let importItemRepository: jest.Mocked<ImportItemRepositoryInterface>;
  let fileParserService: jest.Mocked<FileParserService>;

  const mockImportJob: ImportJob = {
    id: 'job-1',
    userId: 'user-1',
    sourceType: 'csv',
    state: 'preview',
    columnMap: null,
    errorMessage: null,
    createdAt: new Date(),
    user: null,
    items: [],
  };

  const mockImportItem: ImportItem = {
    id: 'item-1',
    importJobId: 'job-1',
    rawRow: { Subject: 'Math 101', Section: '001' },
    subjectId: null,
    sectionId: null,
    startDate: null,
    endDate: null,
    daysOfWeek: null,
    startTime: null,
    endTime: null,
    room: null,
    note: null,
    status: 'preview',
    importJob: null,
  };

  beforeEach(async () => {
    const mockImportJobRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByUserIdAndState: jest.fn(),
      findWithItems: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    const mockImportItemRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByImportJobId: jest.fn(),
      findByImportJobIdAndStatus: jest.fn(),
      bulkCreate: jest.fn(),
      updateStatus: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    const mockFileParserService = {
      parseCSV: jest.fn(),
      parseXLSX: jest.fn(),
      validateFileType: jest.fn(),
      validateFileSize: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        {
          provide: IMPORT_JOB_REPOSITORY,
          useValue: mockImportJobRepo,
        },
        {
          provide: IMPORT_ITEM_REPOSITORY,
          useValue: mockImportItemRepo,
        },
        {
          provide: FileParserService,
          useValue: mockFileParserService,
        },
      ],
    }).compile();

    service = module.get<ImportService>(ImportService);
    importJobRepository = module.get(IMPORT_JOB_REPOSITORY);
    importItemRepository = module.get(IMPORT_ITEM_REPOSITORY);
    fileParserService = module.get(FileParserService);
  });

  describe('createImportJob', () => {
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

    it('should create import job successfully', async () => {
      const parseResult = {
        headers: ['Subject', 'Section'],
        rows: [{ Subject: 'Math 101', Section: '001' }],
        errors: [],
      };

      fileParserService.validateFileSize.mockReturnValue(undefined);
      fileParserService.validateFileType.mockReturnValue('csv');
      fileParserService.parseCSV.mockResolvedValue(parseResult);
      importJobRepository.create.mockResolvedValue(mockImportJob);
      importItemRepository.bulkCreate.mockResolvedValue([mockImportItem]);
      importJobRepository.update.mockResolvedValue(mockImportJob);

      const result = await service.createImportJob('user-1', mockFile);

      expect(result.jobId).toBe('job-1');
      expect(result.headers).toEqual(['Subject', 'Section']);
      expect(result.totalRows).toBe(1);
      expect(fileParserService.validateFileSize).toHaveBeenCalledWith(1024);
      expect(fileParserService.validateFileType).toHaveBeenCalledWith('test.csv', 'text/csv');
      expect(importJobRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        sourceType: 'csv',
        state: 'pending',
      });
    });

    it('should handle XLSX files', async () => {
      const xlsxFile = { ...mockFile, originalname: 'test.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
      const parseResult = {
        headers: ['Subject', 'Section'],
        rows: [{ Subject: 'Math 101', Section: '001' }],
        errors: [],
      };

      fileParserService.validateFileSize.mockReturnValue(undefined);
      fileParserService.validateFileType.mockReturnValue('xlsx');
      fileParserService.parseXLSX.mockResolvedValue(parseResult);
      importJobRepository.create.mockResolvedValue(mockImportJob);
      importItemRepository.bulkCreate.mockResolvedValue([mockImportItem]);
      importJobRepository.update.mockResolvedValue(mockImportJob);

      const result = await service.createImportJob('user-1', xlsxFile);

      expect(fileParserService.parseXLSX).toHaveBeenCalledWith(xlsxFile.buffer);
      expect(result.jobId).toBe('job-1');
    });
  });

  describe('getImportJob', () => {
    it('should return import job for valid user', async () => {
      importJobRepository.findById.mockResolvedValue(mockImportJob);

      const result = await service.getImportJob('job-1', 'user-1');

      expect(result).toEqual(mockImportJob);
      expect(importJobRepository.findById).toHaveBeenCalledWith('job-1');
    });

    it('should throw NotFoundException for non-existent job', async () => {
      importJobRepository.findById.mockResolvedValue(null);

      await expect(service.getImportJob('job-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for wrong user', async () => {
      importJobRepository.findById.mockResolvedValue(mockImportJob);

      await expect(service.getImportJob('job-1', 'user-2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateColumnMapping', () => {
    it('should update column mapping successfully', async () => {
      const columnMapping = { Subject: 'subjectName', Section: 'sectionCode' };
      importJobRepository.findById.mockResolvedValue(mockImportJob);
      importJobRepository.update.mockResolvedValue(mockImportJob);

      await service.updateColumnMapping('job-1', 'user-1', columnMapping);

      expect(importJobRepository.update).toHaveBeenCalledWith('job-1', { columnMap: columnMapping });
    });

    it('should throw error for non-preview state', async () => {
      const appliedJob = { ...mockImportJob, state: 'applied' as const };
      importJobRepository.findById.mockResolvedValue(appliedJob);

      await expect(service.updateColumnMapping('job-1', 'user-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateImportData', () => {
    it('should validate data successfully', async () => {
      const jobWithMapping = {
        ...mockImportJob,
        columnMap: { Subject: 'subjectName', Section: 'sectionCode', Time: 'startTime', Days: 'daysOfWeek', EndTime: 'endTime' },
      };
      const itemWithValidData = {
        ...mockImportItem,
        rawRow: { Subject: 'Math 101', Section: '001', Time: '09:00', EndTime: '10:30', Days: 'MO,WE,FR' },
      };

      importJobRepository.findById.mockResolvedValue(jobWithMapping);
      importItemRepository.findByImportJobId.mockResolvedValue([itemWithValidData]);

      const result = await service.validateImportData('job-1', 'user-1');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect validation errors', async () => {
      const jobWithMapping = {
        ...mockImportJob,
        columnMap: { Subject: 'subjectName', Section: 'sectionCode', Time: 'startTime', Days: 'daysOfWeek', EndTime: 'endTime' },
      };
      const itemWithInvalidData = {
        ...mockImportItem,
        rawRow: { Subject: '', Section: '001', Time: 'invalid-time', EndTime: '10:30', Days: 'INVALID' },
      };

      importJobRepository.findById.mockResolvedValue(jobWithMapping);
      importItemRepository.findByImportJobId.mockResolvedValue([itemWithInvalidData]);

      const result = await service.validateImportData('job-1', 'user-1');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('subjectName'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('time format'))).toBe(true);
    });

    it('should throw error when column mapping is missing', async () => {
      importJobRepository.findById.mockResolvedValue(mockImportJob);

      await expect(service.validateImportData('job-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteImportJob', () => {
    it('should delete import job successfully', async () => {
      importJobRepository.findById.mockResolvedValue(mockImportJob);
      importJobRepository.delete.mockResolvedValue(undefined);

      await service.deleteImportJob('job-1', 'user-1');

      expect(importJobRepository.delete).toHaveBeenCalledWith('job-1');
    });

    it('should throw error for applied jobs', async () => {
      const appliedJob = { ...mockImportJob, state: 'applied' as const };
      importJobRepository.findById.mockResolvedValue(appliedJob);

      await expect(service.deleteImportJob('job-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });
});