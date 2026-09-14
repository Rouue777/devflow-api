import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Auth E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const emailTeste = 'auth.e2e@email.com';

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    // Importante:
    // o app de teste não herda automaticamente
    // os pipes configurados no main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.usuario.deleteMany({
      where: {
        email: emailTeste,
      },
    });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({
      where: {
        email: emailTeste,
      },
    });

    await app.close();
  });


  // ==========================================================
  // LOGIN
  // ==========================================================

  it('deve realizar login e retornar JWT', async () => {
    // ARRANGE
    await request(app.getHttpServer())
      .post('/users/register')
      .send({
        nome: 'Jeferson',
        email: emailTeste,
        senha: '123456',
      })
      .expect(201);

    // ACT
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: emailTeste,
        senha: '123456',
      });

    // ASSERT
    expect(response.status).toBe(201);

    expect(response.body.access_token).toBeDefined();

    expect(typeof response.body.access_token).toBe(
      'string',
    );
  });

  it('deve rejeitar login com senha incorreta', async () => {
    // ARRANGE
    await request(app.getHttpServer())
      .post('/users/register')
      .send({
        nome: 'Jeferson',
        email: emailTeste,
        senha: '123456',
      })
      .expect(201);

    // ACT
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: emailTeste,
        senha: 'senha-errada',
      });

    // ASSERT
    expect(response.status).toBe(401);

    expect(response.body.message).toBe(
      'Credenciais inválidas',
    );
  });

  it('deve rejeitar DTO inválido no login', async () => {
    // ACT
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'email-invalido',
        senha: '',
      });

    // ASSERT
    expect(response.status).toBe(400);
  });
});