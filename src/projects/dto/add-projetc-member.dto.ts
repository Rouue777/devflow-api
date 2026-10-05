import {
  IsEmail,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class AddProjectMemberDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
