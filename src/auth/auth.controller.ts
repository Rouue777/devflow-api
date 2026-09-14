import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {

    constructor(private readonly authService : AuthService){}

    //rota de login 
@Post('login')
login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}

}
