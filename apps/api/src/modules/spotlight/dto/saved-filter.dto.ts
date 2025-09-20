import { IsNotEmpty, IsString, IsObject, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { SpotlightQuery } from '../interfaces/spotlight.interface';

export class CreateSavedFilterDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsObject()
  query: SpotlightQuery;
}

export class UpdateSavedFilterDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsObject()
  query: SpotlightQuery;
}

export class DuplicateSavedFilterDto {
  @IsNotEmpty()
  @IsString()
  newName: string;
}

export class ImportSavedFiltersDto {
  @IsArray()
  @Type(() => CreateSavedFilterDto)
  filters: CreateSavedFilterDto[];
}

export class SavedFilterResponseDto {
  id: string;
  name: string;
  query: SpotlightQuery;
}