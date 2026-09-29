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

describe('Users E2E', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    const emailTeste = 'users.e2e@email.com';
    const segundoEmail = 'users2.e2e@email.com';
    const novoEmail = 'users.novo.e2e@email.com';

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

        await app.init();

        prisma = app.get(PrismaService);

        await prisma.$connect();
    });

    beforeEach(async () => {
        await prisma.usuario.deleteMany({
            where: {
                email: {
                    in: [
                        emailTeste,
                        segundoEmail,
                        novoEmail,
                    ],
                },
            },
        });
    });

    afterAll(async () => {
        await prisma.usuario.deleteMany({
            where: {
                email: {
                    in: [
                        emailTeste,
                        segundoEmail,
                        novoEmail,
                    ],
                },
            },
        });

        await app.close();
    });

    // ==========================================================
    // REGISTER
    // ==========================================================

    it('deve cadastrar um usuário pela API', async () => {
        const dto = {
            nome: 'Jeferson',
            email: emailTeste,
            senha: '123456',
        };

        const response = await request(app.getHttpServer())
            .post('/users/register')
            .send(dto);

        expect(response.status).toBe(201);

        expect(response.body).toMatchObject({
            nome: 'Jeferson',
            email: emailTeste,
        });

        expect(response.body.id).toBeDefined();
        expect(response.body.senha).toBeUndefined();

        const usuario = await prisma.usuario.findUnique({
            where: {
                email: emailTeste,
            },
        });

        expect(usuario).not.toBeNull();
    });

    it('deve rejeitar dados inválidos no cadastro', async () => {
        const dtoInvalido = {
            nome: '',
            email: 'email-invalido',
            senha: '123',
        };

        const response = await request(app.getHttpServer())
            .post('/users/register')
            .send(dtoInvalido);

        expect(response.status).toBe(400);
    });

    it('deve rejeitar cadastro com e-mail duplicado', async () => {
        const dto = {
            nome: 'Jeferson',
            email: emailTeste,
            senha: '123456',
        };

        await request(app.getHttpServer())
            .post('/users/register')
            .send(dto)
            .expect(201);

        const response = await request(app.getHttpServer())
            .post('/users/register')
            .send(dto);

        expect(response.status).toBe(409);

        expect(response.body.message).toBe(
            'E-mail já cadastrado',
        );
    });

    // ==========================================================
    // GET PROFILE
    // ==========================================================

    it('GET /users/me deve exigir autenticação', async () => {
        await request(app.getHttpServer())
            .get('/users/me')
            .expect(401);
    });

    it('GET /users/me deve retornar o usuário autenticado sem senha', async () => {
        const token = await criarUsuarioEObterToken();

        const response = await request(app.getHttpServer())
            .get('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.nome).toBe('Jeferson');
        expect(response.body.email).toBe(emailTeste);
        expect(response.body.id).toBeDefined();

        expect(response.body).not.toHaveProperty('senha');
    });

    // ==========================================================
    // UPDATE PROFILE
    // ==========================================================

    it('PATCH /users/me deve atualizar o perfil', async () => {
        const token = await criarUsuarioEObterToken();

        const response = await request(app.getHttpServer())
            .patch('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({
                nome: 'Jeferson Santos',
                email: novoEmail,
            })
            .expect(200);

        expect(response.body.nome).toBe('Jeferson Santos');
        expect(response.body.email).toBe(novoEmail);
        expect(response.body).not.toHaveProperty('senha');

        // Confirma persistência no banco
        const usuarioBanco = await prisma.usuario.findUnique({
            where: {
                email: novoEmail,
            },
        });

        expect(usuarioBanco).not.toBeNull();
        expect(usuarioBanco?.nome).toBe('Jeferson Santos');
    });

    it('PATCH /users/me deve rejeitar email inválido', async () => {
        const token = await criarUsuarioEObterToken();

        await request(app.getHttpServer())
            .patch('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'email-invalido',
            })
            .expect(400);
    });

    it('PATCH /users/me deve retornar 409 para email duplicado', async () => {
        const token = await criarUsuarioEObterToken();

        // Segundo usuário
        await request(app.getHttpServer())
            .post('/users/register')
            .send({
                nome: 'Segundo usuário',
                email: segundoEmail,
                senha: '123456',
            })
            .expect(201);

        const response = await request(app.getHttpServer())
            .patch('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: segundoEmail,
            });

        expect(response.status).toBe(409);
        expect(response.body.message).toBe(
            'E-mail já está em uso',
        );
    });

    it('PATCH /users/me deve exigir autenticação', async () => {
        await request(app.getHttpServer())
            .patch('/users/me')
            .send({
                nome: 'Jeferson Santos',
            })
            .expect(401);
    });

    // ==========================================================
    // HELPER
    // ==========================================================

    async function criarUsuarioEObterToken(): Promise<string> {
        await request(app.getHttpServer())
            .post('/users/register')
            .send({
                nome: 'Jeferson',
                email: emailTeste,
                senha: '123456',
            })
            .expect(201);

        const login = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: emailTeste,
                senha: '123456',
            })
            .expect(201);

        return login.body.access_token;
    }
});