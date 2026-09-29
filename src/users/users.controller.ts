import { Body, Controller,  Get,  Patch,  Post, Req, UseGuards, } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/create-usuario.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';





@Controller('users')
export class UsersController {

    constructor(private readonly userService : UsersService){}

    //rota para register
@Post("register")
async register(@Body() dto : RegisterDto){

    return this.userService.register(dto)
}

@Get('me')
@UseGuards(JwtAuthGuard)
getProfile(@Req() req: any) {
  return this.userService.getProfile(req.user.sub);
}

@Patch('me')
@UseGuards(JwtAuthGuard)
updateProfile(
  @Req() req: any,
  @Body() dto: UpdateProfileDto,
) {
  return this.userService.updateProfile(req.user.sub, dto);
}

}
