import { IsString, IsDateString, IsEnum, IsOptional, MaxLength } from 'class-validator';

export enum ActivityType {
  WORK = 'WORK',
  MEETING = 'MEETING',
  FIELD = 'FIELD',
  TRAVEL = 'TRAVEL',
  ADMIN = 'ADMIN',
}

export enum LogSource {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
}

export class CreateLogDto {
  @IsDateString()
  date: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsEnum(ActivityType)
  activityType: ActivityType;

  @IsString()
  @MaxLength(120)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsEnum(LogSource)
  source?: LogSource;
}

export class UpdateLogDto {
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(ActivityType)
  activityType?: ActivityType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class SyncLogsDto {
  logs: CreateLogDto[];
}
