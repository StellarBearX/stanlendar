import { IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class GenerateEventsDto {
  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid ISO date string (YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO date string (YYYY-MM-DD)' })
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}