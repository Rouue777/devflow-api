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

    const emailTeste = 'users.e2e@email.com';

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
    // REGISTER
    // ==========================================================

    it('deve cadastrar um usuário pela API', async () => {
        // ARRANGE
        const dto = {
            nome: 'Jeferson',
            email: emailTeste,
            senha: '123456',
        };

        // ACT
        const response = await request(app.getHttpServer())
            .post('/users/register')
            .send(dto);

        // ASSERT
        expect(response.status).toBe(201);

        expect(response.body).toMatchObject({
            nome: 'Jeferson',
            email: emailTeste,
        });

        expect(response.body.id).toBeDefined();

        // A senha não deve voltar na resposta
        expect(response.body.senha).toBeUndefined();

        // Confirma no banco real de testes
        const usuario = await prisma.usuario.findUnique({
            where: {
                email: emailTeste,
            },
        });

        expect(usuario).not.toBeNull();
    });

    it('deve rejeitar dados inválidos no cadastro', async () => {
        // ARRANGE
        const dtoInvalido = {
            nome: '',
            email: 'email-invalido',
            senha: '123',
        };

        // ACT
        const response = await request(app.getHttpServer())
            .post('/users/register')
            .send(dtoInvalido);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('deve rejeitar cadastro com e-mail duplicado', async () => {
        // ARRANGE
        const dto = {
            nome: 'Jeferson',
            email: emailTeste,
            senha: '123456',
        };

        await request(app.getHttpServer())
            .post('/users/register')
            .send(dto)
            .expect(201);

        // ACT
        const response = await request(app.getHttpServer())
            .post('/users/register')
            .send(dto);

        // ASSERT
        expect(response.status).toBe(409);

        expect(response.body.message).toBe(
            'E-mail já cadastrado',
        );
    });
})