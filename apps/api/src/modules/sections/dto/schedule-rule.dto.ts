import { IsNotEmpty, IsInt, IsString, IsOptional, IsArray, IsDateString, Min, Max, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class ScheduleRuleDto {
  @IsInt()
  @Min(0, { message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' })
  @Max(6, { message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' })
  dayOfWeek: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Start time must be in HH:MM format' })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'End time must be in HH:MM format' })
  endTime: string;

  @IsDateString({}, { message: 'Start date must be a valid ISO date string (YYYY-MM-DD)' })
  startDate: string;

  @IsDateString({}, { message: 'End date must be a valid ISO date string (YYYY-MM-DD)' })
  endDate: string;

  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true, message: 'Each skip date must be a valid ISO date string (YYYY-MM-DD)' })
  skipDates?: string[];
}