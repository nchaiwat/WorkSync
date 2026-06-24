import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as express from 'express';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Controller('items/tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
  ) {}

  private async formatTasks(tasks: any[]) {
    const users = await this.usersService.findAll();
    const userMap = new Map(users.map((u) => [u.id, u]));

    const formatCreator = (id: string) => {
      if (!id) return null;
      const u = userMap.get(id);
      if (!u) return id;
      const nick = u.nickname ? `${u.nickname} ` : '';
      return `${nick}(${u.firstName})/${u.department || 'ไม่ระบุแผนก'}`;
    };

    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      progress: t.progress,
      deadline: t.deadline ? t.deadline.toISOString() : null,
      avatar_url: t.avatarUrl,
      collaborators: t.collaborators,
      creator_id: t.createdBy,
      created_by_name: formatCreator(t.createdBy),
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
      assignee: t.assignee,
      manager: t.manager,
      latest_update: t.latestUpdate,
      project_owner: t.projectOwner,
      previous_progress: t.previousProgress,
    }));
  }

  @Get()
  async findAll(@Query() query: any) {
    const status = query?.filter?.status?._eq || query['filter[status][_eq]'];
    const assignee = query?.filter?.assignee?._eq || query['filter[assignee][_eq]'];

    const tasks = await this.tasksService.findAll({ status, assignee });
    const formatted = await this.formatTasks(tasks);

    return {
      data: formatted,
      meta: {
        total: formatted.length,
      },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const t = await this.tasksService.findOne(id);
    const formatted = await this.formatTasks([t]);
    return { data: formatted[0] };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: any, @Req() req: express.Request) {
    // Automatically set createdBy to the user making the request
    const user = req.user as any;
    body.created_by = user.id;

    const t = await this.tasksService.create(body);
    const formatted = await this.formatTasks([t]);
    return { data: formatted[0] };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: express.Request) {
    const t = await this.tasksService.findOne(id);
    const user = req.user as any;

    // Enforce edit permissions
    if (user.role !== Role.ADMIN && t.createdBy !== user.id) {
      throw new ForbiddenException('ไม่มีสิทธิ์แก้ไขงานที่คุณไม่ได้เป็นคนสร้าง (ทำได้เพียงคอมเมนต์)');
    }

    const updated = await this.tasksService.update(id, body);
    const formatted = await this.formatTasks([updated]);
    return { data: formatted[0] };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: express.Request) {
    const t = await this.tasksService.findOne(id);
    const user = req.user as any;

    if (user.role !== Role.ADMIN && t.createdBy !== user.id) {
      throw new ForbiddenException('ไม่มีสิทธิ์ลบงานที่คุณไม่ได้เป็นคนสร้าง');
    }

    await this.tasksService.remove(id);
    return { data: { success: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file: any, cb: any) => {
          const dir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          cb(null, dir);
        },
        filename: (req: any, file: any, cb: any) => {
          const taskId = req.params.id;
          const timestamp = Date.now();
          const ext = path.extname(file.originalname).toLowerCase();
          const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
          cb(null, `task-${taskId}-${timestamp}-${baseName}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadFile(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new Error('กรุณาเลือกไฟล์');
    }
    const fileUrl = `/uploads/${file.filename}`;
    return {
      data: {
        url: fileUrl,
        filename: file.originalname,
      }
    };
  }
}
