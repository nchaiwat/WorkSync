import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as express from 'express';
import { Role } from '@prisma/client';

@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

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

  // ─── Admin Settings Channel ─────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get(['settings/ai', 'api/settings/ai'])
  async getAiSettings(@Req() req: express.Request) {
    this.checkAdmin(req);
    const settings = await this.aiService.getAiConfig();
    return {
      status: 'success',
      settings,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put(['settings/ai', 'api/settings/ai'])
  async updateAiSettings(@Body() body: any, @Req() req: express.Request) {
    const user = this.checkAdmin(req);
    const ip = this.getClientIp(req);
    return await this.aiService.updateAiConfig(body, user.username || 'admin', ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post(['settings/ai/test', 'api/settings/ai/test'])
  async testAiConnection(@Req() req: express.Request) {
    this.checkAdmin(req);
    return await this.aiService.testAiConnection();
  }

  // ─── Public/User Chat Endpoint ──────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post(['ai/chat', 'api/ai/chat'])
  async chatWithCopilot(@Body() body: { messages: { role: string; content: string }[] }, @Req() req: express.Request) {
    const user = req.user as any;
    if (!body?.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      throw new BadRequestException('messages เป็นข้อมูลจำเป็น');
    }
    return await this.aiService.chat(body.messages, user);
  }
}
