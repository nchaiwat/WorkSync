import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { BotDefenseService } from './bot-defense.service';
import * as express from 'express';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly botDefenseService: BotDefenseService,
  ) {}

  @Post(['auth/login', 'api/auth/login'])
  async login(
    @Body() body: any,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown';
    const ip = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'unknown';

    // ─── หมวด F: Enterprise In-App Bot Defense 3 ชั้น (v2.10.0) ───────────
    const botCheck = await this.botDefenseService.checkBotDefense(ip, {
      corporate_fax: body.corporate_fax,
      security_honey: body.security_honey,
      form_render_ts: body.form_render_ts,
      username: body.email,
    });

    if (!botCheck.allowed) {
      if (botCheck.retryAfter) {
        res.setHeader('Retry-After', String(botCheck.retryAfter));
      }
      throw new HttpException(
        { detail: botCheck.message || 'คำขอไม่ถูกต้อง' },
        botCheck.statusCode || HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.authService.validateUser(
      body.email,
      body.password,
      body.auth_type || 'local',
      ip,
    );
    if (!user) {
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }

    if (body.device_token) {
      await this.usersService.registerDevice(user.id, body.device_token);
    }

    const tokenData = await this.authService.login(user);
    return { data: tokenData };
  }

  // ─── หมวด G: เปลี่ยนรหัสผ่านบัญชีท้องถิ่น (v2.12.0) ─────────────────────
  @UseGuards(JwtAuthGuard)
  @Post(['auth/local/change-password', 'api/auth/local/change-password', 'auth/change-password'])
  async changePassword(@Body() body: any, @Req() req: express.Request) {
    const user = req.user as any;
    if (!user || !user.id) {
      throw new UnauthorizedException('กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน');
    }

    if (!body?.old_password || !body?.new_password) {
      throw new BadRequestException('กรุณาระบุรหัสผ่านเดิมและรหัสผ่านใหม่');
    }

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown';
    const ip = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'unknown';

    return await this.authService.changeLocalPassword(
      user.id,
      body.old_password,
      body.new_password,
      ip,
    );
  }

  @Post('auth/login-pin')
  async loginPin(@Body() body: any) {
    const { username, pin_code, device_token } = body;
    if (!username || !pin_code || !device_token) {
      throw new UnauthorizedException('ข้อมูลไม่ครบถ้วน');
    }

    const user = await this.authService.validateUserPin(username, pin_code, device_token);
    if (!user) {
      throw new UnauthorizedException('PIN Code หรือเครื่องที่เข้าใช้งานไม่ถูกต้อง หรือเครื่องนี้ยังไม่ได้รับอนุญาต');
    }

    const tokenData = await this.authService.login(user);
    return { data: tokenData };
  }

  @Post('auth/refresh')
  async refresh(@Body() body: any) {
    // Basic refresh token verify
    try {
      const payload = await this.authService.validateUser(body.refresh_token, ''); // Or decode
      const tokenData = await this.authService.login(payload);
      return { data: tokenData };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/me')
  async getMe(@Req() req: express.Request) {
    const user = req.user as any;
    const formatted = this.authService.formatUser(user);

    let previousAccess: string | null = null;
    try {
      const prev = await this.authService.getUserPreviousAccess(user.username);
      previousAccess = prev ? prev.toISOString() : null;
    } catch (err) {
      console.error('Failed to get user previous access time:', err);
    }

    return {
      data: {
        ...formatted,
        previous_access: previousAccess,
      },
    };
  }
}
