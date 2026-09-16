import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProjectsService - integração', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  let userId: number;
  let outroUserId: number;

  const email = 'projects.integration@email.com';
  const outroEmail = 'projects.outro.integration@email.com';

  beforeAll(async () => {
    prisma = new PrismaService();
    service = new ProjectsService(prisma);

    await prisma.$connect();
  });

  beforeEach(async () => {
    // Limpa os dados usados pelos testes
    await prisma.projetoUsuario.deleteMany();
    await prisma.projeto.deleteMany();

    await prisma.usuario.deleteMany({
      where: {
        email: {
          in: [email, outroEmail],
        },
      },
    });

    const senha = await bcrypt.hash('123456', 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome: 'Jeferson',
        email,
        senha,
      },
    });

    const outroUsuario = await prisma.usuario.create({
      data: {
        nome: 'Outro usuário',
        email: outroEmail,
        senha,
      },
    });

    userId = usuario.id;
    outroUserId = outroUsuario.id;
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

      await prisma.$disconnect();
    }
  });

  it('deve criar um projeto no banco com o usuário como responsável', async () => {
    // ACT
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
      descricao: 'Gerenciador de projetos',
    });

    // ASSERT
    expect(projeto.id).toBeDefined();
    expect(projeto.nome).toBe('DevFlow');
    expect(projeto.responsavelId).toBe(userId);

    const projetoBanco = await prisma.projeto.findUnique({
      where: {
        id: projeto.id,
      },
      include: {
        membros: true,
      },
    });

    expect(projetoBanco).not.toBeNull();
    expect(projetoBanco?.responsavelId).toBe(userId);

    // Criador também deve ser membro
    expect(projetoBanco?.membros).toHaveLength(1);
    expect(projetoBanco?.membros[0].usuarioId).toBe(userId);
  });

  it('deve listar os projetos pertencentes ao usuário', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
      descricao: 'Projeto de teste',
    });

    // ACT
    const projetos = await service.findAll(userId);

    // ASSERT
    expect(
      projetos.some((item) => item.id === projeto.id),
    ).toBe(true);
  });

  it('deve buscar um projeto pertencente ao usuário', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    // ACT
    const resultado = await service.findOne(
      projeto.id,
      userId,
    );

    // ASSERT
    expect(resultado.id).toBe(projeto.id);
    expect(resultado.nome).toBe('DevFlow');
  });

  it('deve atualizar o projeto quando o usuário for responsável', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    // ACT
    const atualizado = await service.update(
      projeto.id,
      userId,
      {
        nome: 'DevFlow API',
        descricao: 'Projeto atualizado',
      },
    );

    // ASSERT
    expect(atualizado.nome).toBe('DevFlow API');

    const projetoBanco = await prisma.projeto.findUnique({
      where: {
        id: projeto.id,
      },
    });

    expect(projetoBanco?.nome).toBe('DevFlow API');
    expect(projetoBanco?.descricao).toBe(
      'Projeto atualizado',
    );
  });

  it('deve impedir outro usuário de editar o projeto', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    // ACT + ASSERT
    await expect(
      service.update(projeto.id, outroUserId, {
        nome: 'Alteração indevida',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});