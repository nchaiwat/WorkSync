import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('items/task_comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  async findAll(@Query() query: any) {
    const taskId = query?.filter?.task?._eq || query['filter[task][_eq]'];
    if (!taskId) {
      return { data: [] };
    }
    const comments = await this.commentsService.findAllByTaskId(taskId);
    const formatted = comments.map((c) => ({
      id: c.id,
      task: c.task,
      user: c.user,
      message: c.message,
      created_at: c.createdAt.toISOString(),
      update_key: c.updateKey,
    }));
    return { data: formatted };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: any) {
    const c = await this.commentsService.create({
      task: body.task,
      user: body.user,
      message: body.message,
      updateKey: body.update_key,
    });
    const formatted = {
      id: c.id,
      task: c.task,
      user: c.user,
      message: c.message,
      created_at: c.createdAt.toISOString(),
      update_key: c.updateKey,
    };
    return { data: formatted };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.commentsService.remove(id);
    return { data: { success: true } };
  }
}
