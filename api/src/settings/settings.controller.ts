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
} from '@nestjs/common';
import { SettingsService, UpdateCiamDto } from './settings.service';
import { TransactionLogsService } from '../transaction-logs/transaction-logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as express from 'express';
import { Role } from '@prisma/client';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly transactionLogsService: TransactionLogsService,
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
    @Body() body: UpdateCiamDto,
    @Req() req: express.Request,
  ) {
    const user = this.checkAdmin(req);
    const ip = this.getClientIp(req);
    const result = await this.settingsService.updateCiamConfig(body, user.username || 'admin', ip);
    return result;
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
}
