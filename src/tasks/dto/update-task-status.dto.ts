import { IsEnum } from 'class-validator';
import { StatusTarefa } from '@prisma/client';

export class UpdateTaskStatusDto {
  @IsEnum(StatusTarefa)
  status: StatusTarefa;
}