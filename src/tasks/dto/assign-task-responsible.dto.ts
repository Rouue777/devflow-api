import {
  IsInt,
  IsPositive,
} from 'class-validator';

export class AssignTaskResponsibleDto {
  @IsInt()
  @IsPositive()
  responsavelId: number;
}