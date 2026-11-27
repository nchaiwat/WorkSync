import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { extractCiamOriginIp } from '../common/ip.util';
import * as express from 'express';

@Injectable()
export class CiamM2mGuard implements CanActivate {
  private readonly logger = new Logger(CiamM2mGuard.name);
  private readonly ALLOWED_CIAM_IP = '157.173.219.153';
  private readonly MAX_TIMESTAMP_DRIFT_SEC = 300; // 5 minutes replay protection

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

    // 2. IP Whitelist Check (x-ciam-origin-ip -> x-origin-ip -> x-forwarded-for -> socket)
    const clientIp = extractCiamOriginIp(req);

    const isLocalOrPrivate =
      clientIp === '127.0.0.1 (SYSTEM)' ||
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

    // 3. Replay Attack Protection via X-Request-Timestamp (if header supplied)
    const rawTs = req.headers['x-request-timestamp'] as string | undefined;
    if (rawTs !== undefined && String(rawTs).trim() !== '') {
      const parsedTs = Number(rawTs);
      if (isNaN(parsedTs)) {
        throw new UnauthorizedException({
          status: 'FAILED',
          message: 'Invalid X-Request-Timestamp header format.',
        });
      }
      // Support both seconds and milliseconds
      const tsSec = parsedTs > 1e12 ? Math.floor(parsedTs / 1000) : Math.floor(parsedTs);
      const nowSec = Math.floor(Date.now() / 1000);
      if (Math.abs(nowSec - tsSec) > this.MAX_TIMESTAMP_DRIFT_SEC) {
        throw new UnauthorizedException({
          status: 'FAILED',
          message: 'X-Request-Timestamp expired or outside allowed drift window.',
        });
      }
    }

    (req as any).ciamOriginIp = clientIp;
    return true;
  }
}
