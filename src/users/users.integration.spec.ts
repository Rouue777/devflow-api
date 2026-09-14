import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService - integração', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const emailTeste = 'integracao@email.com';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        PrismaService,
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);

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

    await prisma.$disconnect();
  });

  it('deve cadastrar um usuário no banco de dados', async () => {
    // ARRANGE
    const registerDto = {
      nome: 'Jeferson',
      email: emailTeste,
      senha: '123456',
    };

    // ACT
    const result = await service.register(registerDto);

    // ASSERT
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.nome).toBe('Jeferson');
    expect(result.email).toBe(emailTeste);

    const usuarioBanco = await prisma.usuario.findUnique({
      where: {
        email: emailTeste,
      },
    });

    expect(usuarioBanco).not.toBeNull();
    expect(usuarioBanco?.nome).toBe('Jeferson');
    expect(usuarioBanco?.email).toBe(emailTeste);
  });

  it('deve salvar a senha com hash', async () => {
    // ARRANGE
    const senhaOriginal = '123456';

    // ACT
    await service.register({
      nome: 'Jeferson',
      email: emailTeste,
      senha: senhaOriginal,
    });

    // ASSERT
    const usuarioBanco = await prisma.usuario.findUnique({
      where: {
        email: emailTeste,
      },
    });

    expect(usuarioBanco).not.toBeNull();

    expect(usuarioBanco?.senha).not.toBe(senhaOriginal);

    const senhaValida = await bcrypt.compare(
      senhaOriginal,
      usuarioBanco!.senha,
    );

    expect(senhaValida).toBe(true);
  });

  it('deve lançar erro ao tentar cadastrar um e-mail já existente', async () => {
    // ARRANGE
    await service.register({
      nome: 'Jeferson',
      email: emailTeste,
      senha: '123456',
    });

    // ACT + ASSERT
    await expect(
      service.register({
        nome: 'Outro usuário',
        email: emailTeste,
        senha: '654321',
      }),
    ).rejects.toThrow('E-mail já cadastrado');
  });
});