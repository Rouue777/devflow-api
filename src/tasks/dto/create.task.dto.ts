import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

import {
  Prioridade,
  StatusTarefa,
} from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsEnum(Prioridade)
  prioridade: Prioridade;

  @IsEnum(StatusTarefa)
  @IsOptional()
  status?: StatusTarefa;

  @IsDateString()
  @IsOptional()
  prazo?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  responsavelId?: number;
}