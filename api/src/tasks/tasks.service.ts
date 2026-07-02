import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Task } from '@prisma/client';
import { TelegramService } from '../telegram/telegram.service';
import { UsersService } from '../users/users.service';

const STATUS_LABELS: Record<string, string> = {
  todo: '📋 รอดำเนินการ',
  in_progress: '🔄 กำลังดำเนินการ',
  review: '🔍 รอตรวจสอบ',
  done: '✅ เสร็จสิ้น',
};

/** Generate a consistent app header with current Thai date/time */
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
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly usersService: UsersService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Look up Telegram IDs for a list of display-name strings (first_name or username).
   * Returns only non-empty Telegram IDs from users who have one.
   */
  private async resolveTelegramIds(names: string[]): Promise<string[]> {
    const allUsers = await this.usersService.findAll();
    const ids: string[] = [];

    for (const name of names) {
      if (!name || name.trim() === '') continue;
      const clean = name.trim();
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

      if (user?.telegramId && user.telegramId.trim() !== '') {
        ids.push(user.telegramId.trim());
      }
    }
    return [...new Set(ids)]; // deduplicate
  }

  /**
   * Collect all Telegram IDs to notify for a task (manager + collaborators).
   * Excludes IDs with no Telegram ID in their profile.
   */
  private async getTaskNotifyIds(task: Task): Promise<string[]> {
    const names: string[] = [];
    if (task.manager && task.manager.trim()) names.push(task.manager.trim());

    // collaborators is stored as JSON array of name strings
    let collabs: string[] = [];
    if (task.collaborators) {
      try {
        collabs = Array.isArray(task.collaborators)
          ? (task.collaborators as string[])
          : JSON.parse(task.collaborators as string);
      } catch {
        collabs = [];
      }
    }
    names.push(...collabs.filter(Boolean));

    return this.resolveTelegramIds(names);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  /**
   * Collect Telegram IDs for all users involved in a task:
   * Creator, Assignee, Manager, and Collaborators.
   */
  async getAllInvolvedTelegramIds(task: Task): Promise<string[]> {
    const names: string[] = [];
    if (task.assignee && task.assignee.trim()) names.push(task.assignee.trim());
    if (task.manager && task.manager.trim()) names.push(task.manager.trim());

    if (task.createdBy) {
      const creator = await this.usersService.findOneById(task.createdBy).catch(() => null);
      if (creator) {
        const formatted = (() => {
          const nick = creator.nickname ? `${creator.nickname} ` : '';
          const first = creator.firstName || creator.username || '';
          const dept = creator.department || 'IT';
          return `${nick}(${first})/${dept}`;
        })();
        names.push(formatted);
      }
    }

    let collabs: string[] = [];
    if (task.collaborators) {
      try {
        collabs = Array.isArray(task.collaborators)
          ? (task.collaborators as string[])
          : JSON.parse(task.collaborators as string);
      } catch {
        collabs = [];
      }
    }
    names.push(...collabs.filter(Boolean));

    return this.resolveTelegramIds(names);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(data: any): Promise<Task> {
    const task = await this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        progress: Number(data.progress) || 0,
        deadline: data.deadline ? new Date(data.deadline) : null,
        avatarUrl: data.avatar_url,
        collaborators: data.collaborators || [],
        createdBy: data.created_by,
        latestUpdate: data.latest_update || null,
        assignee: data.assignee,
        manager: data.manager,
        projectOwner: data.project_owner || null,
        previousProgress: 0,
      },
    });

    // ── Notify Manager & Colleagues in the background ──
    this.getTaskNotifyIds(task)
      .then(async (notifyIds) => {
        if (notifyIds.length > 0) {
          const deadlineStr = task.deadline
            ? task.deadline.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
            : 'ไม่กำหนด';

          const collabList = (() => {
            try { return Array.isArray(task.collaborators) ? task.collaborators : JSON.parse(task.collaborators as string); }
            catch { return []; }
          })();

          const message =
            `${notifyHeader()}\n` +
            `🆕 <b>มีงานใหม่ที่เกี่ยวข้องกับคุณ!</b>\n\n` +
            `📌 <b>หัวข้อ:</b> ${task.title}\n` +
            `👤 <b>ผู้รับผิดชอบ:</b> ${task.assignee}\n` +
            `📊 <b>Progress:</b> ${task.progress}%\n` +
            (task.manager ? `👔 <b>Manager:</b> ${task.manager}\n` : '') +
            (collabList.length > 0 ? `👥 <b>เพื่อนร่วมงาน:</b> ${collabList.join(', ')}\n` : '') +
            `📅 <b>กำหนดส่ง:</b> ${deadlineStr}\n` +
            `⚙️ <b>สถานะ:</b> ${STATUS_LABELS[task.status] || task.status}`;

          await this.telegramService.broadcastNotification(notifyIds, message);
        }
      })
      .catch((err) => {
        console.error(`Failed to send Telegram notification for new task: ${err.message}`);
      });

    return task;
  }

  async findAll(filters?: { status?: string; assignee?: string; isArchived?: boolean }): Promise<any[]> {
    const whereClause: any = {};
    if (filters?.status) whereClause.status = filters.status;
    if (filters?.assignee) whereClause.assignee = filters.assignee;
    
    // Default isArchived to false unless explicitly filtered
    whereClause.isArchived = filters?.isArchived !== undefined ? filters.isArchived : false;

    return this.prisma.task.findMany({
      where: whereClause,
      include: {
        likes: {
          include: {
            user: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<any> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        likes: {
          include: {
            user: true
          }
        }
      }
    });
    if (!task) throw new NotFoundException('ไม่พบงานที่ระบุ');
    return task;
  }

  async update(id: string, data: any): Promise<Task> {
    const oldTask = await this.findOne(id);

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.progress !== undefined) {
      const newProgress = Number(data.progress);
      if (newProgress !== oldTask.progress) {
        updateData.progress = newProgress;
        updateData.previousProgress = oldTask.progress;
      }
    }
    if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null;
    if (data.avatar_url !== undefined) updateData.avatarUrl = data.avatar_url;
    if (data.collaborators !== undefined) updateData.collaborators = data.collaborators;
    if (data.assignee !== undefined) updateData.assignee = data.assignee;
    if (data.manager !== undefined) updateData.manager = data.manager;
    if (data.latest_update !== undefined) updateData.latestUpdate = data.latest_update;
    if (data.project_owner !== undefined) updateData.projectOwner = data.project_owner;
    if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;
    if (data.archiveReason !== undefined) updateData.archiveReason = data.archiveReason;

    const task = await this.prisma.task.update({ where: { id }, data: updateData });

    // ── Notify on Archive or normal changes ──
    const archivedChanged = data.isArchived !== undefined && data.isArchived !== oldTask.isArchived;

    if (archivedChanged && task.isArchived) {
      this.getAllInvolvedTelegramIds(task)
        .then(async (notifyIds) => {
          if (notifyIds.length > 0) {
            const creatorUser = task.createdBy ? await this.usersService.findOneById(task.createdBy).catch(() => null) : null;
            const creatorName = creatorUser ? `${creatorUser.nickname || creatorUser.firstName}` : (task.createdBy || 'ไม่ระบุ');
            const message =
              `${notifyHeader()}\n` +
              `📦 <b>เจ้าของโครงการได้เก็บถาวรงาน (Archive)!</b>\n\n` +
              `📌 <b>หัวข้อ:</b> ${task.title}\n` +
              `👤 <b>ผู้รับผิดชอบ:</b> ${task.assignee}\n` +
              `👤 <b>เจ้าของงาน (Owner):</b> ${creatorName}\n` +
              `💬 <b>เหตุผลการเก็บถาวร:</b> ${task.archiveReason || 'ไม่ระบุ'}`;

            await this.telegramService.broadcastNotification(notifyIds, message);
          }
        })
        .catch((err) => {
          console.error(`Failed to send Telegram notification for task archive: ${err.message}`);
        });
    } else {
      // ── Notify on Status, Progress, or Latest Update change ──
      const statusChanged = data.status !== undefined && data.status !== oldTask.status;
      const progressChanged = data.progress !== undefined && Number(data.progress) !== oldTask.progress;
      const latestUpdateChanged = data.latest_update !== undefined && data.latest_update !== oldTask.latestUpdate;

      if (statusChanged || progressChanged || latestUpdateChanged) {
        this.getTaskNotifyIds(task)
          .then(async (notifyIds) => {
            if (notifyIds.length > 0) {
              const changes: string[] = [];
              if (statusChanged) {
                changes.push(`⚙️ <b>สถานะ:</b> ${STATUS_LABELS[oldTask.status] || oldTask.status} → ${STATUS_LABELS[task.status] || task.status}`);
              }
              if (progressChanged) {
                changes.push(`📊 <b>ความคืบหน้า:</b> ${oldTask.progress}% → ${task.progress}%`);
              }
              if (latestUpdateChanged && task.latestUpdate) {
                const sections = task.latestUpdate.split(/---\r?\n|---/g);
                const firstSection = sections[0]?.trim() || '';
                const cleanText = firstSection.replace(/^\[[^\]]+\]/, '').trim();
                if (cleanText) {
                  const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
                  const formattedText = cleanText.replace(
                    /\[attachment:([^|\]]+)\|name:([^\]]+)\]/g,
                    (match, url, name) => {
                      const absoluteUrl = url.startsWith('http') ? url : `${backendUrl}${url}`;
                      return `📎 <a href="${absoluteUrl}">${name}</a>`;
                    }
                  );
                  changes.push(`📝 <b>ความคืบหน้าล่าสุด:</b>\n${formattedText}`);
                }
              }

              const message =
                `${notifyHeader()}\n` +
                `📈 <b>อัปเดตงาน!</b>\n\n` +
                `📌 <b>หัวข้อ:</b> ${task.title}\n` +
                `👤 <b>ผู้รับผิดชอบ:</b> ${task.assignee}\n` +
                `📊 <b>Progress:</b> ${task.progress}%\n` +
                changes.join('\n');

              await this.telegramService.broadcastNotification(notifyIds, message);
            }
          })
          .catch((err) => {
            console.error(`Failed to send Telegram notification for task update: ${err.message}`);
          });
      }
    }

    return task;
  }

  async notifyTaskDeleted(task: Task, deleterName: string, reason: string): Promise<void> {
    const notifyIds = await this.getAllInvolvedTelegramIds(task);
    if (notifyIds.length > 0) {
      const message =
        `${notifyHeader()}\n` +
        `🗑️ <b>งานถูกลบแล้ว (Deleted)!</b>\n\n` +
        `📌 <b>หัวข้อ:</b> ${task.title}\n` +
        `👤 <b>ผู้รับผิดชอบ:</b> ${task.assignee}\n` +
        `👤 <b>ผู้ลบงาน:</b> ${deleterName}\n` +
        `💬 <b>เหตุผลการลบ:</b> ${reason || 'ไม่ระบุ'}`;

      await this.telegramService.broadcastNotification(notifyIds, message);
    }
  }

  async toggleLike(taskId: string, userId: string): Promise<any> {
    const existing = await this.prisma.taskLike.findUnique({
      where: {
        taskId_userId: { taskId, userId }
      }
    });

    if (existing) {
      await this.prisma.taskLike.delete({
        where: {
          taskId_userId: { taskId, userId }
        }
      });
    } else {
      await this.prisma.taskLike.create({
        data: {
          taskId,
          userId
        }
      });
    }

    return this.findOne(taskId);
  }

  async markAsRead(taskId: string, userId: string): Promise<void> {
    await this.prisma.taskRead.upsert({
      where: {
        taskId_userId: { taskId, userId }
      },
      update: {
        readAt: new Date()
      },
      create: {
        taskId,
        userId,
        readAt: new Date()
      }
    });
  }

  async getReadMapForUser(userId: string, taskIds: string[]): Promise<Map<string, Date>> {
    const reads = await this.prisma.taskRead.findMany({
      where: {
        userId,
        taskId: { in: taskIds }
      }
    });
    return new Map(reads.map(r => [r.taskId, r.readAt]));
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });
  }
}
