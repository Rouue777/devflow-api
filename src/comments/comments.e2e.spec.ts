import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import {
  Test,
  TestingModule,
} from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

import { Prioridade } from '@prisma/client';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Comments - E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;

  let ownerId: number;
  let memberId: number;
  let projectId: number;
  let taskId: number;

  const ownerEmail = 'comments.owner.e2e@email.com';
  const memberEmail = 'comments.member.e2e@email.com';
  const outsiderEmail = 'comments.outsider.e2e@email.com';

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
    // ==================================================
    // LIMPEZA
    // ==================================================

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

    // ==================================================
    // USUÁRIOS
    // ==================================================

    const senhaHash = await bcrypt.hash(
      '123456',
      10,
    );

    const owner = await prisma.usuario.create({
      data: {
        nome: 'Comments Owner E2E',
        email: ownerEmail,
        senha: senhaHash,
      },
    });

    const member = await prisma.usuario.create({
      data: {
        nome: 'Comments Member E2E',
        email: memberEmail,
        senha: senhaHash,
      },
    });

    const outsider = await prisma.usuario.create({
      data: {
        nome: 'Comments Outsider E2E',
        email: outsiderEmail,
        senha: senhaHash,
      },
    });

    ownerId = owner.id;
    memberId = member.id;

    // ==================================================
    // PROJETO
    // ==================================================

    const projeto = await prisma.projeto.create({
      data: {
        nome: 'Projeto Comments E2E',
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

    // ==================================================
    // TAREFA
    // ==================================================

    const tarefa = await prisma.tarefa.create({
      data: {
        titulo: 'Implementar Comments E2E',
        prioridade: Prioridade.MEDIA,
        projetoId : projectId,
        responsavelId: memberId,
      },
    });

    taskId = tarefa.id;

    // ==================================================
    // LOGIN / JWT
    // ==================================================

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
  // POST
  // ==================================================

  describe(
    'POST /projects/:projectId/tasks/:taskId/comments',
    () => {
      it('deve criar comentário via HTTP', async () => {
        const response = await request(
          app.getHttpServer(),
        )
          .post(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .send({
            conteudo:
              'Comentário criado via E2E',
          })
          .expect(201);

        expect(response.body.id).toBeDefined();

        expect(response.body.conteudo).toBe(
          'Comentário criado via E2E',
        );

        expect(response.body.tarefaId).toBe(
          taskId,
        );

        expect(response.body.usuarioId).toBe(
          ownerId,
        );

        expect(response.body.usuario).toEqual(
          expect.objectContaining({
            id: ownerId,
            email: ownerEmail,
          }),
        );

        // Confirma persistência real
        const comentario =
          await prisma.comentario.findUnique({
            where: {
              id: response.body.id,
            },
          });

        expect(comentario).not.toBeNull();

        expect(comentario?.conteudo).toBe(
          'Comentário criado via E2E',
        );
      });

      it('deve permitir membro criar comentário', async () => {
        const response = await request(
          app.getHttpServer(),
        )
          .post(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${memberToken}`,
          )
          .send({
            conteudo:
              'Comentário do membro',
          })
          .expect(201);

        expect(response.body.usuarioId).toBe(
          memberId,
        );
      });

      it('deve impedir usuário fora do projeto de criar comentário', async () => {
        await request(app.getHttpServer())
          .post(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${outsiderToken}`,
          )
          .send({
            conteudo:
              'Não deveria ser criado',
          })
          .expect(403);

        const comentarios =
          await prisma.comentario.findMany();

        expect(comentarios).toHaveLength(0);
      });

      it('deve exigir autenticação', async () => {
        await request(app.getHttpServer())
          .post(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .send({
            conteudo: 'Sem JWT',
          })
          .expect(401);
      });

      it('deve rejeitar conteúdo vazio', async () => {
        await request(app.getHttpServer())
          .post(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .send({
            conteudo: '',
          })
          .expect(400);
      });

      it('deve rejeitar conteúdo que não seja string', async () => {
        await request(app.getHttpServer())
          .post(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .send({
            conteudo: 123,
          })
          .expect(400);
      });

      it('deve rejeitar conteúdo acima de 2000 caracteres', async () => {
        await request(app.getHttpServer())
          .post(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .send({
            conteudo: 'a'.repeat(2001),
          })
          .expect(400);
      });

      it('deve retornar 404 para tarefa inexistente', async () => {
        await request(app.getHttpServer())
          .post(
            `/api/v1/projects/${projectId}/tasks/999999/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .send({
            conteudo: 'Teste',
          })
          .expect(404);
      });
    },
  );

  // ==================================================
  // GET
  // ==================================================

  describe(
    'GET /projects/:projectId/tasks/:taskId/comments',
    () => {
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

        const response = await request(
          app.getHttpServer(),
        )
          .get(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${memberToken}`,
          )
          .expect(200);

        expect(response.body).toHaveLength(2);

        expect(
          response.body[0].conteudo,
        ).toBe('Primeiro comentário');

        expect(
          response.body[1].conteudo,
        ).toBe('Segundo comentário');
      });

      it('deve retornar lista vazia quando não houver comentários', async () => {
        const response = await request(
          app.getHttpServer(),
        )
          .get(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .expect(200);

        expect(response.body).toEqual([]);
      });

      it('deve impedir outsider de listar comentários', async () => {
        await request(app.getHttpServer())
          .get(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${outsiderToken}`,
          )
          .expect(403);
      });

      it('deve exigir autenticação para listar', async () => {
        await request(app.getHttpServer())
          .get(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .expect(401);
      });

      it('deve listar somente comentários da tarefa informada', async () => {
        const outraTarefa =
          await prisma.tarefa.create({
            data: {
              titulo: 'Outra tarefa',
              prioridade: Prioridade.BAIXA,
              projetoId : projectId,
            },
          });

        await prisma.comentario.create({
          data: {
            conteudo:
              'Comentário tarefa principal',
            tarefaId: taskId,
            usuarioId: ownerId,
          },
        });

        await prisma.comentario.create({
          data: {
            conteudo:
              'Comentário outra tarefa',
            tarefaId: outraTarefa.id,
            usuarioId: ownerId,
          },
        });

        const response = await request(
          app.getHttpServer(),
        )
          .get(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .expect(200);

        expect(response.body).toHaveLength(1);

        expect(
          response.body[0].conteudo,
        ).toBe(
          'Comentário tarefa principal',
        );
      });
    },
  );

  // ==================================================
  // DELETE
  // ==================================================

  describe(
    'DELETE /projects/:projectId/tasks/:taskId/comments/:commentId',
    () => {
      it('deve permitir autor excluir seu próprio comentário', async () => {
        const comentario =
          await prisma.comentario.create({
            data: {
              conteudo:
                'Comentário para excluir',
              tarefaId: taskId,
              usuarioId: memberId,
            },
          });

        await request(app.getHttpServer())
          .delete(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments/${comentario.id}`,
          )
          .set(
            'Authorization',
            `Bearer ${memberToken}`,
          )
          .expect(200);

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
              conteudo:
                'Comentário do membro',
              tarefaId: taskId,
              usuarioId: memberId,
            },
          });

        await request(app.getHttpServer())
          .delete(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments/${comentario.id}`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .expect(403);

        const comentarioBanco =
          await prisma.comentario.findUnique({
            where: {
              id: comentario.id,
            },
          });

        expect(comentarioBanco).not.toBeNull();
      });

      it('deve impedir outsider de excluir comentário', async () => {
        const comentario =
          await prisma.comentario.create({
            data: {
              conteudo:
                'Comentário protegido',
              tarefaId: taskId,
              usuarioId: memberId,
            },
          });

        await request(app.getHttpServer())
          .delete(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments/${comentario.id}`,
          )
          .set(
            'Authorization',
            `Bearer ${outsiderToken}`,
          )
          .expect(403);

        const comentarioBanco =
          await prisma.comentario.findUnique({
            where: {
              id: comentario.id,
            },
          });

        expect(comentarioBanco).not.toBeNull();
      });

      it('deve retornar 404 para comentário inexistente', async () => {
        await request(app.getHttpServer())
          .delete(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments/999999`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .expect(404);
      });

      it('deve exigir autenticação para excluir', async () => {
        const comentario =
          await prisma.comentario.create({
            data: {
              conteudo:
                'Comentário protegido',
              tarefaId: taskId,
              usuarioId: ownerId,
            },
          });

        await request(app.getHttpServer())
          .delete(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments/${comentario.id}`,
          )
          .expect(401);
      });

      it('deve impedir excluir comentário de outra tarefa', async () => {
        const outraTarefa =
          await prisma.tarefa.create({
            data: {
              titulo: 'Outra tarefa',
              prioridade: Prioridade.MEDIA,
              projetoId :projectId,
            },
          });

        const comentario =
          await prisma.comentario.create({
            data: {
              conteudo:
                'Comentário da outra tarefa',
              tarefaId: outraTarefa.id,
              usuarioId: ownerId,
            },
          });

        await request(app.getHttpServer())
          .delete(
            `/api/v1/projects/${projectId}/tasks/${taskId}/comments/${comentario.id}`,
          )
          .set(
            'Authorization',
            `Bearer ${ownerToken}`,
          )
          .expect(404);

        const comentarioBanco =
          await prisma.comentario.findUnique({
            where: {
              id: comentario.id,
            },
          });

        expect(comentarioBanco).not.toBeNull();
      });
    },
  );
});