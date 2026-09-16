import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { ConflictException, ForbiddenException } from '@nestjs/common';
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

  describe('Members - integração', () => {
  it('deve adicionar um usuário existente como membro do projeto', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    // ACT
    const membro = await service.addMember(
      projeto.id,
      userId,
      outroUserId,
    );

    // ASSERT
    expect(membro.usuarioId).toBe(outroUserId);
    expect(membro.projetoId).toBe(projeto.id);

    // Confirma diretamente no banco
    const membroBanco =
      await prisma.projetoUsuario.findUnique({
        where: {
          projetoId_usuarioId: {
            projetoId: projeto.id,
            usuarioId: outroUserId,
          },
        },
      });

    expect(membroBanco).not.toBeNull();
    expect(membroBanco?.usuarioId).toBe(outroUserId);
  });

  it('deve listar os membros do projeto', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    await service.addMember(
      projeto.id,
      userId,
      outroUserId,
    );

    // ACT
    const membros = await service.findMembers(
      projeto.id,
      userId,
    );

    // ASSERT
    expect(membros).toHaveLength(2);

    const ids = membros.map(
      (membro) => membro.usuario.id,
    );

    expect(ids).toContain(userId);
    expect(ids).toContain(outroUserId);
  });

  it('deve impedir usuário que não é responsável de adicionar membro', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    // ACT + ASSERT
    await expect(
      service.addMember(
        projeto.id,
        outroUserId,
        outroUserId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const membro =
      await prisma.projetoUsuario.findUnique({
        where: {
          projetoId_usuarioId: {
            projetoId: projeto.id,
            usuarioId: outroUserId,
          },
        },
      });

    expect(membro).toBeNull();
  });

  it('deve impedir adicionar usuário que já pertence ao projeto', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    await service.addMember(
      projeto.id,
      userId,
      outroUserId,
    );

    // ACT + ASSERT
    await expect(
      service.addMember(
        projeto.id,
        userId,
        outroUserId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deve permitir que um membro visualize os membros do projeto', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    await service.addMember(
      projeto.id,
      userId,
      outroUserId,
    );

    // ACT
    const membros = await service.findMembers(
      projeto.id,
      outroUserId,
    );

    // ASSERT
    expect(membros).toHaveLength(2);
  });

  it('deve remover um membro do projeto', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    await service.addMember(
      projeto.id,
      userId,
      outroUserId,
    );

    // ACT
    await service.removeMember(
      projeto.id,
      userId,
      outroUserId,
    );

    // ASSERT
    const membro =
      await prisma.projetoUsuario.findUnique({
        where: {
          projetoId_usuarioId: {
            projetoId: projeto.id,
            usuarioId: outroUserId,
          },
        },
      });

    expect(membro).toBeNull();
  });

  it('deve impedir que o responsável remova a si próprio', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    // ACT + ASSERT
    await expect(
      service.removeMember(
        projeto.id,
        userId,
        userId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Confirma que responsável continua como membro
    const responsavel =
      await prisma.projetoUsuario.findUnique({
        where: {
          projetoId_usuarioId: {
            projetoId: projeto.id,
            usuarioId: userId,
          },
        },
      });

    expect(responsavel).not.toBeNull();
  });

  it('deve impedir outro usuário de remover membro', async () => {
    // ARRANGE
    const projeto = await service.create(userId, {
      nome: 'DevFlow',
    });

    await service.addMember(
      projeto.id,
      userId,
      outroUserId,
    );

    // ACT + ASSERT
    await expect(
      service.removeMember(
        projeto.id,
        outroUserId,
        outroUserId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Confirma que continua no banco
    const membro =
      await prisma.projetoUsuario.findUnique({
        where: {
          projetoId_usuarioId: {
            projetoId: projeto.id,
            usuarioId: outroUserId,
          },
        },
      });

    expect(membro).not.toBeNull();
  });
});
});