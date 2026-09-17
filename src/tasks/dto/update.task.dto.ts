import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { Prioridade } from '@prisma/client';

export class UpdateTaskDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  titulo?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsEnum(Prioridade)
  @IsOptional()
  prioridade?: Prioridade;

  @IsDateString()
  @IsOptional()
  prazo?: string;
}