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

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Projects - E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let token: string;
  let outroToken: string;

  const email = 'projects.e2e@email.com';
  const outroEmail = 'projects.outro.e2e@email.com';

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    // Mesmo ValidationPipe usado pela aplicação
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    // Mesmo prefixo da aplicação
    app.setGlobalPrefix('api/v1');

    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Limpeza
    await prisma.projetoUsuario.deleteMany();
    await prisma.projeto.deleteMany();

    await prisma.usuario.deleteMany({
      where: {
        email: {
          in: [email, outroEmail],
        },
      },
    });

    const senhaHash = await bcrypt.hash('123456', 10);

    await prisma.usuario.create({
      data: {
        nome: 'Jeferson',
        email,
        senha: senhaHash,
      },
    });

    await prisma.usuario.create({
      data: {
        nome: 'Outro usuário',
        email: outroEmail,
        senha: senhaHash,
      },
    });

    // Login real pela API
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        senha: '123456',
      });

    token = login.body.access_token;

    const outroLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: outroEmail,
        senha: '123456',
      });

    outroToken = outroLogin.body.access_token;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.projetoUsuario.deleteMany();
      await prisma.projeto.deleteMany();

      await prisma.usuario.deleteMany({
        where: {
          email: {
            in: [email, outroEmail],
          },
        },
      });
    }

    if (app) {
      await app.close();
    }
  });

  it('deve criar um projeto autenticado', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
        descricao: 'Gerenciador de projetos',
      })
      .expect(201);

    expect(response.body.nome).toBe('DevFlow');
    expect(response.body.responsavelId).toBeDefined();
  });

  it('deve impedir criação sem autenticação', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .send({
        nome: 'DevFlow',
      })
      .expect(401);
  });

  it('deve listar os projetos do usuário', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].nome).toBe('DevFlow');
  });

  it('deve buscar um projeto por ID', async () => {
    const criado = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/projects/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.id).toBe(criado.body.id);
    expect(response.body.nome).toBe('DevFlow');
  });

  it('deve impedir acesso ao projeto por usuário que não participa', async () => {
    const criado = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      });

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${criado.body.id}`)
      .set('Authorization', `Bearer ${outroToken}`)
      .expect(403);
  });

  it('deve permitir que o responsável edite o projeto', async () => {
    const criado = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${criado.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow API',
      })
      .expect(200);

    expect(response.body.nome).toBe('DevFlow API');
  });

  it('deve impedir outro usuário de editar o projeto', async () => {
    const criado = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${criado.body.id}`)
      .set('Authorization', `Bearer ${outroToken}`)
      .send({
        nome: 'Alteração indevida',
      })
      .expect(403);
  });

  describe('Members - E2E', () => {
  it('deve adicionar um usuário existente ao projeto', async () => {
    // Cria projeto com o primeiro usuário
    const projeto = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    // Busca o segundo usuário para obter seu ID
    const outroUsuario = await prisma.usuario.findUnique({
      where: {
        email: outroEmail,
      },
    });

    // Adiciona segundo usuário
    const response = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuarioId: outroUsuario!.id,
      })
      .expect(201);

    expect(response.body.usuarioId).toBe(
      outroUsuario!.id,
    );
  });

  it('deve impedir usuário que não é responsável de adicionar membro', async () => {
    const projeto = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    const usuarioResponsavel =
      await prisma.usuario.findUnique({
        where: {
          email,
        },
      });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${outroToken}`)
      .send({
        usuarioId: usuarioResponsavel!.id,
      })
      .expect(403);
  });

  it('deve impedir adicionar usuário que já é membro', async () => {
    const projeto = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    const outroUsuario = await prisma.usuario.findUnique({
      where: {
        email: outroEmail,
      },
    });

    // Primeira adição
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuarioId: outroUsuario!.id,
      })
      .expect(201);

    // Segunda tentativa
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuarioId: outroUsuario!.id,
      })
      .expect(409);
  });

  it('deve listar os membros do projeto', async () => {
    const projeto = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    const outroUsuario = await prisma.usuario.findUnique({
      where: {
        email: outroEmail,
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuarioId: outroUsuario!.id,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveLength(2);

    const ids = response.body.map(
      (membro: any) => membro.usuario.id,
    );

    expect(ids).toContain(outroUsuario!.id);
  });

  it('deve permitir que um membro visualize os membros do projeto', async () => {
    const projeto = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    const outroUsuario = await prisma.usuario.findUnique({
      where: {
        email: outroEmail,
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuarioId: outroUsuario!.id,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${outroToken}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
  });

  it('deve remover um membro do projeto', async () => {
    const projeto = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    const outroUsuario = await prisma.usuario.findUnique({
      where: {
        email: outroEmail,
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuarioId: outroUsuario!.id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/projects/${projeto.body.id}/members/${outroUsuario!.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Confirma que realmente saiu do banco
    const membroBanco =
      await prisma.projetoUsuario.findUnique({
        where: {
          projetoId_usuarioId: {
            projetoId: projeto.body.id,
            usuarioId: outroUsuario!.id,
          },
        },
      });

    expect(membroBanco).toBeNull();
  });

  it('deve impedir responsável de remover a si próprio', async () => {
    const projeto = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    const responsavel = await prisma.usuario.findUnique({
      where: {
        email,
      },
    });

    await request(app.getHttpServer())
      .delete(
        `/api/v1/projects/${projeto.body.id}/members/${responsavel!.id}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('deve impedir outro membro de remover participantes', async () => {
    const projeto = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    const outroUsuario = await prisma.usuario.findUnique({
      where: {
        email: outroEmail,
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projeto.body.id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        usuarioId: outroUsuario!.id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/projects/${projeto.body.id}/members/${outroUsuario!.id}`,
      )
      .set('Authorization', `Bearer ${outroToken}`)
      .expect(403);
  });

  it('deve exigir autenticação para acessar membros', async () => {
    const projeto = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'DevFlow',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projeto.body.id}/members`)
      .expect(401);
  });
});
});