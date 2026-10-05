import { ConflictException, Injectable, NotFoundException, } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/create-usuario.dto';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';


@Injectable()
export class UsersService {

    constructor(private readonly prisma: PrismaService) { }


    //////////////Logica para funcionalidade dos usuarios 

    //function para cadastro 
    async register(register: RegisterDto) {
        //compara se ja existe email
        const exists = await this.prisma.usuario.findUnique({
            where: { email: register.email },
        })

        if (exists) {
            throw new ConflictException('E-mail já cadastrado');
        }

        //hashear a senha 
        const hashPassword = await bcrypt.hash(register.senha, 10);

        return this.prisma.usuario.create({
            data: {
                nome: register.nome,
                email: register.email,
                senha: hashPassword
            },
            select: {
                id: true,
                nome: true,
                email: true,
                dataCadastro: true,
            },
        })


    }


    //atualizar perfil

    async updateProfile(userId: number, dto: UpdateProfileDto) {
        if (dto.email) {
            const usuarioComEmail = await this.prisma.usuario.findUnique({
                where: { email: dto.email },
            });

            if (usuarioComEmail && usuarioComEmail.id !== userId) {
                throw new ConflictException('E-mail já está em uso');
            }
        }

        return this.prisma.usuario.update({
            where: { id: userId },

            data: {
                nome: dto.nome,
                email: dto.email,
            },

            select: {
                id: true,
                nome: true,
                email: true,
                dataCadastro: true,
            },
        });
    }




    /////////////////functions de apoio
    ///buscar o proprio usuario
    async getProfile(userId: number) {
        const usuario = await this.prisma.usuario.findUnique({
            where: { id: userId },
            select: {
                id: true,
                nome: true,
                email: true,
                dataCadastro: true,
            },
        });

        if (!usuario) {
            throw new NotFoundException('Usuário não encontrado');
        }

        return usuario;
    }



    /// functiona para buscar usuario por email 
    async buscarPorEmail(email: string) {
        return this.prisma.usuario.findUnique({
            where: { email },
        });
    }
}
