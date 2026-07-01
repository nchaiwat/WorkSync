import { Controller, Post, Body, UseGuards, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';
import * as express from 'express';

@Controller('admin/telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @UseGuards(JwtAuthGuard)
  @Post('test')
  async testTelegram(@Body() body: any, @Req() req: express.Request) {
    const user = req.user as any;
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบเท่านั้นที่ทำรายการนี้ได้');
    }

    const { telegramId, message } = body;
    if (!telegramId || !telegramId.trim()) {
      throw new BadRequestException('กรุณาระบุ Telegram ID');
    }
    if (!message || !message.trim()) {
      throw new BadRequestException('กรุณาระบุข้อความสำหรับทดสอบ');
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Bangkok',
    });
    const timeStr = now.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok',
    });
    const header = `🔄 <b>WorkSync</b>  ·  ${dateStr} ${timeStr} น.\n${'─'.repeat(28)}\n`;
    const testMessage = `${header}🤖 <b>ระบบทดสอบการส่ง Telegram (WorkSync)</b>\n\n📝 ${message.trim()}`;
    await this.telegramService.sendDirectMessage(telegramId.trim(), testMessage);

    return { data: { success: true } };
  }
}
