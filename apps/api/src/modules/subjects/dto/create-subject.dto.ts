import { IsNotEmpty, IsOptional, IsString, IsHexColor, IsObject, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSubjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsHexColor()
  @Transform(({ value }) => value?.toLowerCase())
  colorHex: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}