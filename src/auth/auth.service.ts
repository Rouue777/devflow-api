import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {

    constructor(private readonly jwtService : JwtService,
        private readonly userService: UsersService
    ) {
    }

    //logicas de autenticacao 

    async login(loginDto: LoginDto) {

        const user = await this.userService.buscarPorEmail(loginDto.email)

        if (!user) {
            throw new UnauthorizedException('Credenciais inválidas');
        }

        const validPassoword = await bcrypt.compare(
            loginDto.senha,
            user.senha
        )

        if (!validPassoword) {
            throw new UnauthorizedException('Credenciais inválidas');
        }

        const token = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email,
        });

        return {
            access_token: token,
        };
    }


}
