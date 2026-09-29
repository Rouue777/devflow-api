import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcrypt';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    usuario: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    service = new UsersService(
      prismaMock as unknown as PrismaService,
    );
  });

  // =========================
  // REGISTER
  // =========================

  describe('register', () => {
    it('deve cadastrar um usuário com sucesso', async () => {
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

      const result = await service.register(registerDto);

      expect(result).toEqual(usuarioCriado);

      expect(prismaMock.usuario.findUnique).toHaveBeenCalledWith({
        where: {
          email: 'teste@email.com',
        },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 10);

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
      prismaMock.usuario.findUnique.mockResolvedValue({
        id: 1,
        nome: 'Jeferson',
        email: 'teste@email.com',
        senha: 'senha-hash',
        dataCadastro: new Date(),
      });

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

  // =========================
  // GET PROFILE
  // =========================

  describe('getProfile', () => {
    it('deve retornar o perfil do usuário sem a senha', async () => {
      const usuario = {
        id: 1,
        nome: 'Jeferson',
        email: 'jeferson@email.com',
        dataCadastro: new Date(),
      };

      prismaMock.usuario.findUnique.mockResolvedValue(usuario);

      const result = await service.getProfile(1);

      expect(prismaMock.usuario.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          nome: true,
          email: true,
          dataCadastro: true,
        },
      });

      expect(result).toEqual(usuario);
      expect(result).not.toHaveProperty('senha');
    });

    it('deve lançar NotFoundException quando o usuário não existir', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.getProfile(999),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // =========================
  // UPDATE PROFILE
  // =========================

  describe('updateProfile', () => {
    it('deve atualizar o nome do usuário', async () => {
      const usuarioAtualizado = {
        id: 1,
        nome: 'Jeferson Santos',
        email: 'jeferson@email.com',
        dataCadastro: new Date(),
      };

      prismaMock.usuario.update.mockResolvedValue(usuarioAtualizado);

      const result = await service.updateProfile(1, {
        nome: 'Jeferson Santos',
      });

      expect(prismaMock.usuario.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          nome: 'Jeferson Santos',
          email: undefined,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          dataCadastro: true,
        },
      });

      expect(result).toEqual(usuarioAtualizado);
      expect(result).not.toHaveProperty('senha');
    });

    it('deve atualizar o email quando ele não estiver em uso', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      const usuarioAtualizado = {
        id: 1,
        nome: 'Jeferson',
        email: 'novo@email.com',
        dataCadastro: new Date(),
      };

      prismaMock.usuario.update.mockResolvedValue(usuarioAtualizado);

      const result = await service.updateProfile(1, {
        email: 'novo@email.com',
      });

      expect(result.email).toBe('novo@email.com');
      expect(result).not.toHaveProperty('senha');
    });

    it('deve permitir manter o próprio email', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({
        id: 1,
        nome: 'Jeferson',
        email: 'jeferson@email.com',
        senha: 'hash',
        dataCadastro: new Date(),
      });

      prismaMock.usuario.update.mockResolvedValue({
        id: 1,
        nome: 'Jeferson Santos',
        email: 'jeferson@email.com',
        dataCadastro: new Date(),
      });

      await expect(
        service.updateProfile(1, {
          nome: 'Jeferson Santos',
          email: 'jeferson@email.com',
        }),
      ).resolves.toBeDefined();
    });

    it('deve lançar ConflictException quando o email pertencer a outro usuário', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({
        id: 2,
        nome: 'Outro usuário',
        email: 'existente@email.com',
        senha: 'hash',
        dataCadastro: new Date(),
      });

      await expect(
        service.updateProfile(1, {
          email: 'existente@email.com',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });
  });
});