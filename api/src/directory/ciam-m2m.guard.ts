import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import * as express from 'express';

@Injectable()
export class CiamM2mGuard implements CanActivate {
  private readonly logger = new Logger(CiamM2mGuard.name);
  private readonly ALLOWED_CIAM_IP = '157.173.219.153';

  constructor(private readonly settingsService: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<express.Request>();

    // 1. Verify X-Management-API-Key
    const apiKey = (req.headers['x-management-api-key'] as string) || '';
    const expectedKey = await this.settingsService.getM2mKey();

    if (!apiKey || apiKey !== expectedKey) {
      this.logger.warn(`Rejected M2M request: invalid or missing X-Management-API-Key from IP ${req.ip}`);
      throw new UnauthorizedException({
        status: 'FAILED',
        message: 'Invalid or missing X-Management-API-Key header.',
      });
    }

    // 2. IP Whitelist Check
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
    const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';

    const isLocalOrPrivate =
      !clientIp ||
      clientIp === '127.0.0.1' ||
      clientIp === '::1' ||
      clientIp === 'localhost' ||
      clientIp.startsWith('172.') ||
      clientIp.startsWith('10.') ||
      clientIp.startsWith('192.168.');

    if (clientIp !== this.ALLOWED_CIAM_IP && !isLocalOrPrivate) {
      this.logger.warn(`M2M Access denied: IP ${clientIp} not in whitelist`);
      throw new ForbiddenException({
        status: 'FAILED',
        message: `Client IP ${clientIp} is not authorized for Central IAM Management API`,
      });
    }

    return true;
  }
}
