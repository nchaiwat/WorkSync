import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { SettingsService } from '../settings/settings.service';
import { TransactionLogsService } from '../transaction-logs/transaction-logs.service';
import { SessionActivityService } from './session-activity.service';
import { extractClientIp } from '../common/ip.util';
import * as express from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
    private readonly transactionLogsService: TransactionLogsService,
    private readonly sessionActivityService: SessionActivityService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => {
          let token = null;
          if (req && req.headers && req.headers.authorization) {
            const parts = req.headers.authorization.split(' ');
            if (parts.length === 2 && parts[0] === 'Bearer') {
              token = parts[1];
            }
          }
          if (!token && req && req.headers && req.headers.cookie) {
            const parsedCookies = req.headers.cookie.split(';').reduce((acc: Record<string, string>, cookie: string) => {
              const [key, value] = cookie.trim().split('=');
              if (key && value) {
                acc[key] = value;
              }
              return acc;
            }, {});
            token = parsedCookies['worksync_token'] || parsedCookies['directus_token'];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'worksync_super_secret_jwt_key_999888',
      passReqToCallback: true,
    });
  }

  async validate(req: express.Request, payload: { sub: string; email: string; sid?: string }) {
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('ผู้ใช้นี้ไม่มีสิทธิ์เข้าถึงระบบ');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('บัญชีผู้ใช้นี้ถูกระงับสิทธิ์การใช้งาน (Account Deactivated)');
    }

    // Section 14.4: Server-side Inactivity / Idle Timeout Verification
    const sessionKey = payload.sid || user.id;
    const idleTimeoutMinutes = await this.settingsService.getNumber('ciam_idle_timeout_minutes', 30);
    const check = this.sessionActivityService.checkAndTouch(
      sessionKey,
      user.id,
      user.username,
      idleTimeoutMinutes,
    );

    if (check.expired) {
      if (check.reason === 'idle_timeout') {
        if (req.res && typeof req.res.setHeader === 'function') {
          req.res.setHeader('X-Session-Expired', 'idle_timeout');
        }
        if (this.sessionActivityService.shouldRecordIdleLog(user.username)) {
          const clientIp = extractClientIp(req);
          await this.transactionLogsService.recordLog({
            category: 'ciam_sso',
            action: 'session_idle_timeout',
            status: 'info',
            ipAddress: clientIp,
            message: `ระบบตัดเซสชันและออกจากระบบอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน ${idleTimeoutMinutes} นาที (Idle Timeout)`,
            details: { idle_minutes: idleTimeoutMinutes, user: user.username, ip: clientIp },
            triggeredBy: 'system:idle_timeout',
          });
        }
        throw new UnauthorizedException(
          `เซสชันหมดอายุเนื่องจากไม่มีการใช้งานเกิน ${idleTimeoutMinutes} นาที (Idle Timeout กรุณาเข้าสู่ระบบใหม่)`,
        );
      }

      if (check.reason === 'deactivated') {
        throw new UnauthorizedException('บัญชีผู้ใช้นี้ถูกระงับสิทธิ์การใช้งาน (Account Deactivated)');
      }

      throw new UnauthorizedException('เซสชันสิ้นสุดลงแล้ว กรุณาเข้าสู่ระบบใหม่');
    }

    const { password, ...rest } = user;
    return {
      ...rest,
      sid: payload.sid,
    };
  }
}
