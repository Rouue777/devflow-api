import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { TasksService } from './tasks.service';

import { AssignTaskResponsibleDto } from './dto/assign-task-responsible.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CreateTaskDto } from './dto/create.task.dto';
import { UpdateTaskDto } from './dto/update.task.dto';

@Controller('projects/:projectId/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
  ) {}

  // Criar tarefa

  @Post()
  create(
    @Param('projectId', ParseIntPipe)
    projectId: number,

    @Req()
    request: any,

    @Body()
    dto: CreateTaskDto,
  ) {
    return this.tasksService.create(
      projectId,
      request.user.sub,
      dto,
    );
  }

  // Listar tarefas do projeto
  @Get()
  findAll(
    @Param('projectId', ParseIntPipe)
    projectId: number,

    @Req()
    request: any,
  ) {
    return this.tasksService.findAll(
      projectId,
      request.user.sub,
    );
  }

  // Buscar uma tarefa
  @Get(':taskId')
  findOne(
    @Param('projectId', ParseIntPipe)
    projectId: number,

    @Param('taskId', ParseIntPipe)
    taskId: number,

    @Req()
    request: any,
  ) {
    return this.tasksService.findOne(
      projectId,
      taskId,
      request.user.sub,
    );
  }

  // Editar dados da tarefa
  @Patch(':taskId')
  update(
    @Param('projectId', ParseIntPipe)
    projectId: number,

    @Param('taskId', ParseIntPipe)
    taskId: number,

    @Req()
    request: any,

    @Body()
    dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(
      projectId,
      taskId,
      request.user.sub,
      dto,
    );
  }

  // Atribuir responsável
  @Patch(':taskId/responsible')
  assignResponsible(
    @Param('projectId', ParseIntPipe)
    projectId: number,

    @Param('taskId', ParseIntPipe)
    taskId: number,

    @Req()
    request: any,

    @Body()
    dto: AssignTaskResponsibleDto,
  ) {
    return this.tasksService.assignResponsible(
      projectId,
      taskId,
      request.user.sub,
      dto.responsavelId,
    );
  }

  // Alterar status / workflow
  @Patch(':taskId/status')
  updateStatus(
    @Param('projectId', ParseIntPipe)
    projectId: number,

    @Param('taskId', ParseIntPipe)
    taskId: number,

    @Req()
    request: any,

    @Body()
    dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(
      projectId,
      taskId,
      request.user.sub,
      dto.status,
    );
  }

  // Excluir tarefa
  @Delete(':taskId')
  remove(
    @Param('projectId', ParseIntPipe)
    projectId: number,

    @Param('taskId', ParseIntPipe)
    taskId: number,

    @Req()
    request: any,
  ) {
    return this.tasksService.remove(
      projectId,
      taskId,
      request.user.sub,
    );
  }
}