import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as express from 'express';

@Controller(['notifications', 'api/notifications'])
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(@Req() req: express.Request) {
    const user = req.user as any;
    return await this.notificationsService.getUserNotifications(user.id);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: express.Request) {
    const user = req.user as any;
    await this.notificationsService.markAsRead(user.id, id);
    return { success: true };
  }

  @Post('read-all')
  async markAllRead(@Req() req: express.Request) {
    const user = req.user as any;
    await this.notificationsService.markAllAsRead(user.id);
    return { success: true };
  }
}
