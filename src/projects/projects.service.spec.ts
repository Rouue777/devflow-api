import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: any;

beforeEach(() => {
  prisma = {
    projeto: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },

    usuario: {
      findUnique: vi.fn(),
    },

    projetoUsuario: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },

    tarefa: {
      updateMany: vi.fn(),
    },
  };

  service = new ProjectsService(
    prisma as PrismaService,
  );
});

  describe('create', () => {
    it('deve criar um projeto com o usuário como responsável', async () => {
      // ARRANGE
      const userId = 1;

      const dto = {
        nome: 'DevFlow',
        descricao: 'Gerenciador de projetos',
      };

      const projetoCriado = {
        id: 1,
        ...dto,
        responsavelId: userId,
      };

      prisma.projeto.create.mockResolvedValue(
        projetoCriado,
      );

      // ACT
      const result = await service.create(
        userId,
        dto,
      );

      // ASSERT
      expect(prisma.projeto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nome: 'DevFlow',
            descricao: 'Gerenciador de projetos',
            responsavelId: userId,
          }),
        }),
      );

      expect(result).toEqual(projetoCriado);
    });
  });

  describe('findAll', () => {
    it('deve listar os projetos pertencentes ao usuário', async () => {
      // ARRANGE
      const userId = 1;

      const projetos = [
        {
          id: 1,
          nome: 'DevFlow',
          responsavelId: userId,
        },
      ];

      prisma.projeto.findMany.mockResolvedValue(
        projetos,
      );

      // ACT
      const result = await service.findAll(userId);

      // ASSERT
      expect(
        prisma.projeto.findMany,
      ).toHaveBeenCalled();

      expect(result).toEqual(projetos);
    });
  });

  describe('findOne', () => {
    it('deve retornar o projeto quando o usuário pertence ao projeto', async () => {
      // ARRANGE
      const userId = 1;
      const projectId = 10;

      const projeto = {
        id: projectId,
        nome: 'DevFlow',
        responsavelId: userId,
        membros: [],
      };

      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      // ACT
      const result = await service.findOne(
        projectId,
        userId,
      );

      // ASSERT
      expect(result).toEqual(projeto);
    });

    it('deve lançar NotFoundException quando o projeto não existir', async () => {
      // ARRANGE
      prisma.projeto.findUnique.mockResolvedValue(
        null,
      );

      // ACT + ASSERT
      await expect(
        service.findOne(999, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deve lançar ForbiddenException quando o usuário não pertence ao projeto', async () => {
      // ARRANGE
      const projeto = {
        id: 10,
        nome: 'DevFlow',
        responsavelId: 2,
        membros: [],
      };

      prisma.projeto.findUnique.mockResolvedValue(
        projeto,
      );

      // ACT + ASSERT
      await expect(
        service.findOne(10, 1),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update', () => {
    it('deve permitir que o responsável edite o projeto', async () => {
      // ARRANGE
      const userId = 1;
      const projectId = 10;

      prisma.projeto.findUnique.mockResolvedValue({
        id: projectId,
        nome: 'DevFlow',
        responsavelId: userId,
      });

      const projetoAtualizado = {
        id: projectId,
        nome: 'DevFlow API',
        descricao: 'Projeto atualizado',
        responsavelId: userId,
      };

      prisma.projeto.update.mockResolvedValue(
        projetoAtualizado,
      );

      // ACT
      const result = await service.update(
        projectId,
        userId,
        {
          nome: 'DevFlow API',
          descricao: 'Projeto atualizado',
        },
      );

      // ASSERT
      expect(
        prisma.projeto.update,
      ).toHaveBeenCalled();

      expect(result).toEqual(projetoAtualizado);
    });

    it('deve impedir que outro usuário edite o projeto', async () => {
      // ARRANGE
      prisma.projeto.findUnique.mockResolvedValue({
        id: 10,
        nome: 'DevFlow',
        responsavelId: 2,
      });

      // ACT + ASSERT
      await expect(
        service.update(10, 1, {
          nome: 'Alteração indevida',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(
        prisma.projeto.update,
      ).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException ao editar projeto inexistente', async () => {
      // ARRANGE
      prisma.projeto.findUnique.mockResolvedValue(
        null,
      );

      // ACT + ASSERT
      await expect(
        service.update(999, 1, {
          nome: 'Projeto',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(
        prisma.projeto.update,
      ).not.toHaveBeenCalled();
    });
  });

  describe('addMember', () => {
  it('deve adicionar um usuário existente ao projeto', async () => {
    const projectId = 1;
    const userId = 1;
    const memberId = 2;

    prisma.projeto.findUnique.mockResolvedValue({
      id: projectId,
      responsavelId: userId,
    });

    prisma.usuario.findUnique.mockResolvedValue({
      id: memberId,
      nome: 'Novo membro',
    });

    prisma.projetoUsuario.findUnique.mockResolvedValue(
      null,
    );

    const membroCriado = {
      projetoId: projectId,
      usuarioId: memberId,
    };

    prisma.projetoUsuario.create.mockResolvedValue(
      membroCriado,
    );

    const result = await service.addMember(
      projectId,
      userId,
      memberId,
    );

    expect(
      prisma.projetoUsuario.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          projetoId: projectId,
          usuarioId: memberId,
        },
      }),
    );

    expect(result).toEqual(membroCriado);
  });

  it('deve impedir que usuário que não é responsável adicione membro', async () => {
    prisma.projeto.findUnique.mockResolvedValue({
      id: 1,
      responsavelId: 10,
    });

    await expect(
      service.addMember(1, 20, 2),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      prisma.projetoUsuario.create,
    ).not.toHaveBeenCalled();
  });

  it('deve lançar NotFoundException quando usuário a ser adicionado não existir', async () => {
    prisma.projeto.findUnique.mockResolvedValue({
      id: 1,
      responsavelId: 1,
    });

    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      service.addMember(1, 1, 999),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(
      prisma.projetoUsuario.create,
    ).not.toHaveBeenCalled();
  });

  it('deve impedir adicionar usuário que já é membro', async () => {
    prisma.projeto.findUnique.mockResolvedValue({
      id: 1,
      responsavelId: 1,
    });

    prisma.usuario.findUnique.mockResolvedValue({
      id: 2,
    });

    prisma.projetoUsuario.findUnique.mockResolvedValue({
      projetoId: 1,
      usuarioId: 2,
    });

    await expect(
      service.addMember(1, 1, 2),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(
      prisma.projetoUsuario.create,
    ).not.toHaveBeenCalled();
  });
});

describe('findMembers', () => {
  it('deve listar os membros do projeto', async () => {
    const projectId = 1;
    const userId = 1;

    // findMembers chama findOne primeiro
    prisma.projeto.findUnique.mockResolvedValue({
      id: projectId,
      responsavelId: userId,
      membros: [],
    });

    const membros = [
      {
        usuario: {
          id: 1,
          nome: 'Responsável',
          email: 'responsavel@email.com',
        },
      },
      {
        usuario: {
          id: 2,
          nome: 'Membro',
          email: 'membro@email.com',
        },
      },
    ];

    prisma.projetoUsuario.findMany.mockResolvedValue(
      membros,
    );

    const result = await service.findMembers(
      projectId,
      userId,
    );

    expect(
      prisma.projetoUsuario.findMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projetoId: projectId,
        },
      }),
    );

    expect(result).toEqual(membros);
  });

  it('deve impedir usuário sem acesso de listar membros', async () => {
    prisma.projeto.findUnique.mockResolvedValue({
      id: 1,
      responsavelId: 10,
      membros: [],
    });

    await expect(
      service.findMembers(1, 20),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      prisma.projetoUsuario.findMany,
    ).not.toHaveBeenCalled();
  });
});

describe('removeMember', () => {
  it('deve remover membro do projeto', async () => {
    const projectId = 1;
    const userId = 1;
    const memberId = 2;

    prisma.projeto.findUnique.mockResolvedValue({
      id: projectId,
      responsavelId: userId,
    });

    prisma.projetoUsuario.findUnique.mockResolvedValue({
      projetoId: projectId,
      usuarioId: memberId,
    });

    prisma.tarefa.updateMany.mockResolvedValue({
      count: 0,
    });

    prisma.projetoUsuario.delete.mockResolvedValue({
      projetoId: projectId,
      usuarioId: memberId,
    });

    const result = await service.removeMember(
      projectId,
      userId,
      memberId,
    );

    expect(prisma.tarefa.updateMany).toHaveBeenCalledWith({
      where: {
        projetoId: projectId,
        responsavelId: memberId,
      },
      data: {
        responsavelId: null,
      },
    });

    expect(
      prisma.projetoUsuario.delete,
    ).toHaveBeenCalled();

    expect(result.usuarioId).toBe(memberId);
  });

  it('deve impedir que responsável remova a si próprio', async () => {
    prisma.projeto.findUnique.mockResolvedValue({
      id: 1,
      responsavelId: 1,
    });

    await expect(
      service.removeMember(1, 1, 1),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      prisma.projetoUsuario.delete,
    ).not.toHaveBeenCalled();
  });

  it('deve impedir outro usuário de remover membro', async () => {
    prisma.projeto.findUnique.mockResolvedValue({
      id: 1,
      responsavelId: 10,
    });

    await expect(
      service.removeMember(1, 20, 2),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(
      prisma.projetoUsuario.delete,
    ).not.toHaveBeenCalled();
  });

  it('deve lançar NotFoundException quando membro não pertence ao projeto', async () => {
    prisma.projeto.findUnique.mockResolvedValue({
      id: 1,
      responsavelId: 1,
    });

    prisma.projetoUsuario.findUnique.mockResolvedValue(
      null,
    );

    await expect(
      service.removeMember(1, 1, 2),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(
      prisma.projetoUsuario.delete,
    ).not.toHaveBeenCalled();
  });
});
});