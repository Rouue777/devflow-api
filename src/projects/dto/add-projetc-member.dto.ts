import { IsInt, IsPositive } from 'class-validator';

export class AddProjectMemberDto {
  @IsInt()
  @IsPositive()
  usuarioId: number;
}