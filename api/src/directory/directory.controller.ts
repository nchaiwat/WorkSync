import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { DirectoryService, CreateAccountDto, UpdateStatusDto } from './directory.service';
import { CiamM2mGuard } from './ciam-m2m.guard';
import { CIAM_FRAMEWORK_VERSION, extractCiamOriginIp } from '../common/ip.util';
import * as express from 'express';

@Controller(['api/v1/directory', 'v1/directory', 'api/directory', 'directory'])
@UseGuards(CiamM2mGuard)
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  private getClientIp(req: express.Request): string {
    return (req as any).ciamOriginIp || extractCiamOriginIp(req);
  }

  // ─── C.1 Directory Accounts (Ping, Health Check & 04:00 AM Sync) ───────────
  @Get('accounts')
  async listAccounts(
    @Res({ passthrough: true }) res: express.Response,
    @Query('status') status?: string,
    @Query('department') department?: string,
    @Query('search') search?: string,
  ) {
    res.setHeader('X-CIAM-Framework-Version', CIAM_FRAMEWORK_VERSION);
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
