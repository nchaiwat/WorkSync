import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CiamSsoService } from './ciam-sso.service';
import { SettingsService } from '../settings/settings.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import * as express from 'express';
import { Role } from '@prisma/client';

@Controller('auth/sso')
export class CiamSsoController {
  constructor(
    private readonly ciamSsoService: CiamSsoService,
    private readonly settingsService: SettingsService,
  ) {}

  private getClientIp(req: express.Request): string {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown';
    return typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'unknown';
  }

  // ─── B.1 Public SSO Config for Login Page ──────────────────────────────
  @Get('config')
  async getSsoConfig() {
    const ssoEnabled = await this.settingsService.getBoolean('ciam_sso_enabled', true);
    const breakGlass = await this.settingsService.getBoolean('ciam_break_glass_active', false);
    const baseUrl = await this.settingsService.get('ciam_base_url', 'https://ciam.windowasia.com');
    const clientId = await this.settingsService.get('ciam_client_id', 'worksync-spoke-client');

    return {
      sso_enabled: ssoEnabled,
      break_glass_active: breakGlass,
      ciam_base_url: baseUrl,
      client_id: clientId,
      login_button_label: 'เข้าสู่ระบบด้วย Central IAM (SSO)',
      fallback_ad_available: true,
    };
  }

  // ─── B.2 Generate PKCE & Authorize URL ─────────────────────────────────
  @Post('authorize-url')
  async getAuthorizeUrl(@Body() body: { redirect_uri: string }) {
    if (!body?.redirect_uri) {
      throw new BadRequestException('redirect_uri เป็นข้อมูลจำเป็น');
    }
    return await this.ciamSsoService.getAuthorizeUrl(body.redirect_uri);
  }

  // ─── B.3 Exchange Code & Issue Session ──────────────────────────────────
  @Post('callback')
  async handleCallback(
    @Body() body: { code: string; code_verifier: string; redirect_uri: string },
    @Req() req: express.Request,
  ) {
    if (!body?.code || !body?.code_verifier || !body?.redirect_uri) {
      throw new BadRequestException('ข้อมูล code, code_verifier และ redirect_uri จำเป็นสำหรับการแลกเปลี่ยน Token');
    }
    const ip = this.getClientIp(req);
    return await this.ciamSsoService.handleCallback(body.code, body.code_verifier, body.redirect_uri, ip);
  }

  // ─── B.4 Break-Glass Toggle (Security Admin) ───────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('break-glass-toggle')
  async toggleBreakGlass(
    @Body() body: { break_glass_active: boolean; reason?: string },
    @Req() req: express.Request,
  ) {
    const user = req.user as any;
    if (!user || user.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบความปลอดภัยเท่านั้นที่สามารถสลับโหมด Break-Glass ได้');
    }
    const ip = this.getClientIp(req);
    return await this.ciamSsoService.toggleBreakGlass(
      Boolean(body.break_glass_active),
      body.reason || '',
      user.username || 'admin',
      ip,
    );
  }
}
