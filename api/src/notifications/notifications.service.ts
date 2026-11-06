import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserNotifications(userId: string) {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        user_id: n.userId,
        title: n.title,
        message: n.message,
        link: n.link,
        is_read: n.isRead,
        created_at: n.createdAt.toISOString(),
      })),
      unread_count: unreadCount,
    };
  }

  async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    link?: string;
  }) {
    try {
      return await this.prisma.notification.create({
        data: {
          userId: data.userId,
          title: data.title,
          message: data.message,
          link: data.link || null,
          isRead: false,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to create notification: ${err.message}`);
      return null;
    }
  }

  async markAsRead(userId: string, id: string) {
    return await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async scanAndNotifyMentions(text: string, senderName: string, taskId: string, taskTitle: string) {
    if (!text || !text.includes('@')) return;

    // Match @username or @firstname or @"full name"
    const regex = /@([a-zA-Z0-9._-]+)/g;
    let match;
    const mentionedKeys = new Set<string>();

    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        mentionedKeys.add(match[1].toLowerCase());
      }
    }

    if (mentionedKeys.size === 0) return;

    const allUsers = await this.prisma.user.findMany({
      select: { id: true, username: true, firstName: true, nickname: true },
    });

    for (const user of allUsers) {
      const uLower = user.username.toLowerCase();
      const fnLower = (user.firstName || '').toLowerCase();
      const nickLower = (user.nickname || '').toLowerCase();

      const isMentioned =
        mentionedKeys.has(uLower) ||
        (fnLower && mentionedKeys.has(fnLower)) ||
        (nickLower && mentionedKeys.has(nickLower));

      if (isMentioned) {
        await this.createNotification({
          userId: user.id,
          title: `💬 ${senderName} ได้กล่าวถึงคุณ`,
          message: `ในภารกิจ "${taskTitle}": ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`,
          link: `/?task=${taskId}`,
        });
      }
    }
  }
}
