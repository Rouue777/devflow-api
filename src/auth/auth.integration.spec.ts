import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService - integração', () => {
  let authService: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const emailTeste = 'login.integracao@email.com';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: process.env.JWT_SECRET_TEST,
          signOptions: {
            expiresIn: '1h',
          },
        }),
      ],

      providers: [
        AuthService,
        UsersService,
        PrismaService,
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    await prisma.$connect();
  });

  beforeEach(async () => {
    // Limpa usuário anterior
    await prisma.usuario.deleteMany({
      where: {
        email: emailTeste,
      },
    });

    // Cria usuário real para o teste
    const senhaHash = await bcrypt.hash('123456', 10);

    await prisma.usuario.create({
      data: {
        nome: 'Jeferson',
        email: emailTeste,
        senha: senhaHash,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.usuario.deleteMany({
        where: {
          email: emailTeste,
        },
      });

      await prisma.$disconnect();
    }
  });

  it('deve realizar login com senha correta e retornar JWT', async () => {
    // ARRANGE
    const loginDto = {
      email: emailTeste,
      senha: '123456',
    };

    // ACT
    const result = await authService.login(loginDto);

    // ASSERT
    expect(result).toBeDefined();

    expect(result.access_token).toBeDefined();

    expect(typeof result.access_token).toBe('string');

    const payload = await jwtService.verifyAsync(
      result.access_token,
    );

    expect(payload.email).toBe(emailTeste);
    expect(payload.sub).toBeDefined();
  });

  it('deve lançar erro quando a senha estiver incorreta', async () => {
    // ARRANGE
    const loginDto = {
      email: emailTeste,
      senha: 'senha-errada',
    };

    // ACT + ASSERT
    await expect(
      authService.login(loginDto),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deve lançar erro quando o usuário não existir', async () => {
    // ARRANGE
    const loginDto = {
      email: 'naoexiste@email.com',
      senha: '123456',
    };

    // ACT + ASSERT
    await expect(
      authService.login(loginDto),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});