import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/create-usuario.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';



@Controller('users')
export class UsersController {

    constructor(private readonly userService : UsersService){}

    //rota para register
@Post("register")
async register(@Body() dto : RegisterDto){

    return this.userService.register(dto)
}


}
