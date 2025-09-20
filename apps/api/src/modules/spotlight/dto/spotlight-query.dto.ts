import { IsOptional, IsArray, IsString, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum SpotlightViewMode {
  HIDE_OTHERS = 'hide_others',
  DIM_OTHERS = 'dim_others'
}

export class SpotlightQueryDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secCodes?: string[];

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsString()
  teacher?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(SpotlightViewMode)
  viewMode?: SpotlightViewMode;
}

export class SpotlightResultDto {
  @Type(() => Object)
  events: any[];

  @Type(() => Object)
  subjects: any[];

  @Type(() => Object)
  sections: any[];

  totalCount: number;
  filteredCount: number;
}