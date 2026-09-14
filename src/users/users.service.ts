import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/create-usuario.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {

    constructor(private readonly prisma : PrismaService){}


    //////////////Logica para funcionalidade dos usuarios 

    //function para cadastro 
    async register(register : RegisterDto ){
        //compara se ja existe email
        const exists = await this.prisma.usuario.findUnique({
            where : {email : register.email},
        })

        if(exists){
            throw new ConflictException('E-mail já cadastrado');
        }

        //hashear a senha 
        const hashPassword = await bcrypt.hash(register.senha, 10);

        return this.prisma.usuario.create({
            data : {
                nome : register.nome,
                email : register.email,
                senha : hashPassword
            },
            select : {
                id : true,
                nome : true,
                email : true,
                dataCadastro : true,
            },
        })


    } 

    /// functiona para buscar usuario por email 
     async buscarPorEmail(email: string) {
    return this.prisma.usuario.findUnique({
      where: { email },
    });
  }
}
