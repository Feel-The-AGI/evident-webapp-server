import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum ExportFormat {
  PDF = 'PDF',
  TEXT = 'TEXT',
}

export class GenerateExportDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;
}
