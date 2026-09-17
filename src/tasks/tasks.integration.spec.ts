import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prioridade,
  StatusTarefa,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

describe('TasksService - integração', () => {
  let service: TasksService;
  let prisma: PrismaService;

  let userId: number;
  let memberId: number;
  let outsiderId: number;
  let projectId: number;

  const ownerEmail = 'tasks.owner.integration@email.com';
  const memberEmail = 'tasks.member.integration@email.com';
  const outsiderEmail = 'tasks.outsider.integration@email.com';

  beforeAll(async () => {
    prisma = new PrismaService();
    service = new TasksService(prisma);

    await prisma.$connect();
  });

  beforeEach(async () => {
    // Limpeza
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

    const senha = await bcrypt.hash(
      '123456',
      10,
    );

    // Responsável pelo projeto
    const owner = await prisma.usuario.create({
      data: {
        nome: 'Owner',
        email: ownerEmail,
        senha,
      },
    });

    // Membro do projeto
    const member = await prisma.usuario.create({
      data: {
        nome: 'Member',
        email: memberEmail,
        senha,
      },
    });

    // Usuário que não pertence ao projeto
    const outsider =
      await prisma.usuario.create({
        data: {
          nome: 'Outsider',
          email: outsiderEmail,
          senha,
        },
      });

    userId = owner.id;
    memberId = member.id;
    outsiderId = outsider.id;

    // Projeto
    const projeto = await prisma.projeto.create({
      data: {
        nome: 'DevFlow Tasks',
        responsavelId: userId,

        membros: {
          create: [
            {
              usuarioId: userId,
            },
            {
              usuarioId: memberId,
            },
          ],
        },
      },
    });

    projectId = projeto.id;
  });

  afterAll(async () => {
    if (prisma) {
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
    }
  });

  // ==================================================
  // CREATE
  // ==================================================

  describe('create', () => {
    it('deve criar uma tarefa no banco', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Criar API',
          descricao: 'Implementar Tasks',
          prioridade: Prioridade.ALTA,
        },
      );

      expect(tarefa.id).toBeDefined();
      expect(tarefa.titulo).toBe('Criar API');
      expect(tarefa.status).toBe(
        StatusTarefa.CRIADO,
      );
      expect(tarefa.projetoId).toBe(projectId);

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(tarefaBanco).not.toBeNull();
      expect(tarefaBanco?.titulo).toBe(
        'Criar API',
      );
    });

    it('deve permitir criar tarefa em EM_PROGRESSO', async () => {
      const tarefa = await service.create(
        projectId,
        memberId,
        {
          titulo: 'Tarefa iniciada',
          prioridade: Prioridade.MEDIA,
          status: StatusTarefa.EM_PROGRESSO,
        },
      );

      expect(tarefa.status).toBe(
        StatusTarefa.EM_PROGRESSO,
      );
    });

    it('deve impedir criação diretamente em FEITO', async () => {
      await expect(
        service.create(projectId, userId, {
          titulo: 'Tarefa inválida',
          prioridade: Prioridade.BAIXA,
          status: StatusTarefa.FEITO,
        }),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      const quantidade =
        await prisma.tarefa.count();

      expect(quantidade).toBe(0);
    });

    it('deve impedir usuário fora do projeto de criar tarefa', async () => {
      await expect(
        service.create(
          projectId,
          outsiderId,
          {
            titulo: 'Sem acesso',
            prioridade: Prioridade.MEDIA,
          },
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('deve criar tarefa atribuída a um membro do projeto', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Tarefa atribuída',
          prioridade: Prioridade.ALTA,
          responsavelId: memberId,
        },
      );

      expect(tarefa.responsavelId).toBe(
        memberId,
      );

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(
        tarefaBanco?.responsavelId,
      ).toBe(memberId);
    });

    it('deve impedir atribuição inicial para usuário fora do projeto', async () => {
      await expect(
        service.create(projectId, userId, {
          titulo: 'Tarefa inválida',
          prioridade: Prioridade.ALTA,
          responsavelId: outsiderId,
        }),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ==================================================
  // FIND ALL / FIND ONE
  // ==================================================

  describe('consultas', () => {
    it('deve listar somente tarefas do projeto', async () => {
      await service.create(
        projectId,
        userId,
        {
          titulo: 'Task 1',
          prioridade: Prioridade.ALTA,
        },
      );

      await service.create(
        projectId,
        userId,
        {
          titulo: 'Task 2',
          prioridade: Prioridade.MEDIA,
        },
      );

      const tarefas = await service.findAll(
        projectId,
        memberId,
      );

      expect(tarefas).toHaveLength(2);

      expect(
        tarefas.every(
          (tarefa) =>
            tarefa.projetoId === projectId,
        ),
      ).toBe(true);
    });

    it('deve buscar uma tarefa específica', async () => {
      const criada = await service.create(
        projectId,
        userId,
        {
          titulo: 'Task específica',
          prioridade: Prioridade.ALTA,
        },
      );

      const tarefa = await service.findOne(
        projectId,
        criada.id,
        memberId,
      );

      expect(tarefa.id).toBe(criada.id);
      expect(tarefa.titulo).toBe(
        'Task específica',
      );
    });

    it('deve impedir usuário fora do projeto de listar tarefas', async () => {
      await expect(
        service.findAll(
          projectId,
          outsiderId,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('deve lançar erro ao buscar tarefa inexistente', async () => {
      await expect(
        service.findOne(
          projectId,
          999999,
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
    it('deve editar uma tarefa no banco', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Título original',
          prioridade: Prioridade.BAIXA,
        },
      );

      await service.update(
        projectId,
        tarefa.id,
        memberId,
        {
          titulo: 'Título atualizado',
          prioridade: Prioridade.ALTA,
        },
      );

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(tarefaBanco?.titulo).toBe(
        'Título atualizado',
      );

      expect(tarefaBanco?.prioridade).toBe(
        Prioridade.ALTA,
      );
    });

    it('deve impedir usuário fora do projeto de editar tarefa', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Task',
          prioridade: Prioridade.MEDIA,
        },
      );

      await expect(
        service.update(
          projectId,
          tarefa.id,
          outsiderId,
          {
            titulo: 'Tentativa',
          },
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ==================================================
  // ASSIGN RESPONSIBLE
  // ==================================================

  describe('assignResponsible', () => {
    it('deve atribuir um membro como responsável', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Task',
          prioridade: Prioridade.ALTA,
        },
      );

      await service.assignResponsible(
        projectId,
        tarefa.id,
        userId,
        memberId,
      );

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(
        tarefaBanco?.responsavelId,
      ).toBe(memberId);
    });

    it('deve impedir atribuir usuário fora do projeto', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Task',
          prioridade: Prioridade.ALTA,
        },
      );

      await expect(
        service.assignResponsible(
          projectId,
          tarefa.id,
          userId,
          outsiderId,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ==================================================
  // REMOVE
  // ==================================================

  describe('remove', () => {
    it('deve permitir responsável do projeto excluir tarefa', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Excluir',
          prioridade: Prioridade.BAIXA,
        },
      );

      await service.remove(
        projectId,
        tarefa.id,
        userId,
      );

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(tarefaBanco).toBeNull();
    });

    it('deve impedir membro comum de excluir tarefa', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Não excluir',
          prioridade: Prioridade.ALTA,
        },
      );

      await expect(
        service.remove(
          projectId,
          tarefa.id,
          memberId,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(tarefaBanco).not.toBeNull();
    });
  });

  // ==================================================
  // WORKFLOW / REVIEW
  // ==================================================

  describe('updateStatus', () => {
    it('deve executar o fluxo CRIADO → EM_PROGRESSO → EM_REVIEW → FEITO', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Workflow',
          prioridade: Prioridade.ALTA,
        },
      );

      const emProgresso =
        await service.updateStatus(
          projectId,
          tarefa.id,
          memberId,
          StatusTarefa.EM_PROGRESSO,
        );

      expect(emProgresso.status).toBe(
        StatusTarefa.EM_PROGRESSO,
      );

      const emReview =
        await service.updateStatus(
          projectId,
          tarefa.id,
          memberId,
          StatusTarefa.EM_REVIEW,
        );

      expect(emReview.status).toBe(
        StatusTarefa.EM_REVIEW,
      );

      const feito =
        await service.updateStatus(
          projectId,
          tarefa.id,
          userId,
          StatusTarefa.FEITO,
        );

      expect(feito.status).toBe(
        StatusTarefa.FEITO,
      );

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(tarefaBanco?.status).toBe(
        StatusTarefa.FEITO,
      );
    });

    it('deve permitir EM_REVIEW → EM_PROGRESSO', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Correção',
          prioridade: Prioridade.ALTA,
          status: StatusTarefa.EM_PROGRESSO,
        },
      );

      await service.updateStatus(
        projectId,
        tarefa.id,
        memberId,
        StatusTarefa.EM_REVIEW,
      );

      const resultado =
        await service.updateStatus(
          projectId,
          tarefa.id,
          memberId,
          StatusTarefa.EM_PROGRESSO,
        );

      expect(resultado.status).toBe(
        StatusTarefa.EM_PROGRESSO,
      );
    });

    it('deve permitir FEITO → EM_REVIEW', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Reabrir',
          prioridade: Prioridade.ALTA,
          status: StatusTarefa.EM_PROGRESSO,
        },
      );

      await service.updateStatus(
        projectId,
        tarefa.id,
        memberId,
        StatusTarefa.EM_REVIEW,
      );

      await service.updateStatus(
        projectId,
        tarefa.id,
        userId,
        StatusTarefa.FEITO,
      );

      const reaberta =
        await service.updateStatus(
          projectId,
          tarefa.id,
          memberId,
          StatusTarefa.EM_REVIEW,
        );

      expect(reaberta.status).toBe(
        StatusTarefa.EM_REVIEW,
      );
    });

    it('deve impedir CRIADO → FEITO', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Pular fluxo',
          prioridade: Prioridade.ALTA,
        },
      );

      await expect(
        service.updateStatus(
          projectId,
          tarefa.id,
          userId,
          StatusTarefa.FEITO,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(tarefaBanco?.status).toBe(
        StatusTarefa.CRIADO,
      );
    });

    it('deve impedir EM_PROGRESSO → FEITO', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Pular review',
          prioridade: Prioridade.ALTA,
          status: StatusTarefa.EM_PROGRESSO,
        },
      );

      await expect(
        service.updateStatus(
          projectId,
          tarefa.id,
          userId,
          StatusTarefa.FEITO,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deve impedir membro comum de fazer EM_REVIEW → FEITO', async () => {
      const tarefa = await service.create(
        projectId,
        userId,
        {
          titulo: 'Aprovação',
          prioridade: Prioridade.ALTA,
          status: StatusTarefa.EM_PROGRESSO,
        },
      );

      await service.updateStatus(
        projectId,
        tarefa.id,
        memberId,
        StatusTarefa.EM_REVIEW,
      );

      await expect(
        service.updateStatus(
          projectId,
          tarefa.id,
          memberId,
          StatusTarefa.FEITO,
        ),
      ).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(tarefaBanco?.status).toBe(
        StatusTarefa.EM_REVIEW,
      );
    });
  });
});