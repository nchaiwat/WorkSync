import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { SettingsService } from '../settings/settings.service';
import { TransactionLogsService } from '../transaction-logs/transaction-logs.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { Role } from '@prisma/client';

export interface AuthorizeUrlResponse {
  authorize_url: string;
  code_verifier: string;
  state: string;
}

@Injectable()
export class CiamSsoService {
  private readonly logger = new Logger(CiamSsoService.name);
  private jwksCache: { keys: any[]; fetchedAt: number } | null = null;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly transactionLogsService: TransactionLogsService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  // ─── PKCE Generator (RFC 7636) ──────────────────────────────────────────
  generatePkce(): { code_verifier: string; code_challenge: string } {
    // Generate 64-byte random string
    const code_verifier = crypto.randomBytes(48).toString('base64url');
    // SHA256 base64url encoded
    const code_challenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');
    return { code_verifier, code_challenge };
  }

  // ─── Authorize URL ──────────────────────────────────────────────────────
  async getAuthorizeUrl(redirectUri: string): Promise<AuthorizeUrlResponse> {
    const ssoEnabled = await this.settingsService.getBoolean('ciam_sso_enabled', true);
    const breakGlass = await this.settingsService.getBoolean('ciam_break_glass_active', false);

    if (!ssoEnabled || breakGlass) {
      throw new ServiceUnavailableException('ระบบ Central IAM SSO ปิดใช้งานชั่วคราว หรืออยู่ในโหมดฉุกเฉิน Break-Glass');
    }

    const baseUrl = (await this.settingsService.get('ciam_base_url', 'https://ciam.windowasia.com')).replace(/\/+$/, '');
    const clientId = await this.settingsService.get('ciam_client_id', 'worksync-spoke-client');

    const { code_verifier, code_challenge } = this.generatePkce();
    const state = `state_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state,
      code_challenge,
      code_challenge_method: 'S256',
    });

    const authorize_url = `${baseUrl}/oauth/authorize?${params.toString()}`;
    return {
      authorize_url,
      code_verifier,
      state,
    };
  }

  // ─── JWKS Public Key Retrieval ──────────────────────────────────────────
  private async getJwksKey(baseUrl: string, kid?: string): Promise<any> {
    const now = Date.now();
    // Cache for 10 minutes
    if (!this.jwksCache || now - this.jwksCache.fetchedAt > 600000) {
      const jwksUri = `${baseUrl}/.well-known/jwks.json`;
      const res = await fetch(jwksUri, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) {
        throw new Error(`Failed to fetch JWKS from ${jwksUri} (status ${res.status})`);
      }
      const data = await res.json();
      this.jwksCache = { keys: data.keys || [], fetchedAt: now };
    }

    if (!this.jwksCache.keys.length) {
      throw new Error('No keys found in JWKS');
    }

    if (kid) {
      const match = this.jwksCache.keys.find((k) => k.kid === kid);
      if (match) return match;
    }
    // Fallback to first RSA key
    return this.jwksCache.keys[0];
  }

  // ─── Verify RS256 ID Token ──────────────────────────────────────────────
  private async verifyIdToken(idToken: string, baseUrl: string, clientId: string): Promise<any> {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format (expected 3 segments)');
    }

    let header: any;
    let payload: any;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new Error('Could not parse JWT header or payload');
    }

    if (header.alg !== 'RS256') {
      throw new Error(`Unsupported JWT algorithm: ${header.alg}. Expected RS256.`);
    }

    const jwkKey = await this.getJwksKey(baseUrl, header.kid);
    const publicKey = crypto.createPublicKey({ key: jwkKey, format: 'jwk' });

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    const isSignatureValid = verifier.verify(publicKey, Buffer.from(parts[2], 'base64url'));

    if (!isSignatureValid) {
      throw new Error('SignatureVerificationFailed: RS256 signature mismatch');
    }

    // Claims Verification
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      throw new Error('TokenExpired: ID Token has expired');
    }

    // Clean issuer comparison
    const expectedIss = baseUrl.replace(/\/+$/, '');
    const actualIss = (payload.iss || '').replace(/\/+$/, '');
    if (actualIss && actualIss !== expectedIss) {
      this.logger.warn(`Issuer mismatch. Expected: ${expectedIss}, got: ${actualIss}`);
    }

    // Clean audience comparison
    const audArray = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.aud && !audArray.includes(clientId)) {
      this.logger.warn(`Audience mismatch. Expected: ${clientId}, got: ${payload.aud}`);
    }

    return payload;
  }

  // ─── SSO Callback & Token Exchange ──────────────────────────────────────
  async handleCallback(code: string, codeVerifier: string, redirectUri: string, ip: string) {
    const ssoEnabled = await this.settingsService.getBoolean('ciam_sso_enabled', true);
    if (!ssoEnabled) {
      throw new ServiceUnavailableException('Central IAM SSO ปิดใช้งานในระบบ WorkSync');
    }

    const baseUrl = (await this.settingsService.get('ciam_base_url', 'https://ciam.windowasia.com')).replace(/\/+$/, '');
    const clientId = await this.settingsService.get('ciam_client_id', 'worksync-spoke-client');
    const clientSecret = await this.settingsService.get('ciam_client_secret', '');

    // 1. Exchange Code with CIAM Token Endpoint
    const tokenUrl = `${baseUrl}/api/v1/oauth/token`;
    const tokenPayload = {
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    };

    let tokenResponse: any;
    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(tokenPayload),
        signal: AbortSignal.timeout(8000),
      });

      const resText = await res.text();
      if (!res.ok) {
        let errMsg = `CIAM Token Exchange failed with status ${res.status}`;
        try {
          const errObj = JSON.parse(resText);
          errMsg = errObj.error_description || errObj.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      tokenResponse = JSON.parse(resText);
    } catch (err: any) {
      await this.transactionLogsService.recordLog({
        category: 'ciam_sso',
        action: 'login_failed',
        status: 'failed',
        message: `การยืนยันตัวตน SSO ล้มเหลว: ${err.message}`,
        details: { error: 'TokenExchangeFailed', ip, detail: err.message },
        triggeredBy: 'system:ciam',
      });
      throw new UnauthorizedException(`ไม่สามารถแลกเปลี่ยน Token กับ Central IAM ได้: ${err.message}`);
    }

    // 2. Verify ID Token
    const idToken = tokenResponse.id_token;
    if (!idToken) {
      throw new UnauthorizedException('Central IAM ไม่ได้ส่ง ID Token กลับมา');
    }

    let claims: any;
    try {
      claims = await this.verifyIdToken(idToken, baseUrl, clientId);
    } catch (err: any) {
      await this.transactionLogsService.recordLog({
        category: 'ciam_sso',
        action: 'login_failed',
        status: 'failed',
        message: `การยืนยันตัวตน SSO ล้มเหลว: ลายเซ็นไม่ถูกต้องหรือ Token หมดอายุ`,
        details: { error: 'SignatureVerificationFailed', ip, detail: err.message },
        triggeredBy: 'system:ciam',
      });
      throw new UnauthorizedException(`การตรวจสอบ ID Token ล้มเหลว: ${err.message}`);
    }

    const username = claims.sub || claims.preferred_username || claims.username;
    const email = claims.email || null;
    const fullName = claims.name || claims.full_name || username;

    if (!username) {
      throw new UnauthorizedException('ไม่พบข้อมูลระบุตัวตน (username / sub) ใน ID Token');
    }

    // 3. Resolve or Auto-Provision User
    let user = await this.usersService.findOneByUsername(username);
    if (!user && email) {
      user = await this.usersService.findOneByEmail(email);
    }

    if (user) {
      // Check status
      if (user.status !== 'active') {
        await this.transactionLogsService.recordLog({
          category: 'ciam_sso',
          action: 'account_deactivated',
          status: 'warning',
          message: `ปฏิเสธการเข้าสู่ระบบ: บัญชีพนักงาน '${username}' ถูกระงับสิทธิ์ในระบบนี้`,
          details: { username, ip, reason: `status is ${user.status}` },
          triggeredBy: `user:${username}`,
        });
        throw new UnauthorizedException(`บัญชีผู้ใช้ '${username}' ถูกระงับสิทธิ์ในระบบ WorkSync`);
      }
    } else {
      // Auto-provisioning
      const defaultGroup = await this.settingsService.get('ciam_auto_provision_group', 'User');
      const isRoleAdmin = defaultGroup.toLowerCase().includes('admin');
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || username;
      const lastName = nameParts.slice(1).join(' ') || '-';

      const randomPass = crypto.randomBytes(16).toString('hex');
      user = await this.usersService.create({
        username,
        email: email || `${username}@waapps.net`,
        password: randomPass,
        firstName,
        lastName,
        role: isRoleAdmin ? Role.ADMIN : Role.USER,
        status: 'active',
        isAdAuth: true,
        department: claims.department || 'Window Asia',
        position: claims.position || 'Staff',
      });

      await this.transactionLogsService.recordLog({
        category: 'ciam_sso',
        action: 'auto_provision_user',
        status: 'info',
        message: `สร้างบัญชีผู้ใช้ใหม่อัตโนมัติจาก Central IAM: '${username}'`,
        details: { username, email, group_assigned: defaultGroup, claims },
        triggeredBy: 'system:ciam',
      });
    }

    // 4. Issue WorkSync Session Token
    const tokenData = await this.authService.login(user);

    // 5. Record SSO-01 Login Success
    await this.transactionLogsService.recordLog({
      category: 'ciam_sso',
      action: 'login_success',
      status: 'success',
      message: `เข้าสู่ระบบผ่าน Central IAM SSO สำเร็จ: ผู้ใช้ '${username}'`,
      details: {
        username,
        ip,
        ciam_issuer: baseUrl,
        auth_method: 'OIDC_PKCE_S256',
        role: user.role,
      },
      triggeredBy: `user:${username}`,
    });

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: 'bearer',
      user: this.authService.formatUser(user),
    };
  }

  // ─── Break-Glass Toggle ─────────────────────────────────────────────────
  async toggleBreakGlass(active: boolean, reason: string, adminUsername: string, ip: string) {
    const prevState = await this.settingsService.getBoolean('ciam_break_glass_active', false);
    await this.settingsService.updateCiamConfig(
      { ciam_break_glass_active: active },
      adminUsername,
      ip,
    );

    await this.transactionLogsService.recordLog({
      category: 'security_break_glass',
      action: 'toggle_break_glass',
      status: active ? 'warning' : 'success',
      message: `สลับสถานะระบบ Break-Glass: ${active ? 'ENABLED' : 'DISABLED'} โดย '${adminUsername}'`,
      details: {
        break_glass_active: active,
        reason: reason || 'Admin Manual Toggle',
        ip,
        prev_state: prevState,
      },
      triggeredBy: `user:${adminUsername}`,
    });

    return {
      status: 'success',
      break_glass_active: active,
      message: `ระบบ Break-Glass ถูก ${active ? 'เปิดใช้งาน (Active)' : 'ปิดการใช้งาน (Deactivated)'} เรียบร้อยแล้ว`,
    };
  }
}
