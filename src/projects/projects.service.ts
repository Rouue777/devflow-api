import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';


@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // CRIAR PROJETO
  async create(userId: number, dto: CreateProjectDto) {
    return this.prisma.projeto.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao,

        // Usuário autenticado vira responsável
        responsavelId: userId,

        // E também entra como membro do projeto
        membros: {
          create: {
            usuarioId: userId,
          },
        },
      },

      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });
  }

  // LISTAR PROJETOS DO USUÁRIO
  async findAll(userId: number) {
    return this.prisma.projeto.findMany({
      where: {
        OR: [
          {
            responsavelId: userId,
          },
          {
            membros: {
              some: {
                usuarioId: userId,
              },
            },
          },
        ],
      },

      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },

      orderBy: {
        dataCriacao: 'desc',
      },
    });
  }

  // BUSCAR PROJETO POR ID
  async findOne(projectId: number, userId: number) {
    const projeto = await this.prisma.projeto.findUnique({
      where: {
        id: projectId,
      },

      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },

        membros: {
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!projeto) {
      throw new NotFoundException('Projeto não encontrado');
    }

    const pertenceAoProjeto =
      projeto.responsavelId === userId ||
      projeto.membros.some(
        (membro) => membro.usuarioId === userId,
      );

    if (!pertenceAoProjeto) {
      throw new ForbiddenException(
        'Você não possui acesso a este projeto',
      );
    }

    return projeto;
  }

  // EDITAR PROJETO
  async update(
    projectId: number,
    userId: number,
    dto: UpdateProjectDto,
  ) {
    const projeto = await this.prisma.projeto.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!projeto) {
      throw new NotFoundException('Projeto não encontrado');
    }

    // Somente o responsável pode editar
    if (projeto.responsavelId !== userId) {
      throw new ForbiddenException(
        'Apenas o responsável pode editar o projeto',
      );
    }

    return this.prisma.projeto.update({
      where: {
        id: projectId,
      },

      data: {
        nome: dto.nome,
        descricao: dto.descricao,
      },
    });
  }
}