import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  Query,
  UseGuards,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SettingsService, UpdateCiamDto, UpdateSmtpDto } from './settings.service';
import { TransactionLogsService } from '../transaction-logs/transaction-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailService } from '../email/email.service';
import * as express from 'express';
import { Role } from '@prisma/client';

@Controller(['settings', 'api/settings'])
export class SettingsController {

  constructor(
    private readonly settingsService: SettingsService,
    private readonly transactionLogsService: TransactionLogsService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
  ) {}

  private checkAdmin(req: express.Request) {
    const user = req.user as any;
    if (!user || user.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์เข้าถึงส่วนนี้');
    }
    return user;
  }

  private getClientIp(req: express.Request): string {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown';
    return typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'unknown';
  }

  @UseGuards(JwtAuthGuard)
  @Get('ciam-sso')
  async getCiamSettings(@Req() req: express.Request) {
    this.checkAdmin(req);
    const settings = await this.settingsService.getCiamConfig();
    return {
      status: 'success',
      settings,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('ciam-sso')
  async updateCiamSettings(
    @Body() body: any,
    @Req() req: express.Request,
  ) {
    const user = this.checkAdmin(req);
    const ip = this.getClientIp(req);
    try {
      const result = await this.settingsService.updateCiamConfig(body, user.username || 'admin', ip);
      return result;
    } catch (err: any) {
      console.error('[SettingsController] updateCiamSettings error:', err);
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(
        err.message || 'บันทึกการตั้งค่า Central IAM ไม่สำเร็จ',
        HttpStatus.BAD_REQUEST,
      );
    }
  }


  @UseGuards(JwtAuthGuard)
  @Post('ciam-sso/test-connection')
  async testCiamConnection(@Req() req: express.Request) {
    this.checkAdmin(req);
    return await this.settingsService.testCiamConnection();
  }

  @UseGuards(JwtAuthGuard)
  @Get('ciam-sso/logs')
  async getCiamLogs(@Query('category') category: string, @Query('limit') limit: string, @Req() req: express.Request) {
    this.checkAdmin(req);
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const logs = await this.transactionLogsService.getRecentLogs(category || undefined, limitNum);
    return {
      status: 'success',
      data: logs,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('smtp')
  async getSmtpSettings(@Req() req: express.Request) {
    this.checkAdmin(req);
    const settings = await this.settingsService.getSmtpConfig();
    return {
      status: 'success',
      settings,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('smtp')
  async updateSmtpSettings(@Body() body: UpdateSmtpDto, @Req() req: express.Request) {
    const user = this.checkAdmin(req);
    const ip = this.getClientIp(req);
    return await this.settingsService.updateSmtpConfig(body, user.username || user.name, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('smtp/test')
  async testSmtpSettings(@Body() body: { recipient: string }, @Req() req: express.Request) {
    this.checkAdmin(req);
    if (!body?.recipient) {
      throw new HttpException('กรุณาระบุอีเมลผู้รับทดสอบ', HttpStatus.BAD_REQUEST);
    }
    const result = await this.emailService.testSmtp(body.recipient);
    return result;
  }
}
