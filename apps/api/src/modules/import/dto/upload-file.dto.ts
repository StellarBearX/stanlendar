import { IsIn, IsOptional } from 'class-validator';

export class UploadFileDto {
  @IsIn(['csv', 'xlsx'])
  fileType: 'csv' | 'xlsx';
}

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ImportPreview {
  jobId: string;
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  column?: string;
  message: string;
  value?: any;
}

export interface ColumnMapping {
  [csvColumn: string]: string; // maps to database field
}

export interface ValidationResult {
  isValid: boolean;
  errors: ImportError[];
  warnings: ImportError[];
}