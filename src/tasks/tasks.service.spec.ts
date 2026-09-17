import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prioridade,
  StatusTarefa,
} from '@prisma/client';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;

  const projectId = 1;
  const taskId = 10;
  const userId = 1;
  const memberId = 2;

  const projeto = {
    id: projectId,
    nome: 'DevFlow',
    descricao: null,
    responsavelId: userId,
    dataCriacao: new Date(),
  };

  const tarefa = {
    id: taskId,
    titulo: 'Criar API',
    descricao: 'Implementar API',
    prioridade: Prioridade.ALTA,
    status: StatusTarefa.CRIADO,
    prazo: null,
    projetoId: projectId,
    responsavelId: null,
    dataCriacao: new Date(),
    dataAtualizacao: new Date(),
    responsavel: null,
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
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    service = new TasksService(
      prisma as PrismaService,
    );
  });

  // ==================================================
  // CREATE
  // ==================================================

  describe('create', () => {
    it('deve criar uma tarefa com status CRIADO por padrão', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.create.mockResolvedValue(
        tarefa,
      );

      const result = await service.create(
        projectId,
        userId,
        {
          titulo: 'Criar API',
          descricao: 'Implementar API',
          prioridade: Prioridade.ALTA,
        },
      );

      expect(result).toEqual(tarefa);

      expect(
        prisma.tarefa.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            titulo: 'Criar API',
            prioridade: Prioridade.ALTA,
            status: StatusTarefa.CRIADO,
            projetoId : projectId,
          }),
        }),
      );
    });

    it('deve permitir criar tarefa em EM_PROGRESSO', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.create.mockResolvedValue({
        ...tarefa,
        status: StatusTarefa.EM_PROGRESSO,
      });

      await service.create(projectId, userId, {
        titulo: 'Criar API',
        prioridade: Prioridade.ALTA,
        status: StatusTarefa.EM_PROGRESSO,
      });

      expect(
        prisma.tarefa.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: StatusTarefa.EM_PROGRESSO,
          }),
        }),
      );
    });

    it('deve impedir criação diretamente em EM_REVIEW', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      await expect(
        service.create(projectId, userId, {
          titulo: 'Criar API',
          prioridade: Prioridade.ALTA,
          status: StatusTarefa.EM_REVIEW,
        }),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.tarefa.create,
      ).not.toHaveBeenCalled();
    });

    it('deve impedir criação diretamente em FEITO', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      await expect(
        service.create(projectId, userId, {
          titulo: 'Criar API',
          prioridade: Prioridade.ALTA,
          status: StatusTarefa.FEITO,
        }),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.tarefa.create,
      ).not.toHaveBeenCalled();
    });

    it('deve permitir criar tarefa com responsável que pertence ao projeto', async () => {
      prisma.projeto.findUnique
        .mockResolvedValueOnce(projeto)
        .mockResolvedValueOnce(projeto);

      prisma.projetoUsuario.findUnique.mockResolvedValue(
        {
          projetoId: projectId,
          usuarioId: memberId,
        },
      );

      prisma.tarefa.create.mockResolvedValue({
        ...tarefa,
        responsavelId: memberId,
      });

      await service.create(projectId, userId, {
        titulo: 'Criar API',
        prioridade: Prioridade.ALTA,
        responsavelId: memberId,
      });

      expect(
        prisma.tarefa.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            responsavelId: memberId,
          }),
        }),
      );
    });

    it('deve impedir criar tarefa com responsável que não pertence ao projeto', async () => {
      prisma.projeto.findUnique
        .mockResolvedValueOnce(projeto)
        .mockResolvedValueOnce(projeto);

      prisma.projetoUsuario.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.create(projectId, userId, {
          titulo: 'Criar API',
          prioridade: Prioridade.ALTA,
          responsavelId: memberId,
        }),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(
        prisma.tarefa.create,
      ).not.toHaveBeenCalled();
    });
  });

  // ==================================================
  // FIND ALL
  // ==================================================

  describe('findAll', () => {
    it('deve listar as tarefas do projeto', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.findMany.mockResolvedValue([
        tarefa,
      ]);

      const result = await service.findAll(
        projectId,
        userId,
      );

      expect(result).toEqual([tarefa]);

      expect(
        prisma.tarefa.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projetoId : projectId,
          },
        }),
      );
    });

    it('deve permitir que membro liste tarefas', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.projetoUsuario.findUnique.mockResolvedValue(
        {
          projetoId : projectId,
          usuarioId: memberId,
        },
      );

      prisma.tarefa.findMany.mockResolvedValue([
        tarefa,
      ]);

      const result = await service.findAll(
        projectId,
        memberId,
      );

      expect(result).toEqual([tarefa]);
    });

    it('deve impedir usuário sem acesso de listar tarefas', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.projetoUsuario.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.findAll(projectId, 999),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(
        prisma.tarefa.findMany,
      ).not.toHaveBeenCalled();
    });
  });

  // ==================================================
  // FIND ONE
  // ==================================================

  describe('findOne', () => {
    it('deve buscar uma tarefa do projeto', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.findFirst.mockResolvedValue(
        tarefa,
      );

      const result = await service.findOne(
        projectId,
        taskId,
        userId,
      );

      expect(result).toEqual(tarefa);

      expect(
        prisma.tarefa.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: taskId,
            projetoId: projectId,
          },
        }),
      );
    });

    it('deve lançar NotFoundException quando tarefa não existir', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.findOne(
          projectId,
          999,
          userId,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ==================================================
  // UPDATE
  // ==================================================

  describe('update', () => {
    it('deve editar os dados da tarefa', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.findFirst.mockResolvedValue(
        tarefa,
      );

      prisma.tarefa.update.mockResolvedValue({
        ...tarefa,
        titulo: 'API atualizada',
        prioridade: Prioridade.MEDIA,
      });

      const result = await service.update(
        projectId,
        taskId,
        userId,
        {
          titulo: 'API atualizada',
          prioridade: Prioridade.MEDIA,
        },
      );

      expect(result.titulo).toBe(
        'API atualizada',
      );

      expect(
        prisma.tarefa.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: taskId,
          },
          data: expect.objectContaining({
            titulo: 'API atualizada',
            prioridade: Prioridade.MEDIA,
          }),
        }),
      );
    });

    it('deve impedir edição por usuário sem acesso ao projeto', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.projetoUsuario.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.update(
          projectId,
          taskId,
          999,
          {
            titulo: 'Tentativa',
          },
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(
        prisma.tarefa.update,
      ).not.toHaveBeenCalled();
    });
  });

  // ==================================================
  // ASSIGN RESPONSIBLE
  // ==================================================

  describe('assignResponsible', () => {
    it('deve atribuir um membro do projeto como responsável da tarefa', async () => {
      prisma.projeto.findUnique
        .mockResolvedValueOnce(projeto)
        .mockResolvedValueOnce(projeto);

      prisma.tarefa.findFirst.mockResolvedValue(
        tarefa,
      );

      prisma.projetoUsuario.findUnique.mockResolvedValue(
        {
          projetoId : projectId,
          usuarioId: memberId,
        },
      );

      prisma.tarefa.update.mockResolvedValue({
        ...tarefa,
        responsavelId: memberId,
      });

      const result =
        await service.assignResponsible(
          projectId,
          taskId,
          userId,
          memberId,
        );

      expect(result.responsavelId).toBe(
        memberId,
      );

      expect(
        prisma.tarefa.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: taskId,
          },
          data: {
            responsavelId: memberId,
          },
        }),
      );
    });

    it('deve impedir atribuir usuário que não pertence ao projeto', async () => {
      prisma.projeto.findUnique
        .mockResolvedValueOnce(projeto)
        .mockResolvedValueOnce(projeto);

      prisma.tarefa.findFirst.mockResolvedValue(
        tarefa,
      );

      prisma.projetoUsuario.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.assignResponsible(
          projectId,
          taskId,
          userId,
          memberId,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(
        prisma.tarefa.update,
      ).not.toHaveBeenCalled();
    });

    it('deve impedir atribuição se a tarefa não existir', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.assignResponsible(
          projectId,
          taskId,
          userId,
          memberId,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(
        prisma.tarefa.update,
      ).not.toHaveBeenCalled();
    });
  });

  // ==================================================
  // REMOVE
  // ==================================================

  describe('remove', () => {
    it('deve permitir responsável do projeto excluir tarefa', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.findFirst.mockResolvedValue(
        tarefa,
      );

      prisma.tarefa.delete.mockResolvedValue(
        tarefa,
      );

      const result = await service.remove(
        projectId,
        taskId,
        userId,
      );

      expect(result).toEqual(tarefa);

      expect(
        prisma.tarefa.delete,
      ).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
      });
    });

    it('deve impedir membro comum de excluir tarefa', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      await expect(
        service.remove(
          projectId,
          taskId,
          memberId,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(
        prisma.tarefa.delete,
      ).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando projeto não existir', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.remove(
          projectId,
          taskId,
          userId,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('deve lançar NotFoundException quando tarefa não existir', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.remove(
          projectId,
          taskId,
          userId,
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ==================================================
  // UPDATE STATUS
  // ==================================================

  describe('updateStatus', () => {
    const mockTaskStatus = (
      status: StatusTarefa,
    ) => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.tarefa.findFirst.mockResolvedValue({
        ...tarefa,
        status,
      });

      prisma.tarefa.update.mockResolvedValue({
        ...tarefa,
        status,
      });
    };

    // -------------------------
    // TRANSIÇÕES VÁLIDAS
    // -------------------------

    it('deve permitir CRIADO → EM_PROGRESSO', async () => {
      mockTaskStatus(StatusTarefa.CRIADO);

      await service.updateStatus(
        projectId,
        taskId,
        userId,
        StatusTarefa.EM_PROGRESSO,
      );

      expect(
        prisma.tarefa.update,
      ).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: StatusTarefa.EM_PROGRESSO,
        },
      });
    });

    it('deve permitir EM_PROGRESSO → EM_REVIEW', async () => {
      mockTaskStatus(
        StatusTarefa.EM_PROGRESSO,
      );

      await service.updateStatus(
        projectId,
        taskId,
        userId,
        StatusTarefa.EM_REVIEW,
      );

      expect(
        prisma.tarefa.update,
      ).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: StatusTarefa.EM_REVIEW,
        },
      });
    });

    it('deve permitir EM_REVIEW → EM_PROGRESSO', async () => {
      mockTaskStatus(StatusTarefa.EM_REVIEW);

      await service.updateStatus(
        projectId,
        taskId,
        userId,
        StatusTarefa.EM_PROGRESSO,
      );

      expect(
        prisma.tarefa.update,
      ).toHaveBeenCalled();
    });

    it('deve permitir responsável do projeto fazer EM_REVIEW → FEITO', async () => {
      mockTaskStatus(StatusTarefa.EM_REVIEW);

      await service.updateStatus(
        projectId,
        taskId,
        userId,
        StatusTarefa.FEITO,
      );

      expect(
        prisma.tarefa.update,
      ).toHaveBeenCalledWith({
        where: {
          id: taskId,
        },
        data: {
          status: StatusTarefa.FEITO,
        },
      });
    });

    it('deve permitir FEITO → EM_REVIEW', async () => {
      mockTaskStatus(StatusTarefa.FEITO);

      await service.updateStatus(
        projectId,
        taskId,
        userId,
        StatusTarefa.EM_REVIEW,
      );

      expect(
        prisma.tarefa.update,
      ).toHaveBeenCalled();
    });

    // -------------------------
    // TRANSIÇÕES INVÁLIDAS
    // -------------------------

    it('deve impedir CRIADO → EM_REVIEW', async () => {
      mockTaskStatus(StatusTarefa.CRIADO);

      await expect(
        service.updateStatus(
          projectId,
          taskId,
          userId,
          StatusTarefa.EM_REVIEW,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.tarefa.update,
      ).not.toHaveBeenCalled();
    });

    it('deve impedir CRIADO → FEITO', async () => {
      mockTaskStatus(StatusTarefa.CRIADO);

      await expect(
        service.updateStatus(
          projectId,
          taskId,
          userId,
          StatusTarefa.FEITO,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.tarefa.update,
      ).not.toHaveBeenCalled();
    });

    it('deve impedir EM_PROGRESSO → FEITO', async () => {
      mockTaskStatus(
        StatusTarefa.EM_PROGRESSO,
      );

      await expect(
        service.updateStatus(
          projectId,
          taskId,
          userId,
          StatusTarefa.FEITO,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prisma.tarefa.update,
      ).not.toHaveBeenCalled();
    });

    it('deve impedir EM_PROGRESSO → CRIADO', async () => {
      mockTaskStatus(
        StatusTarefa.EM_PROGRESSO,
      );

      await expect(
        service.updateStatus(
          projectId,
          taskId,
          userId,
          StatusTarefa.CRIADO,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deve impedir EM_REVIEW → CRIADO', async () => {
      mockTaskStatus(StatusTarefa.EM_REVIEW);

      await expect(
        service.updateStatus(
          projectId,
          taskId,
          userId,
          StatusTarefa.CRIADO,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deve impedir FEITO → EM_PROGRESSO', async () => {
      mockTaskStatus(StatusTarefa.FEITO);

      await expect(
        service.updateStatus(
          projectId,
          taskId,
          userId,
          StatusTarefa.EM_PROGRESSO,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deve impedir FEITO → CRIADO', async () => {
      mockTaskStatus(StatusTarefa.FEITO);

      await expect(
        service.updateStatus(
          projectId,
          taskId,
          userId,
          StatusTarefa.CRIADO,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    // -------------------------
    // MESMO STATUS
    // -------------------------

    it.each([
      StatusTarefa.CRIADO,
      StatusTarefa.EM_PROGRESSO,
      StatusTarefa.EM_REVIEW,
      StatusTarefa.FEITO,
    ])(
      'deve impedir alteração para o mesmo status: %s',
      async (status) => {
        mockTaskStatus(status);

        await expect(
          service.updateStatus(
            projectId,
            taskId,
            userId,
            status,
          ),
        ).rejects.toBeInstanceOf(
          BadRequestException,
        );

        expect(
          prisma.tarefa.update,
        ).not.toHaveBeenCalled();
      },
    );

    // -------------------------
    // PERMISSÃO DE REVIEW
    // -------------------------

    it('deve impedir membro comum de fazer EM_REVIEW → FEITO', async () => {
      prisma.projeto.findUnique
        .mockResolvedValueOnce(projeto)
        .mockResolvedValueOnce(projeto);

      prisma.projetoUsuario.findUnique.mockResolvedValue(
        {
          projetoId: projectId,
          usuarioId: memberId,
        },
      );

      prisma.tarefa.findFirst.mockResolvedValue({
        ...tarefa,
        status: StatusTarefa.EM_REVIEW,
      });

      await expect(
        service.updateStatus(
          projectId,
          taskId,
          memberId,
          StatusTarefa.FEITO,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(
        prisma.tarefa.update,
      ).not.toHaveBeenCalled();
    });

    it('deve impedir usuário sem acesso de alterar status', async () => {
      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      prisma.projetoUsuario.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.updateStatus(
          projectId,
          taskId,
          999,
          StatusTarefa.EM_PROGRESSO,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(
        prisma.tarefa.update,
      ).not.toHaveBeenCalled();
    });
  });
});