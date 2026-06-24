import { Controller, Get, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoginLogsService } from './login-logs.service';
import { Role } from '@prisma/client';
import * as express from 'express';

@Controller('admin/login-logs')
export class LoginLogsController {
  constructor(private readonly loginLogsService: LoginLogsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getLoginLogs(@Req() req: express.Request) {
    const currentUser = req.user as any;
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถดูประวัติการเข้าใช้งานได้');
    }
    const logs = await this.loginLogsService.findAll();
    return { data: logs };
  }
}
