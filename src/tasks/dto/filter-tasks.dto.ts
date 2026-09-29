import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  Prioridade,
  StatusTarefa,
} from '@prisma/client';

export class FilterTasksDto {
  @IsOptional()
  @IsEnum(StatusTarefa)
  status?: StatusTarefa;

  @IsOptional()
  @IsEnum(Prioridade)
  prioridade?: Prioridade;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  responsavelId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}