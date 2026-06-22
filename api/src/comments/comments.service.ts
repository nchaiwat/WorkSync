import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Comment } from '@prisma/client';
import { TelegramService } from '../telegram/telegram.service';
import { UsersService } from '../users/users.service';

function notifyHeader(): string {
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
  return `🔄 <b>WorkSync</b>  ·  ${dateStr} ${timeStr} น.\n${'─'.repeat(28)}`;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly usersService: UsersService,
  ) {}

  private async resolveTelegramId(name: string): Promise<string | null> {
    if (!name || name.trim() === '') return null;
    const clean = name.trim();
    const allUsers = await this.usersService.findAll();
    const user = allUsers.find(u => {
      const formatted = (() => {
        const nick = u.nickname ? `${u.nickname} ` : '';
        const first = u.firstName || u.username || '';
        const dept = u.department || 'IT';
        return `${nick}(${first})/${dept}`;
      })();

      return (
        clean === formatted ||
        clean === u.firstName ||
        clean === u.username ||
        `${u.firstName} ${u.lastName}` === clean ||
        (u.firstName && clean.includes(`(${u.firstName})`)) ||
        (u.username && clean.includes(`(${u.username})`)) ||
        (u.nickname && clean.startsWith(u.nickname))
      );
    });

    return user?.telegramId || null;
  }

  async create(data: { task: string; user: string; message: string; updateKey?: string }): Promise<Comment> {
    const task = await this.prisma.task.findUnique({
      where: { id: data.task },
    });
    if (!task) {
      throw new NotFoundException('ไม่พบงานที่ต้องการคอมเมนต์');
    }

    const comment = await this.prisma.comment.create({
      data: {
        task: data.task,
        user: data.user,
        message: data.message,
        updateKey: data.updateKey || null,
      },
    });

    // ── Notify Assignee (Task Owner) on new comment ──
    try {
      const assigneeTelegramId = await this.resolveTelegramId(task.assignee);
      if (assigneeTelegramId) {
        // Resolve the commenter's details to see if they are the assignee themselves
        const allUsers = await this.usersService.findAll();
        const commenterUser = allUsers.find(
          u => u.username === data.user || u.firstName === data.user || `${u.firstName} ${u.lastName}` === data.user
        );

        const commenterTelegramId = commenterUser?.telegramId;
        const isCommenterAssignee = commenterTelegramId && commenterTelegramId === assigneeTelegramId;

        // Skip sending notification if assignee is commenting on their own task
        if (!isCommenterAssignee) {
          const message =
            `${notifyHeader()}\n` +
            `💬 <b>มีคนแสดงความคิดเห็นในงานของคุณ!</b>\n\n` +
            `📌 <b>หัวข้อ:</b> ${task.title}\n` +
            `👤 <b>ผู้เขียน:</b> ${data.user}\n` +
            `📝 <b>ข้อความ:</b>\n${data.message}`;

          await this.telegramService.sendDirectMessage(assigneeTelegramId, message);
        }
      }
    } catch (err: any) {
      // Fail silently to avoid blocking comment creation if telegram notification fails
      console.error(`Failed to send Telegram notification for comment: ${err.message}`);
    }

    return comment;
  }

  async findAllByTaskId(taskId: string): Promise<Comment[]> {
    return this.prisma.comment.findMany({
      where: { task: taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(id: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException('ไม่พบคอมเมนต์');
    }
    await this.prisma.comment.delete({ where: { id } });
  }
}
