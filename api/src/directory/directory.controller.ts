import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { DirectoryService, CreateAccountDto, UpdateStatusDto } from './directory.service';
import { CiamM2mGuard } from './ciam-m2m.guard';
import * as express from 'express';

@Controller(['api/v1/directory', 'v1/directory'])
@UseGuards(CiamM2mGuard)
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  private getClientIp(req: express.Request): string {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown';
    return typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'unknown';
  }

  // ─── C.1 Directory Accounts (Ping, Health Check & 04:00 AM Sync) ───────────
  @Get('accounts')
  async listAccounts(
    @Query('status') status?: string,
    @Query('department') department?: string,
    @Query('search') search?: string,
  ) {
    return await this.directoryService.listAccounts({ status, department, search });
  }

  // ─── C.2 Remote User Provisioning ─────────────────────────────────────────
  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  async createAccount(
    @Body() body: CreateAccountDto,
    @Req() req: express.Request,
  ) {
    if (!body?.username || !body?.full_name) {
      throw new BadRequestException('username และ full_name เป็นข้อมูลจำเป็น');
    }
    const ip = this.getClientIp(req);
    return await this.directoryService.createAccount(body, ip);
  }

  // ─── C.3 1-Click Offboarding & Reactivate ──────────────────────────────────
  @Patch('accounts/:username/status')
  async updateAccountStatus(
    @Param('username') username: string,
    @Body() body: UpdateStatusDto,
    @Req() req: express.Request,
  ) {
    if (typeof body?.is_active !== 'boolean') {
      throw new BadRequestException('is_active ต้องเป็นค่า boolean (true หรือ false)');
    }
    const ip = this.getClientIp(req);
    return await this.directoryService.updateAccountStatus(username, body, ip);
  }
}
