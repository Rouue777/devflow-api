import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { StatusTarefa } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create.task.dto';
import { UpdateTaskDto } from './dto/update.task.dto';


@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================
  // CRIAR TAREFA
  // =========================

  async create(
    projectId: number,
    userId: number,
    dto: CreateTaskDto,
  ) {
    await this.checkProjectMember(projectId, userId);

    if (
      dto.status &&
      dto.status !== StatusTarefa.CRIADO &&
      dto.status !== StatusTarefa.EM_PROGRESSO
    ) {
      throw new BadRequestException(
        'A tarefa só pode ser criada como CRIADO ou EM_PROGRESSO',
      );
    }

    if (dto.responsavelId) {
      await this.checkProjectMember(
        projectId,
        dto.responsavelId,
      );
    }

    return this.prisma.tarefa.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        prioridade: dto.prioridade,
        status: dto.status ?? StatusTarefa.CRIADO,
        prazo: dto.prazo
          ? new Date(dto.prazo)
          : undefined,

        projetoId : projectId,
        responsavelId: dto.responsavelId,
      },
      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });
  }

  // =========================
  // LISTAR TAREFAS
  // =========================

  async findAll(
    projectId: number,
    userId: number,
  ) {
    await this.checkProjectMember(projectId, userId);

    return this.prisma.tarefa.findMany({
      where: {
        projetoId: projectId,
      },
      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
      orderBy: {
        dataCriacao: 'desc',
      },
    });
  }

  // =========================
  // BUSCAR TAREFA
  // =========================

  async findOne(
    projectId: number,
    taskId: number,
    userId: number,
  ) {
    await this.checkProjectMember(projectId, userId);

    const tarefa = await this.prisma.tarefa.findFirst({
      where: {
        id: taskId,
        projetoId: projectId,
      },
      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });

    if (!tarefa) {
      throw new NotFoundException(
        'Tarefa não encontrada',
      );
    }

    return tarefa;
  }

  // =========================
  // EDITAR TAREFA
  // =========================

  async update(
    projectId: number,
    taskId: number,
    userId: number,
    dto: UpdateTaskDto,
  ) {
    await this.findOne(
      projectId,
      taskId,
      userId,
    );

    return this.prisma.tarefa.update({
      where: {
        id: taskId,
      },
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        prioridade: dto.prioridade,
        prazo: dto.prazo
          ? new Date(dto.prazo)
          : undefined,
      },
    });
  }

  // =========================
  // ATRIBUIR RESPONSÁVEL
  // =========================

  async assignResponsible(
    projectId: number,
    taskId: number,
    userId: number,
    responsibleId: number,
  ) {
    await this.findOne(
      projectId,
      taskId,
      userId,
    );

    // O responsável da tarefa precisa ser
    // membro do mesmo projeto.
    await this.checkProjectMember(
      projectId,
      responsibleId,
    );

    return this.prisma.tarefa.update({
      where: {
        id: taskId,
      },
      data: {
        responsavelId: responsibleId,
      },
      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });
  }

  // =========================
  // EXCLUIR TAREFA
  // =========================

  async remove(
    projectId: number,
    taskId: number,
    userId: number,
  ) {
    const projeto =
      await this.prisma.projeto.findUnique({
        where: {
          id: projectId,
        },
      });

    if (!projeto) {
      throw new NotFoundException(
        'Projeto não encontrado',
      );
    }

    // Apenas o responsável PELO PROJETO
    // pode excluir tarefas.
    if (projeto.responsavelId !== userId) {
      throw new ForbiddenException(
        'Apenas o responsável pelo projeto pode excluir tarefas',
      );
    }

    const tarefa =
      await this.prisma.tarefa.findFirst({
        where: {
          id: taskId,
          projetoId: projectId,
        },
      });

    if (!tarefa) {
      throw new NotFoundException(
        'Tarefa não encontrada',
      );
    }

    return this.prisma.tarefa.delete({
      where: {
        id: taskId,
      },
    });
  }

  // =========================
  // ALTERAR STATUS
  // =========================

  async updateStatus(
    projectId: number,
    taskId: number,
    userId: number,
    newStatus: StatusTarefa,
  ) {
    const tarefa = await this.findOne(
      projectId,
      taskId,
      userId,
    );

    const currentStatus = tarefa.status;

    // Mesmo status: não há transição
    if (currentStatus === newStatus) {
      throw new BadRequestException(
        'A tarefa já possui este status',
      );
    }

    const allowedTransitions: Record<
      StatusTarefa,
      StatusTarefa[]
    > = {
      [StatusTarefa.CRIADO]: [
        StatusTarefa.EM_PROGRESSO,
      ],

      [StatusTarefa.EM_PROGRESSO]: [
        StatusTarefa.EM_REVIEW,
      ],

      [StatusTarefa.EM_REVIEW]: [
        StatusTarefa.EM_PROGRESSO,
        StatusTarefa.FEITO,
      ],

      [StatusTarefa.FEITO]: [
        StatusTarefa.EM_REVIEW,
      ],
    };

    if (
      !allowedTransitions[currentStatus].includes(
        newStatus,
      )
    ) {
      throw new BadRequestException(
        `Transição de ${currentStatus} para ${newStatus} não permitida`,
      );
    }

    // Somente responsável pelo projeto
    // aprova EM_REVIEW -> FEITO.
    if (newStatus === StatusTarefa.FEITO) {
      const projeto =
        await this.prisma.projeto.findUnique({
          where: {
            id: projectId,
          },
        });

      if (!projeto) {
        throw new NotFoundException(
          'Projeto não encontrado',
        );
      }

      if (projeto.responsavelId !== userId) {
        throw new ForbiddenException(
          'Apenas o responsável pelo projeto pode concluir a tarefa',
        );
      }
    }

    return this.prisma.tarefa.update({
      where: {
        id: taskId,
      },
      data: {
        status: newStatus,
      },
    });
  }

  // =========================
  // MÉTODOS AUXILIARES
  // =========================

  private async checkProjectMember(
    projectId: number,
    userId: number,
  ) {
    const projeto =
      await this.prisma.projeto.findUnique({
        where: {
          id: projectId,
        },
      });

    if (!projeto) {
      throw new NotFoundException(
        'Projeto não encontrado',
      );
    }

    // O responsável também possui acesso.
    if (projeto.responsavelId === userId) {
      return;
    }

    const membro =
      await this.prisma.projetoUsuario.findUnique({
        where: {
          projetoId_usuarioId: {
            projetoId: projectId,
            usuarioId: userId,
          },
        },
      });

    if (!membro) {
      throw new ForbiddenException(
        'Você não possui acesso a este projeto',
      );
    }
  }
}