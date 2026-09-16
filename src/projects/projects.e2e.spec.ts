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
});