import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcrypt';
import { ConflictException } from '@nestjs/common';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
}));

describe('UsersService - register', () => {
  let service: UsersService;

  const prismaMock = {
    usuario: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new UsersService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('deve cadastrar um usuário com sucesso', async () => {
    // ARRANGE
    const registerDto = {
      nome: 'Jeferson',
      email: 'teste@email.com',
      senha: '123456',
    };

    prismaMock.usuario.findUnique.mockResolvedValue(null);

    vi.mocked(bcrypt.hash).mockResolvedValue(
      'senha-hash' as never,
    );

    const usuarioCriado = {
      id: 1,
      nome: 'Jeferson',
      email: 'teste@email.com',
      dataCadastro: new Date(),
    };

    prismaMock.usuario.create.mockResolvedValue(usuarioCriado);

    // ACT
    const result = await service.register(registerDto);

    // ASSERT
    expect(result).toEqual(usuarioCriado);

    expect(prismaMock.usuario.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'teste@email.com',
      },
    });

    expect(bcrypt.hash).toHaveBeenCalledWith(
      '123456',
      10,
    );

    expect(prismaMock.usuario.create).toHaveBeenCalledWith({
      data: {
        nome: 'Jeferson',
        email: 'teste@email.com',
        senha: 'senha-hash',
      },
      select: {
        id: true,
        nome: true,
        email: true,
        dataCadastro: true,
      },
    });
  });

  it('deve lançar erro se o e-mail já estiver cadastrado', async () => {
    // ARRANGE
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 1,
      nome: 'Jeferson',
      email: 'teste@email.com',
      senha: 'senha-hash',
      dataCadastro: new Date(),
    });

    // ACT + ASSERT
    await expect(
      service.register({
        nome: 'Jeferson',
        email: 'teste@email.com',
        senha: '123456',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(prismaMock.usuario.create).not.toHaveBeenCalled();
  });
});