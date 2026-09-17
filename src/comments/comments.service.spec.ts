import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CommentsService', () => {
  let service: CommentsService;

  let prisma: {
    projeto: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    projetoUsuario: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    tarefa: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    comentario: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const projectId = 1;
  const taskId = 10;
  const userId = 100;
  const memberId = 200;
  const commentId = 50;

  const projeto = {
    id: projectId,
    nome: 'DevFlow',
    responsavelId: userId,
  };

  const tarefa = {
    id: taskId,
    titulo: 'Criar Comments',
    projetoId: projectId,
  };

  const comentario = {
    id: commentId,
    conteudo: 'Comentário de teste',
    tarefaId: taskId,
    usuarioId: userId,
  };

  beforeEach(() => {
    prisma = {
      projeto: {
        findUnique: vi.fn(),
      },

      projetoUsuario: {
        findUnique: vi.fn(),
      },

      tarefa: {
        findFirst: vi.fn(),
      },

      comentario: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
    };

    service = new CommentsService(
      prisma as unknown as PrismaService,
    );
  });

  // ==================================================
  // CREATE
  // ==================================================

  describe('create', () => {
    it('deve criar comentário como responsável do projeto', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.tarefa.findFirst.mockResolvedValue(tarefa);
      prisma.comentario.create.mockResolvedValue(comentario);

      const result = await service.create(
        projectId,
        taskId,
        userId,
        {
          conteudo: 'Comentário de teste',
        },
      );

      expect(result).toEqual(comentario);

      expect(prisma.comentario.create).toHaveBeenCalledWith({
        data: {
          conteudo: 'Comentário de teste',
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
    });

    it('deve permitir membro do projeto criar comentário', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);

      prisma.projetoUsuario.findUnique.mockResolvedValue({
        projetoId : projectId,
        usuarioId: memberId,
      });

      prisma.tarefa.findFirst.mockResolvedValue(tarefa);
      prisma.comentario.create.mockResolvedValue({
        ...comentario,
        usuarioId: memberId,
      });

      const result = await service.create(
        projectId,
        taskId,
        memberId,
        {
          conteudo: 'Comentário do membro',
        },
      );

      expect(result.usuarioId).toBe(memberId);
      expect(prisma.comentario.create).toHaveBeenCalledOnce();
    });

    it('deve impedir usuário fora do projeto de criar comentário', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.projetoUsuario.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          projectId,
          taskId,
          memberId,
          {
            conteudo: 'Sem acesso',
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.comentario.create).not.toHaveBeenCalled();
    });

    it('deve lançar erro quando projeto não existir', async () => {
      prisma.projeto.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          projectId,
          taskId,
          userId,
          {
            conteudo: 'Teste',
          },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.comentario.create).not.toHaveBeenCalled();
    });

    it('deve lançar erro quando tarefa não pertencer ao projeto', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.tarefa.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          projectId,
          taskId,
          userId,
          {
            conteudo: 'Teste',
          },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.comentario.create).not.toHaveBeenCalled();
    });
  });

  // ==================================================
  // FIND ALL
  // ==================================================

  describe('findAll', () => {
    it('deve listar comentários da tarefa', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.tarefa.findFirst.mockResolvedValue(tarefa);

      prisma.comentario.findMany.mockResolvedValue([
        comentario,
        {
          ...comentario,
          id: 51,
          conteudo: 'Segundo comentário',
        },
      ]);

      const result = await service.findAll(
        projectId,
        taskId,
        userId,
      );

      expect(result).toHaveLength(2);

      expect(prisma.comentario.findMany).toHaveBeenCalledWith({
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
    });

    it('deve retornar lista vazia quando não houver comentários', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.tarefa.findFirst.mockResolvedValue(tarefa);
      prisma.comentario.findMany.mockResolvedValue([]);

      const result = await service.findAll(
        projectId,
        taskId,
        userId,
      );

      expect(result).toEqual([]);
    });

    it('deve impedir usuário fora do projeto de listar comentários', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.projetoUsuario.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll(
          projectId,
          taskId,
          memberId,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.comentario.findMany).not.toHaveBeenCalled();
    });

    it('deve lançar erro quando tarefa não existir', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.tarefa.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(
          projectId,
          taskId,
          userId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.comentario.findMany).not.toHaveBeenCalled();
    });
  });

  // ==================================================
  // REMOVE
  // ==================================================

  describe('remove', () => {
    it('deve permitir autor excluir seu próprio comentário', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.tarefa.findFirst.mockResolvedValue(tarefa);
      prisma.comentario.findFirst.mockResolvedValue(comentario);
      prisma.comentario.delete.mockResolvedValue(comentario);

      const result = await service.remove(
        projectId,
        taskId,
        commentId,
        userId,
      );

      expect(result).toEqual(comentario);

      expect(prisma.comentario.delete).toHaveBeenCalledWith({
        where: {
          id: commentId,
        },
      });
    });

    it('deve impedir outro membro de excluir comentário', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);

      prisma.projetoUsuario.findUnique.mockResolvedValue({
        projetoId : projectId,
        usuarioId: memberId,
      });

      prisma.tarefa.findFirst.mockResolvedValue(tarefa);

      prisma.comentario.findFirst.mockResolvedValue({
        ...comentario,
        usuarioId: userId,
      });

      await expect(
        service.remove(
          projectId,
          taskId,
          commentId,
          memberId,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.comentario.delete).not.toHaveBeenCalled();
    });

    it('deve lançar erro ao excluir comentário inexistente', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.tarefa.findFirst.mockResolvedValue(tarefa);
      prisma.comentario.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(
          projectId,
          taskId,
          999,
          userId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.comentario.delete).not.toHaveBeenCalled();
    });

    it('deve impedir usuário fora do projeto de excluir comentário', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.projetoUsuario.findUnique.mockResolvedValue(null);

      await expect(
        service.remove(
          projectId,
          taskId,
          commentId,
          memberId,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(prisma.comentario.delete).not.toHaveBeenCalled();
    });

    it('deve buscar comentário vinculado à tarefa correta', async () => {
      prisma.projeto.findUnique.mockResolvedValue(projeto);
      prisma.tarefa.findFirst.mockResolvedValue(tarefa);
      prisma.comentario.findFirst.mockResolvedValue(comentario);
      prisma.comentario.delete.mockResolvedValue(comentario);

      await service.remove(
        projectId,
        taskId,
        commentId,
        userId,
      );

      expect(prisma.comentario.findFirst).toHaveBeenCalledWith({
        where: {
          id: commentId,
          tarefaId: taskId,
        },
      });
    });
  });
});