import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ScheduleRuleDto } from './schedule-rule.dto';

export class CreateSectionDto {
  @IsNotEmpty()
  @IsString()
  subjectId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  secCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  teacher?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  room?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleRuleDto)
  scheduleRules: ScheduleRuleDto[];
}