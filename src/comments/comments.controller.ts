import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('projects/:projectId/tasks/:taskId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
  ) {}

  // POST /projects/:projectId/tasks/:taskId/comments
  @Post()
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() request: any,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(
      projectId,
      taskId,
      request.user.sub,
      dto,
    );
  }

  // GET /projects/:projectId/tasks/:taskId/comments
  @Get()
  findAll(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() request: any,
  ) {
    return this.commentsService.findAll(
      projectId,
      taskId,
      request.user.sub,
    );
  }

  // DELETE /projects/:projectId/tasks/:taskId/comments/:commentId
  @Delete(':commentId')
  remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() request: any,
  ) {
    return this.commentsService.remove(
      projectId,
      taskId,
      commentId,
      request.user.sub,
    );
  }
}