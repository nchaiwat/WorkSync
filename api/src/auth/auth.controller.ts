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
import { SessionActivityService } from './session-activity.service';
import { SettingsService } from '../settings/settings.service';
import { TransactionLogsService } from '../transaction-logs/transaction-logs.service';
import { JwtService } from '@nestjs/jwt';
import { extractClientIp } from '../common/ip.util';
import * as express from 'express';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly botDefenseService: BotDefenseService,
    private readonly sessionActivityService: SessionActivityService,
    private readonly settingsService: SettingsService,
    private readonly transactionLogsService: TransactionLogsService,
    private readonly jwtService: JwtService,
  ) {}

  @Post(['auth/login', 'api/auth/login'])
  async login(
    @Body() body: any,
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const ip = extractClientIp(req);

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

    const ip = extractClientIp(req);

    return await this.authService.changeLocalPassword(
      user.id,
      body.old_password,
      body.new_password,
      ip,
    );
  }

  // ─── หมวด H: Session Ping / Keep-Alive & Logout (v2.14.0 / v2.15.0) ────
  @UseGuards(JwtAuthGuard)
  @Post(['auth/session/ping', 'api/auth/session/ping'])
  async pingSession(@Req() req: express.Request) {
    const user = req.user as any;
    const sessionKey = user?.sid || user?.id;
    if (sessionKey && user?.id) {
      this.sessionActivityService.touchSession(sessionKey, user.id, user.username);
    }
    const [idleTimeoutMinutes, idleWarningSeconds, sessionTtlMinutes] = await Promise.all([
      this.settingsService.getNumber('ciam_idle_timeout_minutes', 30),
      this.settingsService.getNumber('ciam_idle_warning_seconds', 60),
      this.settingsService.getNumber('ciam_session_ttl_minutes', 480),
    ]);

    return {
      status: 'ok',
      idle_timeout_minutes: idleTimeoutMinutes,
      idle_warning_seconds: idleWarningSeconds,
      session_ttl_minutes: sessionTtlMinutes,
      server_time: new Date().toISOString(),
    };
  }

  @Post(['auth/logout', 'api/auth/logout', 'auth/sso/logout', 'api/auth/sso/logout'])
  async logoutSession(@Body() body: any, @Req() req: express.Request) {
    const ip = extractClientIp(req);
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc: Record<string, string>, c: string) => {
        const [k, v] = c.trim().split('=');
        if (k && v) acc[k] = v;
        return acc;
      }, {});
      token = cookies['worksync_token'] || cookies['directus_token'] || '';
    }

    let decoded: any = null;
    if (token) {
      try {
        decoded = this.jwtService.decode(token);
      } catch {}
    }

    const reason = body?.reason === 'idle_timeout' ? 'idle_timeout' : 'logout';
    const sessionKey = decoded?.sid || decoded?.sub;
    if (sessionKey) {
      this.sessionActivityService.revokeSession(sessionKey, reason);
    }

    if (reason === 'idle_timeout') {
      let username = body?.username || '';
      if (!username && decoded?.sub) {
        const user = await this.usersService.findOneById(decoded.sub).catch(() => null);
        username = user?.username || decoded?.email || decoded?.sub;
      }
      if (username && this.sessionActivityService.shouldRecordIdleLog(username)) {
        const idleTimeoutMinutes = await this.settingsService.getNumber('ciam_idle_timeout_minutes', 30);
        await this.transactionLogsService.recordLog({
          category: 'ciam_sso',
          action: 'session_idle_timeout',
          status: 'info',
          ipAddress: ip,
          message: `ระบบตัดเซสชันและออกจากระบบอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน ${idleTimeoutMinutes} นาที (Idle Timeout)`,
          details: { idle_minutes: idleTimeoutMinutes, user: username, ip },
          triggeredBy: 'system:idle_timeout',
        });
      }
    }

    return { status: 'success', reason };
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
