import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService],
  imports: [PrismaModule,AuthModule]
})
export class CommentsModule {}
