import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService - integração', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const emailTeste = 'integracao@email.com';
  const emailNovo = 'novo@email.com';
  const emailExistente = 'existente@email.com';

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
        email: {
          in: [emailTeste, emailNovo, emailExistente],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({
      where: {
        email: {
          in: [emailTeste, emailNovo, emailExistente],
        },
      },
    });

    await prisma.$disconnect();
  });

  // =========================
  // REGISTER
  // =========================

  describe('register', () => {
    it('deve cadastrar um usuário no banco de dados', async () => {
      const registerDto = {
        nome: 'Jeferson',
        email: emailTeste,
        senha: '123456',
      };

      const result = await service.register(registerDto);

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
      const senhaOriginal = '123456';

      await service.register({
        nome: 'Jeferson',
        email: emailTeste,
        senha: senhaOriginal,
      });

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
      await service.register({
        nome: 'Jeferson',
        email: emailTeste,
        senha: '123456',
      });

      await expect(
        service.register({
          nome: 'Outro usuário',
          email: emailTeste,
          senha: '654321',
        }),
      ).rejects.toThrow('E-mail já cadastrado');
    });
  });

  // =========================
  // GET PROFILE
  // =========================

  describe('getProfile', () => {
    it('deve buscar o perfil sem retornar a senha', async () => {
      const usuario = await prisma.usuario.create({
        data: {
          nome: 'Jeferson',
          email: emailTeste,
          senha: await bcrypt.hash('123456', 10),
        },
      });

      const result = await service.getProfile(usuario.id);

      expect(result.id).toBe(usuario.id);
      expect(result.nome).toBe('Jeferson');
      expect(result.email).toBe(emailTeste);
      expect(result).not.toHaveProperty('senha');
    });

    it('deve lançar NotFoundException para usuário inexistente', async () => {
      await expect(
        service.getProfile(999999),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // =========================
  // UPDATE PROFILE
  // =========================

  describe('updateProfile', () => {
    it('deve atualizar nome e email no banco', async () => {
      const usuario = await prisma.usuario.create({
        data: {
          nome: 'Jeferson',
          email: emailTeste,
          senha: await bcrypt.hash('123456', 10),
        },
      });

      const result = await service.updateProfile(usuario.id, {
        nome: 'Jeferson Santos',
        email: emailNovo,
      });

      expect(result.nome).toBe('Jeferson Santos');
      expect(result.email).toBe(emailNovo);
      expect(result).not.toHaveProperty('senha');

      // Confirma que realmente persistiu no PostgreSQL
      const usuarioBanco = await prisma.usuario.findUnique({
        where: {
          id: usuario.id,
        },
      });

      expect(usuarioBanco?.nome).toBe('Jeferson Santos');
      expect(usuarioBanco?.email).toBe(emailNovo);
    });

    it('deve permitir manter o próprio email', async () => {
      const usuario = await prisma.usuario.create({
        data: {
          nome: 'Jeferson',
          email: emailTeste,
          senha: 'hash',
        },
      });

      const result = await service.updateProfile(usuario.id, {
        nome: 'Jeferson Santos',
        email: emailTeste,
      });

      expect(result.nome).toBe('Jeferson Santos');
      expect(result.email).toBe(emailTeste);
    });

    it('deve impedir o uso do email de outro usuário', async () => {
      const usuario = await prisma.usuario.create({
        data: {
          nome: 'Jeferson',
          email: emailTeste,
          senha: 'hash',
        },
      });

      await prisma.usuario.create({
        data: {
          nome: 'Outro usuário',
          email: emailExistente,
          senha: 'hash',
        },
      });

      await expect(
        service.updateProfile(usuario.id, {
          email: emailExistente,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      // Confirma que o usuário original não foi alterado
      const usuarioBanco = await prisma.usuario.findUnique({
        where: {
          id: usuario.id,
        },
      });

      expect(usuarioBanco?.email).toBe(emailTeste);
    });
  });
});