import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/create-usuario.dto';

@Controller('users')
export class UsersController {

    constructor(private readonly userService : UsersService){}

    //rota para register
@Post("register")
async register(@Body() dto : RegisterDto){

    return this.userService.register(dto)
}

}
