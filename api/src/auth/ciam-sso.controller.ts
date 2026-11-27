import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CiamSsoService } from './ciam-sso.service';
import { SettingsService } from '../settings/settings.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CIAM_FRAMEWORK_VERSION, extractClientIp } from '../common/ip.util';
import * as express from 'express';
import { Role } from '@prisma/client';

@Controller(['auth/sso', 'api/auth/sso'])
export class CiamSsoController {

  constructor(
    private readonly ciamSsoService: CiamSsoService,
    private readonly settingsService: SettingsService,
  ) {}

  private getClientIp(req: express.Request): string {
    return extractClientIp(req);
  }

  // ─── B.1 Public SSO Config for Login Page ──────────────────────────────
  @Get('config')
  async getSsoConfig(@Res({ passthrough: true }) res: express.Response) {
    res.setHeader('X-CIAM-Framework-Version', CIAM_FRAMEWORK_VERSION);
    const [
      ssoEnabled,
      breakGlass,
      baseUrl,
      clientId,
      idleTimeoutMinutes,
      idleWarningSeconds,
      sessionTtlMinutes,
    ] = await Promise.all([
      this.settingsService.getBoolean('ciam_sso_enabled', true),
      this.settingsService.getBoolean('ciam_break_glass_active', false),
      this.settingsService.get('ciam_base_url', 'https://ciam.windowasia.com'),
      this.settingsService.get('ciam_client_id', 'worksync-spoke-client'),
      this.settingsService.getNumber('ciam_idle_timeout_minutes', 30),
      this.settingsService.getNumber('ciam_idle_warning_seconds', 60),
      this.settingsService.getNumber('ciam_session_ttl_minutes', 480),
    ]);

    return {
      sso_enabled: ssoEnabled,
      break_glass_active: breakGlass,
      ciam_base_url: baseUrl,
      client_id: clientId,
      framework_version: CIAM_FRAMEWORK_VERSION,
      idle_timeout_minutes: idleTimeoutMinutes,
      idle_warning_seconds: idleWarningSeconds,
      session_ttl_minutes: sessionTtlMinutes,
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
    @Body() body: { code: string; code_verifier?: string; redirect_uri: string; state?: string },
    @Req() req: express.Request,
  ) {
    if (!body?.code || !body?.redirect_uri) {
      throw new BadRequestException('ข้อมูล code และ redirect_uri จำเป็นสำหรับการแลกเปลี่ยน Token');
    }
    const ip = this.getClientIp(req);
    return await this.ciamSsoService.handleCallback(
      body.code,
      body.code_verifier || '',
      body.redirect_uri,
      ip,
      body.state,
    );
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
