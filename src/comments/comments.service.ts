import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================================================
  // CREATE
  // ==================================================

  async create(
    projectId: number,
    taskId: number,
    userId: number,
    dto: CreateCommentDto,
  ) {
    await this.checkProjectMember(projectId, userId);
    await this.checkTask(projectId, taskId);

    return this.prisma.comentario.create({
      data: {
        conteudo : dto.conteudo ,
        tarefaId: taskId,
        usuarioId: userId,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });
  }

  // ==================================================
  // FIND ALL
  // ==================================================

  async findAll(
    projectId: number,
    taskId: number,
    userId: number,
  ) {
    await this.checkProjectMember(projectId, userId);
    await this.checkTask(projectId, taskId);

    return this.prisma.comentario.findMany({
      where: {
        tarefaId: taskId,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
      orderBy: {
        dataCriacao: 'asc',
      },
    });
  }

  // ==================================================
  // DELETE
  // ==================================================

  async remove(
    projectId: number,
    taskId: number,
    commentId: number,
    userId: number,
  ) {
    await this.checkProjectMember(projectId, userId);
    await this.checkTask(projectId, taskId);

    const comentario =
      await this.prisma.comentario.findFirst({
        where: {
          id: commentId,
          tarefaId: taskId,
        },
      });

    if (!comentario) {
      throw new NotFoundException(
        'Comentário não encontrado',
      );
    }

    if (comentario.usuarioId !== userId) {
      throw new ForbiddenException(
        'Você só pode excluir seus próprios comentários',
      );
    }

    return this.prisma.comentario.delete({
      where: {
        id: commentId,
      },
    });
  }

  // ==================================================
  // HELPERS
  // ==================================================

  private async checkTask(
    projectId: number,
    taskId: number,
  ) {
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

    return tarefa;
  }

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

    // Responsável pelo projeto também possui acesso
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