import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { CommentsService } from './comments.service';

describe('CommentsService - integração', () => {
  let prisma: PrismaService;
  let service: CommentsService;

  let ownerId: number;
  let memberId: number;
  let outsiderId: number;
  let projectId: number;
  let taskId: number;

  const ownerEmail = 'comments.owner.integration@email.com';
  const memberEmail = 'comments.member.integration@email.com';
  const outsiderEmail = 'comments.outsider.integration@email.com';

  beforeAll(async () => {
    prisma = new PrismaService();
    service = new CommentsService(prisma);

    await prisma.$connect();
  });

  beforeEach(async () => {
    // ==========================================
    // LIMPEZA
    // ==========================================

    await prisma.comentario.deleteMany();
    await prisma.tarefa.deleteMany();
    await prisma.projetoUsuario.deleteMany();
    await prisma.projeto.deleteMany();

    await prisma.usuario.deleteMany({
      where: {
        email: {
          in: [
            ownerEmail,
            memberEmail,
            outsiderEmail,
          ],
        },
      },
    });

    // ==========================================
    // USUÁRIOS
    // ==========================================

    const owner = await prisma.usuario.create({
      data: {
        nome: 'Comments Owner',
        email: ownerEmail,
        senha: 'senha-hash-teste',
      },
    });

    const member = await prisma.usuario.create({
      data: {
        nome: 'Comments Member',
        email: memberEmail,
        senha: 'senha-hash-teste',
      },
    });

    const outsider = await prisma.usuario.create({
      data: {
        nome: 'Comments Outsider',
        email: outsiderEmail,
        senha: 'senha-hash-teste',
      },
    });

    ownerId = owner.id;
    memberId = member.id;
    outsiderId = outsider.id;

    // ==========================================
    // PROJETO
    // ==========================================

    const projeto = await prisma.projeto.create({
      data: {
        nome: 'Projeto Comments Integration',
        responsavelId: ownerId,
        membros: {
          create: [
            {
              usuarioId: ownerId,
            },
            {
              usuarioId: memberId,
            },
          ],
        },
      },
    });

    projectId = projeto.id;

    // ==========================================
    // TAREFA
    // ==========================================

    const tarefa = await prisma.tarefa.create({
      data: {
        titulo: 'Implementar comentários',
        prioridade: 'MEDIA',
        projetoId : projectId,
        responsavelId: memberId,
      },
    });

    taskId = tarefa.id;
  });

  afterAll(async () => {
    await prisma.comentario.deleteMany();
    await prisma.tarefa.deleteMany();
    await prisma.projetoUsuario.deleteMany();
    await prisma.projeto.deleteMany();

    await prisma.usuario.deleteMany({
      where: {
        email: {
          in: [
            ownerEmail,
            memberEmail,
            outsiderEmail,
          ],
        },
      },
    });

    await prisma.$disconnect();
  });

  // ==================================================
  // CREATE
  // ==================================================

  describe('create', () => {
    it('deve criar comentário no banco como responsável do projeto', async () => {
      const result = await service.create(
        projectId,
        taskId,
        ownerId,
        {
          conteudo: 'Comentário de integração',
        },
      );

      expect(result.id).toBeDefined();
      expect(result.conteudo).toBe(
        'Comentário de integração',
      );
      expect(result.tarefaId).toBe(taskId);
      expect(result.usuarioId).toBe(ownerId);

      const comentarioBanco =
        await prisma.comentario.findUnique({
          where: {
            id: result.id,
          },
        });

      expect(comentarioBanco).not.toBeNull();
      expect(comentarioBanco?.conteudo).toBe(
        'Comentário de integração',
      );
    });

    it('deve permitir membro do projeto criar comentário', async () => {
      const result = await service.create(
        projectId,
        taskId,
        memberId,
        {
          conteudo: 'Comentário do membro',
        },
      );

      expect(result.usuarioId).toBe(memberId);

      const comentarioBanco =
        await prisma.comentario.findUnique({
          where: {
            id: result.id,
          },
        });

      expect(comentarioBanco).not.toBeNull();
      expect(comentarioBanco?.usuarioId).toBe(
        memberId,
      );
    });

    it('deve impedir usuário fora do projeto de criar comentário', async () => {
      await expect(
        service.create(
          projectId,
          taskId,
          outsiderId,
          {
            conteudo: 'Não deveria ser criado',
          },
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      const comentarios =
        await prisma.comentario.findMany();

      expect(comentarios).toHaveLength(0);
    });

    it('deve impedir comentário em tarefa inexistente', async () => {
      await expect(
        service.create(
          projectId,
          999999,
          ownerId,
          {
            conteudo: 'Tarefa inexistente',
          },
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      const comentarios =
        await prisma.comentario.findMany();

      expect(comentarios).toHaveLength(0);
    });

    it('deve impedir comentário usando tarefa de outro projeto', async () => {
      const outroProjeto =
        await prisma.projeto.create({
          data: {
            nome: 'Outro projeto',
            responsavelId: ownerId,
            membros: {
              create: {
                usuarioId: ownerId,
              },
            },
          },
        });

      const outraTarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Outra tarefa',
            prioridade: 'BAIXA',
            projetoId: outroProjeto.id,
          },
        });

      await expect(
        service.create(
          projectId,
          outraTarefa.id,
          ownerId,
          {
            conteudo: 'Projeto incorreto',
          },
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ==================================================
  // FIND ALL
  // ==================================================

  describe('findAll', () => {
    it('deve listar comentários da tarefa', async () => {
      await prisma.comentario.create({
        data: {
          conteudo: 'Primeiro comentário',
          tarefaId: taskId,
          usuarioId: ownerId,
        },
      });

      await prisma.comentario.create({
        data: {
          conteudo: 'Segundo comentário',
          tarefaId: taskId,
          usuarioId: memberId,
        },
      });

      const result = await service.findAll(
        projectId,
        taskId,
        ownerId,
      );

      expect(result).toHaveLength(2);

      expect(result[0].conteudo).toBe(
        'Primeiro comentário',
      );

      expect(result[1].conteudo).toBe(
        'Segundo comentário',
      );
    });

    it('deve retornar lista vazia quando tarefa não possuir comentários', async () => {
      const result = await service.findAll(
        projectId,
        taskId,
        ownerId,
      );

      expect(result).toEqual([]);
    });

    it('deve listar comentários para membro do projeto', async () => {
      await prisma.comentario.create({
        data: {
          conteudo: 'Comentário existente',
          tarefaId: taskId,
          usuarioId: ownerId,
        },
      });

      const result = await service.findAll(
        projectId,
        taskId,
        memberId,
      );

      expect(result).toHaveLength(1);
    });

    it('deve impedir usuário fora do projeto de listar comentários', async () => {
      await expect(
        service.findAll(
          projectId,
          taskId,
          outsiderId,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('deve listar somente comentários da tarefa informada', async () => {
      const outraTarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Segunda tarefa',
            prioridade: 'BAIXA',
            projetoId : projectId,
          },
        });

      await prisma.comentario.create({
        data: {
          conteudo: 'Comentário tarefa principal',
          tarefaId: taskId,
          usuarioId: ownerId,
        },
      });

      await prisma.comentario.create({
        data: {
          conteudo: 'Comentário outra tarefa',
          tarefaId: outraTarefa.id,
          usuarioId: ownerId,
        },
      });

      const result = await service.findAll(
        projectId,
        taskId,
        ownerId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].conteudo).toBe(
        'Comentário tarefa principal',
      );
      expect(result[0].tarefaId).toBe(taskId);
    });
  });

  // ==================================================
  // REMOVE
  // ==================================================

  describe('remove', () => {
    it('deve permitir autor excluir seu comentário', async () => {
      const comentario =
        await prisma.comentario.create({
          data: {
            conteudo: 'Comentário para excluir',
            tarefaId: taskId,
            usuarioId: memberId,
          },
        });

      await service.remove(
        projectId,
        taskId,
        comentario.id,
        memberId,
      );

      const comentarioBanco =
        await prisma.comentario.findUnique({
          where: {
            id: comentario.id,
          },
        });

      expect(comentarioBanco).toBeNull();
    });

    it('deve impedir outro membro de excluir comentário', async () => {
      const comentario =
        await prisma.comentario.create({
          data: {
            conteudo: 'Comentário do membro',
            tarefaId: taskId,
            usuarioId: memberId,
          },
        });

      await expect(
        service.remove(
          projectId,
          taskId,
          comentario.id,
          ownerId,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      const comentarioBanco =
        await prisma.comentario.findUnique({
          where: {
            id: comentario.id,
          },
        });

      expect(comentarioBanco).not.toBeNull();
    });

    it('deve impedir usuário fora do projeto de excluir comentário', async () => {
      const comentario =
        await prisma.comentario.create({
          data: {
            conteudo: 'Comentário protegido',
            tarefaId: taskId,
            usuarioId: memberId,
          },
        });

      await expect(
        service.remove(
          projectId,
          taskId,
          comentario.id,
          outsiderId,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      const comentarioBanco =
        await prisma.comentario.findUnique({
          where: {
            id: comentario.id,
          },
        });

      expect(comentarioBanco).not.toBeNull();
    });

    it('deve lançar erro ao excluir comentário inexistente', async () => {
      await expect(
        service.remove(
          projectId,
          taskId,
          999999,
          ownerId,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deve impedir excluir comentário de outra tarefa', async () => {
      const outraTarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Outra tarefa',
            prioridade: 'MEDIA',
            projetoId : projectId,
          },
        });

      const comentario =
        await prisma.comentario.create({
          data: {
            conteudo: 'Comentário da outra tarefa',
            tarefaId: outraTarefa.id,
            usuarioId: ownerId,
          },
        });

      await expect(
        service.remove(
          projectId,
          taskId,
          comentario.id,
          ownerId,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      const comentarioBanco =
        await prisma.comentario.findUnique({
          where: {
            id: comentario.id,
          },
        });

      expect(comentarioBanco).not.toBeNull();
    });
  });
});