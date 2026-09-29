import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}