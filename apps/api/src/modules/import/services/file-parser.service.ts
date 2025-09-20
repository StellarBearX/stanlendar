import { Injectable, BadRequestException } from '@nestjs/common';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import { ParsedRow, ImportError } from '../dto/upload-file.dto';

@Injectable()
export class FileParserService {
  async parseCSV(buffer: Buffer): Promise<{ headers: string[]; rows: ParsedRow[]; errors: ImportError[] }> {
    const errors: ImportError[] = [];
    const rows: ParsedRow[] = [];
    let headers: string[] = [];

    try {
      const stream = Readable.from(buffer);
      
      return new Promise((resolve, reject) => {
        let rowIndex = 0;
        let headersSet = false;

        stream
          .pipe(csv({
            skipEmptyLines: true,
            skipLinesWithError: false,
          }))
          .on('headers', (headerList: string[]) => {
            headers = headerList.map(h => h.trim());
            headersSet = true;
          })
          .on('data', (data: any) => {
            rowIndex++;
            
            if (!headersSet) {
              errors.push({
                row: rowIndex,
                message: 'Headers not properly detected',
              });
              return;
            }

            // Clean and validate row data
            const cleanedRow: ParsedRow = {};
            for (const [key, value] of Object.entries(data)) {
              const cleanKey = key.trim();
              const cleanValue = typeof value === 'string' ? value.trim() : value;
              cleanedRow[cleanKey] = cleanValue === '' ? null : cleanValue;
            }

            rows.push(cleanedRow);
          })
          .on('error', (error: Error) => {
            errors.push({
              row: rowIndex,
              message: `CSV parsing error: ${error.message}`,
            });
          })
          .on('end', () => {
            resolve({ headers, rows, errors });
          });
      });
    } catch (error) {
      throw new BadRequestException(`Failed to parse CSV: ${error.message}`);
    }
  }

  async parseXLSX(buffer: Buffer): Promise<{ headers: string[]; rows: ParsedRow[]; errors: ImportError[] }> {
    const errors: ImportError[] = [];
    
    try {
      // Validate buffer is not empty
      if (!buffer || buffer.length === 0) {
        throw new BadRequestException('Excel file is empty or corrupted');
      }

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      if (!workbook || workbook.SheetNames.length === 0) {
        throw new BadRequestException('No sheets found in Excel file');
      }

      // Use the first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        throw new BadRequestException('Excel sheet is empty or corrupted');
      }
      
      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: null,
        blankrows: false,
      }) as any[][];

      if (jsonData.length === 0) {
        throw new BadRequestException('Excel sheet is empty');
      }

      // First row as headers
      const headers = jsonData[0]
        .map((h: any) => h ? String(h).trim() : '')
        .filter((h: string) => h !== '');

      if (headers.length === 0) {
        throw new BadRequestException('No valid headers found in Excel file');
      }

      // Convert remaining rows to objects
      const rows: ParsedRow[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const rowData = jsonData[i];
        const row: ParsedRow = {};
        
        headers.forEach((header, index) => {
          const value = rowData[index];
          row[header] = value === undefined || value === '' ? null : value;
        });

        // Skip completely empty rows
        const hasData = Object.values(row).some(v => v !== null && v !== '');
        if (hasData) {
          rows.push(row);
        }
      }

      return { headers, rows, errors };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to parse Excel file: ${error.message}`);
    }
  }

  validateFileType(filename: string, mimeType: string): 'csv' | 'xlsx' {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (extension === 'csv' || mimeType === 'text/csv') {
      return 'csv';
    }
    
    if (extension === 'xlsx' || 
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return 'xlsx';
    }
    
    throw new BadRequestException('Unsupported file type. Only CSV and XLSX files are allowed.');
  }

  validateFileSize(size: number, maxSizeMB: number = 10): void {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (size > maxSizeBytes) {
      throw new BadRequestException(`File size exceeds ${maxSizeMB}MB limit`);
    }
  }
}