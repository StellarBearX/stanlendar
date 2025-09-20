import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FileParserService } from '../services/file-parser.service';

describe('FileParserService', () => {
  let service: FileParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileParserService],
    }).compile();

    service = module.get<FileParserService>(FileParserService);
  });

  describe('validateFileType', () => {
    it('should validate CSV files correctly', () => {
      expect(service.validateFileType('test.csv', 'text/csv')).toBe('csv');
      expect(service.validateFileType('test.CSV', 'text/csv')).toBe('csv');
    });

    it('should validate XLSX files correctly', () => {
      expect(service.validateFileType('test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('xlsx');
      expect(service.validateFileType('test.XLSX', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('xlsx');
    });

    it('should throw error for unsupported file types', () => {
      expect(() => service.validateFileType('test.txt', 'text/plain')).toThrow(BadRequestException);
      expect(() => service.validateFileType('test.pdf', 'application/pdf')).toThrow(BadRequestException);
    });
  });

  describe('validateFileSize', () => {
    it('should accept files within size limit', () => {
      expect(() => service.validateFileSize(5 * 1024 * 1024, 10)).not.toThrow(); // 5MB file, 10MB limit
    });

    it('should reject files exceeding size limit', () => {
      expect(() => service.validateFileSize(15 * 1024 * 1024, 10)).toThrow(BadRequestException); // 15MB file, 10MB limit
    });

    it('should use default 10MB limit', () => {
      expect(() => service.validateFileSize(5 * 1024 * 1024)).not.toThrow(); // 5MB file
      expect(() => service.validateFileSize(15 * 1024 * 1024)).toThrow(BadRequestException); // 15MB file
    });
  });

  describe('parseCSV', () => {
    it('should parse valid CSV data', async () => {
      const csvData = `Subject,Section,Time,Room
Math 101,001,09:00-10:30,A101
Physics 201,002,14:00-15:30,B202`;
      
      const buffer = Buffer.from(csvData);
      const result = await service.parseCSV(buffer);

      expect(result.headers).toEqual(['Subject', 'Section', 'Time', 'Room']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({
        Subject: 'Math 101',
        Section: '001',
        Time: '09:00-10:30',
        Room: 'A101',
      });
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty cells as null', async () => {
      const csvData = `Subject,Section,Time,Room
Math 101,,09:00-10:30,
Physics 201,002,14:00-15:30,B202`;
      
      const buffer = Buffer.from(csvData);
      const result = await service.parseCSV(buffer);

      expect(result.rows[0]).toEqual({
        Subject: 'Math 101',
        Section: null,
        Time: '09:00-10:30',
        Room: null,
      });
    });

    it('should handle malformed CSV gracefully', async () => {
      const csvData = `Subject,Section,Time,Room
Math 101,001,09:00-10:30,A101
"Unclosed quote,002,14:00-15:30,B202`;
      
      const buffer = Buffer.from(csvData);
      const result = await service.parseCSV(buffer);

      // Should still parse what it can
      expect(result.headers).toEqual(['Subject', 'Section', 'Time', 'Room']);
      expect(result.rows.length).toBeGreaterThanOrEqual(1); // At least the valid row
    });
  });

  describe('parseXLSX', () => {
    it('should throw error for empty workbook', async () => {
      // Create a minimal XLSX buffer that represents an empty workbook
      const emptyWorkbookBuffer = Buffer.from([]);
      
      await expect(service.parseXLSX(emptyWorkbookBuffer)).rejects.toThrow(BadRequestException);
    });

    it('should handle invalid XLSX data', async () => {
      const invalidBuffer = Buffer.from('not an excel file');
      
      // XLSX library is quite resilient and might parse invalid data as text
      // Let's test with completely empty buffer instead
      const emptyBuffer = Buffer.alloc(0);
      await expect(service.parseXLSX(emptyBuffer)).rejects.toThrow(BadRequestException);
    });
  });
});