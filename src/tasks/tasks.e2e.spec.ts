import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import {
  Prioridade,
  StatusTarefa,
} from '@prisma/client';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Tasks - E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;

  let ownerId: number;
  let memberId: number;
  let outsiderId: number;
  let projectId: number;

  const ownerEmail = 'tasks.owner.e2e@email.com';
  const memberEmail = 'tasks.member.e2e@email.com';
  const outsiderEmail = 'tasks.outsider.e2e@email.com';

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    app.setGlobalPrefix('api/v1');

    await app.init();

    prisma = app.get(PrismaService);
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

    const senhaHash = await bcrypt.hash(
      '123456',
      10,
    );

    // =========================
    // USUÁRIOS
    // =========================

    const owner = await prisma.usuario.create({
      data: {
        nome: 'Owner',
        email: ownerEmail,
        senha: senhaHash,
      },
    });

    const member = await prisma.usuario.create({
      data: {
        nome: 'Member',
        email: memberEmail,
        senha: senhaHash,
      },
    });

    const outsider =
      await prisma.usuario.create({
        data: {
          nome: 'Outsider',
          email: outsiderEmail,
          senha: senhaHash,
        },
      });

    ownerId = owner.id;
    memberId = member.id;
    outsiderId = outsider.id;

    // =========================
    // PROJETO
    // =========================

    const projeto = await prisma.projeto.create({
      data: {
        nome: 'DevFlow Tasks E2E',
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

    // =========================
    // LOGIN
    // =========================

    const ownerLogin = await request(
      app.getHttpServer(),
    )
      .post('/api/v1/auth/login')
      .send({
        email: ownerEmail,
        senha: '123456',
      })
      .expect(201);

    ownerToken = ownerLogin.body.access_token;

    const memberLogin = await request(
      app.getHttpServer(),
    )
      .post('/api/v1/auth/login')
      .send({
        email: memberEmail,
        senha: '123456',
      })
      .expect(201);

    memberToken = memberLogin.body.access_token;

    const outsiderLogin = await request(
      app.getHttpServer(),
    )
      .post('/api/v1/auth/login')
      .send({
        email: outsiderEmail,
        senha: '123456',
      })
      .expect(201);

    outsiderToken =
      outsiderLogin.body.access_token;
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
    }

    if (app) {
      await app.close();
    }
  });

  // ==================================================
  // CREATE
  // ==================================================

  describe('POST /projects/:projectId/tasks', () => {
    it('deve criar uma tarefa', async () => {
      const response = await request(
        app.getHttpServer(),
      )
        .post(
          `/api/v1/projects/${projectId}/tasks`,
        )
        .set(
          'Authorization',
          `Bearer ${ownerToken}`,
        )
        .send({
          titulo: 'Criar API',
          descricao: 'Implementar Tasks',
          prioridade: Prioridade.ALTA,
        })
        .expect(201);

      expect(response.body.titulo).toBe(
        'Criar API',
      );

      expect(response.body.status).toBe(
        StatusTarefa.CRIADO,
      );

      expect(response.body.projetoId).toBe(
        projectId,
      );

      const tarefa =
        await prisma.tarefa.findUnique({
          where: {
            id: response.body.id,
          },
        });

      expect(tarefa).not.toBeNull();
    });

    it('deve permitir membro criar tarefa', async () => {
      const response = await request(
        app.getHttpServer(),
      )
        .post(
          `/api/v1/projects/${projectId}/tasks`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .send({
          titulo: 'Task do membro',
          prioridade: Prioridade.MEDIA,
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('deve impedir usuário fora do projeto de criar tarefa', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/v1/projects/${projectId}/tasks`,
        )
        .set(
          'Authorization',
          `Bearer ${outsiderToken}`,
        )
        .send({
          titulo: 'Sem acesso',
          prioridade: Prioridade.ALTA,
        })
        .expect(403);
    });

    it('deve impedir criação diretamente em FEITO', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/v1/projects/${projectId}/tasks`,
        )
        .set(
          'Authorization',
          `Bearer ${ownerToken}`,
        )
        .send({
          titulo: 'Inválida',
          prioridade: Prioridade.ALTA,
          status: StatusTarefa.FEITO,
        })
        .expect(400);
    });

    it('deve validar o DTO', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/v1/projects/${projectId}/tasks`,
        )
        .set(
          'Authorization',
          `Bearer ${ownerToken}`,
        )
        .send({
          titulo: '',
          prioridade: 'URGENTE',
        })
        .expect(400);
    });

    it('deve exigir autenticação', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/v1/projects/${projectId}/tasks`,
        )
        .send({
          titulo: 'Sem JWT',
          prioridade: Prioridade.ALTA,
        })
        .expect(401);
    });
  });

  // ==================================================
  // FIND ALL / FIND ONE
  // ==================================================

  describe('GET Tasks', () => {
    it('deve listar tarefas do projeto', async () => {
      await prisma.tarefa.create({
        data: {
          titulo: 'Task 1',
          prioridade: Prioridade.ALTA,
          projetoId : projectId,
        },
      });

      await prisma.tarefa.create({
        data: {
          titulo: 'Task 2',
          prioridade: Prioridade.MEDIA,
          projetoId : projectId,
        },
      });

      const response = await request(
        app.getHttpServer(),
      )
        .get(
          `/api/v1/projects/${projectId}/tasks`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('deve buscar uma tarefa específica', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Task específica',
            prioridade: Prioridade.ALTA,
            projetoId : projectId,
          },
        });

      const response = await request(
        app.getHttpServer(),
      )
        .get(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .expect(200);

      expect(response.body.id).toBe(
        tarefa.id,
      );
    });

    it('deve retornar 404 para tarefa inexistente', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/v1/projects/${projectId}/tasks/999999`,
        )
        .set(
          'Authorization',
          `Bearer ${ownerToken}`,
        )
        .expect(404);
    });

    it('deve impedir outsider de listar tarefas', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/v1/projects/${projectId}/tasks`,
        )
        .set(
          'Authorization',
          `Bearer ${outsiderToken}`,
        )
        .expect(403);
    });
  });

  // ==================================================
  // UPDATE
  // ==================================================

  describe('PATCH /tasks/:taskId', () => {
    it('deve editar uma tarefa', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Original',
            prioridade: Prioridade.BAIXA,
            projetoId: projectId,
          },
        });

      const response = await request(
        app.getHttpServer(),
      )
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .send({
          titulo: 'Atualizada',
          prioridade: Prioridade.ALTA,
        })
        .expect(200);

      expect(response.body.titulo).toBe(
        'Atualizada',
      );

      expect(response.body.prioridade).toBe(
        Prioridade.ALTA,
      );
    });

    it('deve impedir outsider de editar tarefa', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Original',
            prioridade: Prioridade.ALTA,
            projetoId : projectId,
          },
        });

      await request(app.getHttpServer())
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}`,
        )
        .set(
          'Authorization',
          `Bearer ${outsiderToken}`,
        )
        .send({
          titulo: 'Tentativa',
        })
        .expect(403);
    });
  });

  // ==================================================
  // RESPONSÁVEL
  // ==================================================

  describe('PATCH responsible', () => {
    it('deve atribuir membro como responsável da tarefa', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Atribuir',
            prioridade: Prioridade.ALTA,
            projetoId : projectId,
          },
        });

      const response = await request(
        app.getHttpServer(),
      )
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}/responsible`,
        )
        .set(
          'Authorization',
          `Bearer ${ownerToken}`,
        )
        .send({
          responsavelId: memberId,
        })
        .expect(200);

      expect(
        response.body.responsavelId,
      ).toBe(memberId);
    });

    it('deve impedir atribuir outsider como responsável', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Atribuir',
            prioridade: Prioridade.ALTA,
            projetoId : projectId,
          },
        });

      await request(app.getHttpServer())
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}/responsible`,
        )
        .set(
          'Authorization',
          `Bearer ${ownerToken}`,
        )
        .send({
          responsavelId: outsiderId,
        })
        .expect(403);
    });
  });

  // ==================================================
  // STATUS / REVIEW
  // ==================================================

  describe('PATCH status', () => {
    it('deve executar CRIADO → EM_PROGRESSO → EM_REVIEW → FEITO', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Workflow',
            prioridade: Prioridade.ALTA,
            projetoId : projectId,
          },
        });

      // CRIADO → EM_PROGRESSO
      await request(app.getHttpServer())
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}/status`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .send({
          status: StatusTarefa.EM_PROGRESSO,
        })
        .expect(200);

      // EM_PROGRESSO → EM_REVIEW
      await request(app.getHttpServer())
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}/status`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .send({
          status: StatusTarefa.EM_REVIEW,
        })
        .expect(200);

      // EM_REVIEW → FEITO
      const response = await request(
        app.getHttpServer(),
      )
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}/status`,
        )
        .set(
          'Authorization',
          `Bearer ${ownerToken}`,
        )
        .send({
          status: StatusTarefa.FEITO,
        })
        .expect(200);

      expect(response.body.status).toBe(
        StatusTarefa.FEITO,
      );
    });

    it('deve impedir membro comum de fazer EM_REVIEW → FEITO', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Review',
            prioridade: Prioridade.ALTA,
            status: StatusTarefa.EM_REVIEW,
            projetoId : projectId,
          },
        });

      await request(app.getHttpServer())
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}/status`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .send({
          status: StatusTarefa.FEITO,
        })
        .expect(403);
    });

    it('deve impedir CRIADO → FEITO', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Pular fluxo',
            prioridade: Prioridade.ALTA,
            projetoId : projectId,
          },
        });

      await request(app.getHttpServer())
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}/status`,
        )
        .set(
          'Authorization',
          `Bearer ${ownerToken}`,
        )
        .send({
          status: StatusTarefa.FEITO,
        })
        .expect(400);
    });

    it('deve permitir EM_REVIEW → EM_PROGRESSO', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Correção',
            prioridade: Prioridade.ALTA,
            status: StatusTarefa.EM_REVIEW,
            projetoId : projectId,
          },
        });

      const response = await request(
        app.getHttpServer(),
      )
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}/status`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .send({
          status: StatusTarefa.EM_PROGRESSO,
        })
        .expect(200);

      expect(response.body.status).toBe(
        StatusTarefa.EM_PROGRESSO,
      );
    });

    it('deve permitir FEITO → EM_REVIEW', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Reabrir',
            prioridade: Prioridade.ALTA,
            status: StatusTarefa.FEITO,
            projetoId : projectId,
          },
        });

      const response = await request(
        app.getHttpServer(),
      )
        .patch(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}/status`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .send({
          status: StatusTarefa.EM_REVIEW,
        })
        .expect(200);

      expect(response.body.status).toBe(
        StatusTarefa.EM_REVIEW,
      );
    });
  });

  // ==================================================
  // DELETE
  // ==================================================

  describe('DELETE task', () => {
    it('deve permitir responsável do projeto excluir tarefa', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Excluir',
            prioridade: Prioridade.ALTA,
            projetoId : projectId,
          },
        });

      await request(app.getHttpServer())
        .delete(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}`,
        )
        .set(
          'Authorization',
          `Bearer ${ownerToken}`,
        )
        .expect(200);

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(tarefaBanco).toBeNull();
    });

    it('deve impedir membro comum de excluir tarefa', async () => {
      const tarefa =
        await prisma.tarefa.create({
          data: {
            titulo: 'Não excluir',
            prioridade: Prioridade.ALTA,
            projetoId : projectId,
          },
        });

      await request(app.getHttpServer())
        .delete(
          `/api/v1/projects/${projectId}/tasks/${tarefa.id}`,
        )
        .set(
          'Authorization',
          `Bearer ${memberToken}`,
        )
        .expect(403);

      const tarefaBanco =
        await prisma.tarefa.findUnique({
          where: {
            id: tarefa.id,
          },
        });

      expect(tarefaBanco).not.toBeNull();
    });
  });
});