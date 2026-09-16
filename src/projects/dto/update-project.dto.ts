import {
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  descricao?: string;
}