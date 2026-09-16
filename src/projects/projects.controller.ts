import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  Delete
} from '@nestjs/common';

import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddProjectMemberDto } from './dto/add-projetc-member.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  // CRIAR PROJETO
  @Post()
  create(
    @Req() request: any,
    @Body() dto: CreateProjectDto,
  ) {
    const userId = request.user.sub;

    return this.projectsService.create(userId, dto);
  }

  // LISTAR PROJETOS DO USUÁRIO
  @Get()
  findAll(@Req() request: any) {
    const userId = request.user.sub;

    return this.projectsService.findAll(userId);
  }

  // BUSCAR PROJETO POR ID
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) projectId: number,
    @Req() request: any,
  ) {
    const userId = request.user.sub;

    return this.projectsService.findOne(projectId, userId);
  }

  // EDITAR PROJETO
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) projectId: number,
    @Req() request: any,
    @Body() dto: UpdateProjectDto,
  ) {
    const userId = request.user.sub;

    return this.projectsService.update(
      projectId,
      userId,
      dto,
    );
  }

  /// rotas de membros 

  //adicionar membro aop rojeto
  @Post(':id/members')
addMember(
  @Param('id', ParseIntPipe) projectId: number,
  @Req() request: any,
  @Body() dto: AddProjectMemberDto,
) {
  const userId = request.user.sub;

  return this.projectsService.addMember(
    projectId,
    userId,
    dto.usuarioId,
  );
}

//consultar todos memberos do projeto
@Get(':id/members')
findMembers(
  @Param('id', ParseIntPipe) projectId: number,
  @Req() request: any,
) {
  const userId = request.user.sub;

  return this.projectsService.findMembers(
    projectId,
    userId,
  );
}


///deletar membro do projeto
@Delete(':id/members/:memberId')
removeMember(
  @Param('id', ParseIntPipe) projectId: number,
  @Param('memberId', ParseIntPipe) memberId: number,
  @Req() request: any,
) {
  const userId = request.user.sub;

  return this.projectsService.removeMember(
    projectId,
    userId,
    memberId,
  );
}
}