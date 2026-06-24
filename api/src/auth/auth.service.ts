import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── AES-256-GCM Encryption (Deprecating but keeping if needed elsewhere) ─

  private encryptPayload(data: object): { iv: string; encrypted: string; authTag: string } {
    const sharedKey = this.configService.get<string>('AD_SHARED_KEY') || '';
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

  // ─── AD Gateway Authentication ──────────────────────────────────────────

  private async authenticateViaADGateway(
    username: string,
    password: string,
  ): Promise<{ success: boolean; token?: string; message?: string }> {
    const gatewayUrl = this.configService.get<string>('AD_GATEWAY_URL') || 'http://172.17.0.1:3100/api/v2/login';
    const appId = this.configService.get<string>('AD_APP_ID') || 'worksync';
    const secretKey = this.configService.get<string>('AD_SECRET_KEY') || 'EAAD6F0F70CE84DF67037F2D835511927D964493B7BB986C61CF20272D9A87EC';

    // Format ISO timestamp shifted by +7 hours to local Bangkok time, structured as YYYY-MM-DDTHH:mm:ssZ
    const tzoffset = 7 * 60 * 60 * 1000;
    const localTime = new Date(Date.now() + tzoffset);
    const timestampStr = localTime.toISOString().split('.')[0] + 'Z';

    const payload = {
      app_id: appId,
      secret_key: secretKey,
      username,
      password,
      timestamp: timestampStr,
    };

    try {
      console.log(`[AD Auth Request] Target: ${gatewayUrl}`);
      console.log(`[AD Auth Request] Payload: ${JSON.stringify({ ...payload, password: '***' })}`);

      const res = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseText = await res.clone().text().catch(() => '');
      console.log(`[AD Auth Response] Status: ${res.status}, Body: ${responseText}`);

      if (!res.ok) {
        let message = `AD Gateway returned status ${res.status}`;
        try {
          const err = JSON.parse(responseText);
          message = err.message || message;
        } catch {}
        throw new Error(message);
      }

      let result: any = {};
      try {
        result = JSON.parse(responseText);
      } catch {}

      return {
        success: result.status === 'success',
        token: result.token,
        message: result.message,
      };
    } catch (err: any) {
      console.error(`[AD Auth Exception] Error: ${err.message}`);
      throw new Error(err.message || 'ไม่สามารถเชื่อมต่อ AD Gateway ได้');
    }
  }

  // ─── Record Login Logs ──────────────────────────────────────────────────

  private async recordLoginLog(
    username: string,
    authType: 'AD' | 'LOCAL',
    ipAddress: string,
    status: 'ACCEPT' | 'REJECT' | 'DENIED' | 'ERROR',
    message?: string,
  ) {
    try {
      await this.prisma.loginLog.create({
        data: {
          username,
          authType,
          ipAddress,
          status,
          message,
        },
      });
    } catch (err) {
      console.error('Failed to write login log:', err);
    }
  }

  // ─── User Validation ────────────────────────────────────────────────────

  async validateUser(
    identifier: string,
    pass: string,
    authType: 'ad' | 'local' = 'local',
    ipAddress: string = 'unknown',
  ): Promise<any> {
    const loginMode = authType === 'ad' ? 'AD' : 'LOCAL';

    // lookup by email or username
    let user = await this.usersService.findOneByEmail(identifier);
    if (!user) {
      user = await this.usersService.findOneByUsername(identifier);
    }

    // 1. User not found in system
    if (!user) {
      await this.recordLoginLog(identifier, loginMode, ipAddress, 'DENIED', 'ไม่พบผู้ใช้งานนี้ในระบบ WorkSync');
      return null;
    }

    // 2. User status is not active
    if (user.status !== 'active') {
      await this.recordLoginLog(user.username, loginMode, ipAddress, 'DENIED', `บัญชีผู้ใช้อยู่ในสถานะ ${user.status}`);
      return null;
    }

    // 3. AD Authentication Path
    if (authType === 'ad') {
      if (!user.isAdAuth) {
        await this.recordLoginLog(user.username, 'AD', ipAddress, 'DENIED', 'บัญชีผู้ใช้นี้ยังไม่เปิดการใช้งาน Active Directory Authentication');
        return null;
      }

      try {
        const adResult = await this.authenticateViaADGateway(user.username, pass);
        if (!adResult.success) {
          await this.recordLoginLog(
            user.username,
            'AD',
            ipAddress,
            'REJECT',
            adResult.message || 'รหัสผ่าน AD ไม่ถูกต้อง หรือบัญชีไม่มีสิทธิ์ในกลุ่ม AD',
          );
          return null;
        }

        // Sync Password to local database
        await this.usersService.update(user.id, {
          password: pass, // usersService.update automatically bcrypt-hashes the password
        });

        await this.recordLoginLog(user.username, 'AD', ipAddress, 'ACCEPT', 'เข้าสู่ระบบผ่าน Active Directory สำเร็จ');

        const { password, ...result } = user;
        return result;
      } catch (err: any) {
        await this.recordLoginLog(user.username, 'AD', ipAddress, 'ERROR', err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ AD Gateway');
        return null;
      }
    }

    // 4. Local Authentication Path
    const isMatch = await bcrypt.compare(pass, user.password);
    if (isMatch) {
      await this.recordLoginLog(user.username, 'LOCAL', ipAddress, 'ACCEPT', 'เข้าสู่ระบบสำเร็จ');
      const { password, ...result } = user;
      return result;
    }

    await this.recordLoginLog(user.username, 'LOCAL', ipAddress, 'REJECT', 'รหัสผ่านไม่ถูกต้อง');
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
