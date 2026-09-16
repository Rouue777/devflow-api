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
} from '@nestjs/common';

import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}