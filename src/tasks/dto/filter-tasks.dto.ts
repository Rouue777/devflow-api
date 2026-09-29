import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Prioridade, StatusTarefa } from '@prisma/client';

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
}