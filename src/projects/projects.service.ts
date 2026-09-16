import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';


@Injectable()
export class ProjectsService {
    constructor(private readonly prisma: PrismaService) { }

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

    ///// FEATURES DO MEMBROS NO PROJETO
    async addMember(
        projectId: number,
        userId: number,
        memberId: number,
    ) {
        // Verifica se o projeto existe
        const projeto = await this.prisma.projeto.findUnique({
            where: { id: projectId },
        });

        if (!projeto) {
            throw new NotFoundException('Projeto não encontrado');
        }

        // Apenas o responsável pode adicionar
        if (projeto.responsavelId !== userId) {
            throw new ForbiddenException(
                'Apenas o responsável pode adicionar membros',
            );
        }

        // Verifica se o usuário que será adicionado existe
        const usuario = await this.prisma.usuario.findUnique({
            where: { id: memberId },
        });

        if (!usuario) {
            throw new NotFoundException('Usuário não encontrado');
        }

        // Verifica se já é membro
        const membroExistente =
            await this.prisma.projetoUsuario.findUnique({
                where: {
                    projetoId_usuarioId: {
                        projetoId: projectId,
                        usuarioId: memberId,
                    },
                },
            });

        if (membroExistente) {
            throw new ConflictException(
                'Usuário já é membro deste projeto',
            );
        }

        // Adiciona
        return this.prisma.projetoUsuario.create({
            data: {
                projetoId: projectId,
                usuarioId: memberId,
            },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
            },
        });
    }

    async findMembers(
        projectId: number,
        userId: number,
    ) {
        // Reaproveita a verificação de acesso que já existe
        await this.findOne(projectId, userId);

        return this.prisma.projetoUsuario.findMany({
            where: {
                projetoId : projectId,
            },
            select: {
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                    },
                },
            },
        });
    }

    async removeMember(
        projectId: number,
        userId: number,
        memberId: number,
    ) {
        const projeto = await this.prisma.projeto.findUnique({
            where: { id: projectId },
        });

        if (!projeto) {
            throw new NotFoundException('Projeto não encontrado');
        }

        // Apenas responsável pode remover
        if (projeto.responsavelId !== userId) {
            throw new ForbiddenException(
                'Apenas o responsável pode remover membros',
            );
        }

        // Responsável não pode remover a si próprio
        if (projeto.responsavelId === memberId) {
            throw new ForbiddenException(
                'O responsável não pode remover a si próprio',
            );
        }

        const membro =
            await this.prisma.projetoUsuario.findUnique({
                where: {
                    projetoId_usuarioId: {
                        projetoId: projectId,
                        usuarioId: memberId,
                    },
                },
            });

        if (!membro) {
            throw new NotFoundException(
                'Membro não encontrado neste projeto',
            );
        }

        // Remove atribuição das tarefas desse membro
        await this.prisma.tarefa.updateMany({
            where: {
                projetoId : projectId,
                responsavelId: memberId,
            },
            data: {
                responsavelId: null,
            },
        });

        // Remove o membro
        return this.prisma.projetoUsuario.delete({
            where: {
                projetoId_usuarioId: {
                    projetoId: projectId,
                    usuarioId: memberId,
                },
            },
        });
    }

}