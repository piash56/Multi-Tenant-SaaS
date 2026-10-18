import { IsDateString, IsEnum, IsOptional, IsUUID } from "class-validator";

export enum AnalyticsRangePreset {
  TODAY = "today",
  LAST_7_DAYS = "last7days",
  LAST_30_DAYS = "last30days",
  CUSTOM = "custom",
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsEnum(AnalyticsRangePreset)
  preset: AnalyticsRangePreset = AnalyticsRangePreset.LAST_7_DAYS;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
