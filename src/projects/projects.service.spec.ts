import {
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
});