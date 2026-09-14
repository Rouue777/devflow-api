import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    buscarPorEmail: vi.fn(),
  };

  const jwtServiceMock = {
    signAsync: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    vi.clearAllMocks();
  });

// teste de login sucesso 
  it('deve retornar um token quando as credenciais forem válidas', async () => {
    const user = {
      id: 1,
      nome: 'Jeferson',
      email: 'teste@email.com',
      senha: 'senha-hash',
      dataCadastro: new Date(),
    };

    usersServiceMock.buscarPorEmail.mockResolvedValue(user);

    vi.mocked(bcrypt.compare).mockResolvedValue(true);

    jwtServiceMock.signAsync.mockResolvedValue('token-falso');

    const result = await service.login({
      email: 'teste@email.com',
      senha: '123456',
    });

    expect(result).toEqual({
      access_token: 'token-falso',
    });

    expect(usersServiceMock.buscarPorEmail).toHaveBeenCalledWith(
  'teste@email.com',
);

expect(bcrypt.compare).toHaveBeenCalledWith(
  '123456',
  'senha-hash',
);

expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
  sub: 1,
  email: 'teste@email.com',
});
  });
  

  /// teste de  email inextente
  it('deve lançar erro quando o usuário não existir', async () => {
  // ARRANGE
  usersServiceMock.buscarPorEmail.mockResolvedValue(null);

  // ACT + ASSERT
  await expect(
    service.login({
      email: 'naoexiste@email.com',
      senha: '123456',
    }),
  ).rejects.toThrow('Credenciais inválidas');
});

//teste de senha 
it('deve lançar erro quando a senha for inválida', async () => {
  // ARRANGE
  const user = {
    id: 1,
    nome: 'Jeferson',
    email: 'teste@email.com',
    senha: 'senha-hash',
    dataCadastro: new Date(),
  };

  usersServiceMock.buscarPorEmail.mockResolvedValue(user);

  vi.mocked(bcrypt.compare).mockResolvedValue(false);

  // ACT + ASSERT
  await expect(
    service.login({
      email: 'teste@email.com',
      senha: 'senha-errada',
    }),
  ).rejects.toThrow('Credenciais inválidas');
});
});