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
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { TelegramService } from '../telegram/telegram.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as express from 'express';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly telegramService: TelegramService,
  ) {}

  @Get()
  async findAll(@Query() query: any, @Req() req: express.Request) {
    // 1. Check if this is a username to email lookup (public, used before login)
    const usernameFilter = query?.filter?.username?._eq || query['filter[username][_eq]'];
    if (usernameFilter) {
      const user = await this.usersService.findOneByUsername(usernameFilter);
      if (!user) {
        return { data: [] };
      }
      return { data: [{ email: user.email }] };
    }

    // 2. Otherwise, require authentication
    // Note: To authenticate dynamically without throwing 401 for lookup, we handle guard manually or use optional jwt guard.
    // For simplicity, since lookup is done with query.filter, we can just check headers/token here or apply guard.
    // Let's enforce authentication for general users list.
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');
    }

    const users = await this.usersService.findAll();
    const formatted = users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      first_name: u.firstName,
      last_name: u.lastName,
      nickname: u.nickname,
      status: u.status,
      role: {
        id: u.role === 'ADMIN' ? 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0' : 'user',
        name: u.role === 'ADMIN' ? 'Administrator' : 'User',
      },
      department: u.department,
      position: u.position,
      avatar_url: u.avatarUrl,
      telegram_id: u.telegramId,
      is_ad_auth: (u as any).isAdAuth ?? false,
      last_access: (u as any).lastAccess ? (u as any).lastAccess.toISOString() : null,
      created_at: u.createdAt.toISOString(),
    }));
    return { data: formatted };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: any, @Req() req: express.Request) {
    const currentUser = req.user as any;
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถสร้างผู้ใช้ได้');
    }

    const user = await this.usersService.create({
      email: body.email || null,
      username: body.username,
      password: body.password,
      nickname: body.nickname || null,
      firstName: body.first_name || '',
      lastName: body.last_name || '',
      role: (body.role === 'admin' || body.role === 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0') ? Role.ADMIN : Role.USER,
      department: body.department,
      position: body.position,
      telegramId: body.telegram_id || null,
      isAdAuth: body.is_ad_auth === true || body.is_ad_auth === 'true',
      status: body.status || 'active',
    });

    return {
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
        nickname: user.nickname,
        role: user.role.toLowerCase(),
        telegram_id: user.telegramId,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: express.Request) {
    const currentUser = req.user as any;
    if (currentUser.role !== Role.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้อื่น');
    }

    const updates: any = {};
    if (body.email !== undefined) updates.email = body.email || null;
    if (body.username) updates.username = body.username;
    if (body.password) updates.password = body.password;
    if (body.nickname !== undefined) updates.nickname = body.nickname || null;
    if (body.first_name) updates.firstName = body.first_name;
    if (body.last_name) updates.lastName = body.last_name;
    if (body.department) updates.department = body.department;
    if (body.position) updates.position = body.position;
    if (body.status) updates.status = body.status;
    if (body.telegram_id !== undefined) updates.telegramId = body.telegram_id || null;
    if (body.pin_code !== undefined) updates.pinCode = body.pin_code || null;
    if (body.is_ad_auth !== undefined) updates.isAdAuth = body.is_ad_auth === true || body.is_ad_auth === 'true';
    if (body.role && currentUser.role === Role.ADMIN) {
      updates.role = (body.role === 'admin' || body.role === 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0') ? Role.ADMIN : Role.USER;
    }

    const user = await this.usersService.update(id, updates);
    return {
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        first_name: user.firstName,
        last_name: user.lastName,
        nickname: user.nickname,
        status: user.status,
        department: user.department,
        position: user.position,
        telegram_id: user.telegramId,
        is_ad_auth: (user as any).isAdAuth ?? false,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: express.Request) {
    const currentUser = req.user as any;
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถลบผู้ใช้ได้');
    }
    await this.usersService.remove(id);
    return { data: { success: true } };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (req: any, file: any, cb: any) => {
          const dir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          // Clean up existing avatar files for this user to avoid duplicates with different extensions
          const userId = req.params.id;
          try {
            fs.readdirSync(dir).forEach((f) => {
              if (f.startsWith(`avatar-${userId}`)) {
                try {
                  fs.unlinkSync(path.join(dir, f));
                } catch (err) {
                  // ignore
                }
              }
            });
          } catch (e) {
            // ignore
          }
          cb(null, dir);
        },
        filename: (req: any, file: any, cb: any) => {
          const userId = req.params.id;
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `avatar-${userId}${ext}`);
        },
      }),
      fileFilter: (req: any, file: any, cb: any) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const ext = path.extname(file.originalname).toLowerCase();
        const mime = file.mimetype;
        if (allowedTypes.test(ext) && allowedTypes.test(mime)) {
          cb(null, true);
        } else {
          cb(new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น (jpg, jpeg, png, gif, webp)'), false);
        }
      },
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Req() req: express.Request,
  ) {
    const currentUser = req.user as any;
    if (currentUser.role !== Role.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้อื่น');
    }
    if (!file) {
      throw new Error('กรุณาเลือกไฟล์รูปภาพ');
    }

    const avatarUrl = `/uploads/${file.filename}`;
    await this.usersService.update(id, { avatarUrl });
    return { data: { avatar_url: avatarUrl } };
  }

  @UseGuards(JwtAuthGuard)
  @Post('announce')
  async announce(@Body() body: any, @Req() req: express.Request) {
    const currentUser = req.user as any;
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถประกาศได้');
    }

    const { message, targetUserIds } = body;
    if (!message || !message.trim()) {
      throw new BadRequestException('กรุณาระบุข้อความประกาศ');
    }
    if (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      throw new BadRequestException('กรุณาระบุผู้รับประกาศ');
    }

    // Fetch target users to get their Telegram IDs
    const allUsers = await this.usersService.findAll();
    const receivers = allUsers.filter((u) => targetUserIds.includes(u.id));
    const telegramIds = receivers
      .map((u) => u.telegramId)
      .filter((id): id is string => !!id && id.trim() !== '');

    if (telegramIds.length > 0) {
      const announceHeader = `📢 <b>ประกาศสำคัญ (WorkSync)</b>\n${'─'.repeat(28)}\n`;
      const formattedMessage = announceHeader + message.trim();
      await this.telegramService.broadcastNotification(telegramIds, formattedMessage);
    }

    return { data: { success: true, sentCount: telegramIds.length } };
  }
}
