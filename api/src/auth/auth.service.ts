import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── AES-256-GCM Encryption ─────────────────────────────────────────────

  private encryptPayload(data: object): { iv: string; encrypted: string; authTag: string } {
    const sharedKey = this.configService.get<string>('AD_SHARED_KEY') || '';
    // Derive a 32-byte key from the shared key string
    const key = crypto.createHash('sha256').update(sharedKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const json = JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      encrypted: encrypted.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  // ─── AD Authentication via On-Premise Agent ─────────────────────────────

  private async authenticateViaAD(
    username: string,
    password: string,
  ): Promise<{ success: boolean; telegram_id?: string }> {
    const agentUrl = this.configService.get<string>('AD_AGENT_URL');
    if (!agentUrl) {
      throw new UnauthorizedException('AD Agent ยังไม่ได้ถูกตั้งค่า กรุณาติดต่อผู้ดูแลระบบ');
    }

    const payload = this.encryptPayload({ username, password });

    try {
      const res = await fetch(`${agentUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = (err as any).message || 'AD Authentication ล้มเหลว';
        throw new UnauthorizedException(message);
      }

      const result = await res.json() as { success: boolean; telegram_id?: string };
      return result;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('ไม่สามารถเชื่อมต่อ AD Agent ได้ กรุณาตรวจสอบการเชื่อมต่อ');
    }
  }

  // ─── User Validation ────────────────────────────────────────────────────

  async validateUser(identifier: string, pass: string): Promise<any> {
    // lookup by email or username
    let user = await this.usersService.findOneByEmail(identifier);
    if (!user) {
      user = await this.usersService.findOneByUsername(identifier);
    }

    if (!user || user.status !== 'active') return null;

    // --- AD Authentication Path ---
    if (user.isAdAuth) {
      try {
        const adResult = await this.authenticateViaAD(user.username, pass);
        if (!adResult.success) return null;

        // Auto-sync Telegram ID from AD Pager field if returned
        if (adResult.telegram_id && adResult.telegram_id !== user.telegramId) {
          await this.usersService.update(user.id, {
            telegramId: adResult.telegram_id,
          });
          user = { ...user, telegramId: adResult.telegram_id };
        }

        const { password, ...result } = user;
        return result;
      } catch {
        return null;
      }
    }

    // --- Local Authentication Path ---
    const isMatch = await bcrypt.compare(pass, user.password);
    if (isMatch) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async validateUserPin(identifier: string, pin: string, deviceToken: string): Promise<any> {
    let user = await this.usersService.findOneByEmail(identifier);
    if (!user) {
      user = await this.usersService.findOneByUsername(identifier);
    }

    if (user && user.status === 'active' && user.pinCode) {
      const isMatch = await bcrypt.compare(pin, user.pinCode);
      if (isMatch) {
        let devices: string[] = [];
        if (user.devices) {
          try {
            devices = Array.isArray(user.devices) ? (user.devices as string[]) : [];
          } catch {
            devices = [];
          }
        }
        if (devices.includes(deviceToken)) {
          const { password, pinCode, ...result } = user;
          return result;
        }
      }
    }
    return null;
  }

  async login(user: any) {
    // Update last access
    await this.usersService.updateLastAccess(user.id);
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      expires: 3600 * 1000, // 1 hour in ms
    };
  }

  // Format prisma user object to snake_case for frontend compatibility
  formatUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.firstName,
      last_name: user.lastName,
      nickname: user.nickname,
      status: user.status,
      role: {
        id: user.role === 'ADMIN' ? 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0' : 'user',
        name: user.role === 'ADMIN' ? 'Administrator' : 'User',
      },
      department: user.department,
      position: user.position,
      avatar_url: user.avatarUrl,
      telegram_id: user.telegramId,
      is_ad_auth: (user as any).isAdAuth ?? false,
      last_access: (user as any).lastAccess ? (user as any).lastAccess.toISOString() : null,
    };
  }
}
