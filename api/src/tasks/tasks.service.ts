import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Task } from '@prisma/client';
import { TelegramService } from '../telegram/telegram.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Subject, Observable } from 'rxjs';

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
export class TasksService implements OnModuleInit {
  private readonly events$ = new Subject<{ type: string; data?: any }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  emitTaskEvent(type: string, data?: any) {
    this.events$.next({ type, data });
  }

  getEventStream(): Observable<{ type: string; data?: any }> {
    return this.events$.asObservable();
  }

  onModuleInit() {
    // Run reminder check every 30 minutes
    const THIRTY_MINUTES = 30 * 60 * 1000;
    setTimeout(() => {
      this.checkAndSendDeadlineReminders().catch(console.error);
      setInterval(() => {
        this.checkAndSendDeadlineReminders().catch(console.error);
      }, THIRTY_MINUTES);
    }, 60000);
  }

  /**
   * Log an activity item to the task timeline
   */
  async logActivity(taskId: string, userName: string, action: string, details: string): Promise<void> {
    try {
      await this.prisma.taskActivity.create({
        data: {
          taskId,
          userName: userName || 'System',
          action,
          details,
        },
      });
    } catch (err: any) {
      console.error(`Failed to log task activity: ${err.message}`);
    }
  }

  /**
   * Checks tasks due within 24 hours and sends a Telegram reminder to the assignee
   */
  async checkAndSendDeadlineReminders(): Promise<void> {
    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);

      const urgentTasks = await this.prisma.task.findMany({
        where: {
          isArchived: false,
          status: { not: 'done' },
          deadline: {
            not: null,
            lte: in24Hours,
          },
          OR: [
            { lastReminderSentAt: null },
            { lastReminderSentAt: { lte: twentyHoursAgo } },
          ],
        },
      });

      for (const task of urgentTasks) {
        if (!task.deadline) continue;
        const assigneeIds = await this.resolveTelegramIds([task.assignee]);
        if (assigneeIds.length === 0) continue;

        const isToday = task.deadline.toDateString() === now.toDateString();
        const isPastDue = task.deadline.getTime() < now.getTime();
        const timingText = isPastDue
          ? '⚠️ <b>ภารกิจนี้เกินกำหนดส่งแล้ว!</b>'
          : isToday
          ? '⏰ <b>ภารกิจนี้ครบกำหนดส่งในวันนี้!</b>'
          : '⏰ <b>ภารกิจนี้ใกล้ถึงกำหนดส่ง (พรุ่งนี้)!</b>';

        const deadlineStr = task.deadline.toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'Asia/Bangkok',
        });

        const reminderMsg =
          `${notifyHeader()}\n` +
          `${timingText}\n\n` +
          `📌 <b>หัวข้อ:</b> ${task.title}\n` +
          `👤 <b>ผู้รับผิดชอบ:</b> ${task.assignee}\n` +
          `📊 <b>Progress:</b> ${task.progress}%\n` +
          `📅 <b>กำหนดส่ง:</b> ${deadlineStr}\n` +
          `⚙️ <b>สถานะ:</b> ${STATUS_LABELS[task.status] || task.status}\n\n` +
          `👉 กรุณาเข้าสู่ระบบ WorkSync เพื่ออัปเดตความคืบหน้าของงานครับ`;

        await this.telegramService.broadcastNotification(assigneeIds, reminderMsg);

        await this.prisma.task.update({
          where: { id: task.id },
          data: { lastReminderSentAt: new Date() },
        });

        await this.logActivity(
          task.id,
          'WorkSync Bot',
          'reminder',
          `ส่งการแจ้งเตือนเตือนกำหนดส่งไปยัง Telegram ของ ${task.assignee}`,
        );
      }
    } catch (err: any) {
      console.error(`Error in checkAndSendDeadlineReminders: ${err.message}`);
    }
  }

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
        subtasks: data.subtasks || [],
        recurrence: data.recurrence || 'none',
        previousProgress: 0,
      },
    });

    // ── Activity Log ──
    const creatorUser = task.createdBy
      ? await this.usersService.findOneById(task.createdBy).catch(() => null)
      : null;
    const creatorDisplayName = creatorUser
      ? (creatorUser.nickname ? `${creatorUser.nickname} (${creatorUser.firstName})` : creatorUser.firstName)
      : (task.assignee || 'ผู้สร้างงาน');

    await this.logActivity(task.id, creatorDisplayName, 'created', 'สร้างภารกิจใหม่');

    // ── Smart Telegram Notification (Assignee / Manager / Collaborators) ──
    (async () => {
      try {
        const creator = task.createdBy
          ? await this.usersService.findOneById(task.createdBy).catch(() => null)
          : null;
        const creatorDisplayName = creator
          ? (() => {
              const nick = creator.nickname ? `${creator.nickname} ` : '';
              const first = creator.firstName || creator.username || '';
              const dept = creator.department || 'IT';
              return `${nick}(${first})/${dept}`;
            })()
          : 'หัวหน้างาน / ผู้มอบหมาย';

        const isSelfTask = creator && (
          task.assignee === creator.firstName ||
          task.assignee === creator.username ||
          task.assignee === `${creator.firstName} ${creator.lastName}` ||
          (creator.firstName && task.assignee.includes(`(${creator.firstName})`)) ||
          (creator.username && task.assignee.includes(`(${creator.username})`)) ||
          (creator.nickname && task.assignee.startsWith(creator.nickname))
        );

        const deadlineStr = task.deadline
          ? task.deadline.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'ไม่กำหนด';

        const collabList = (() => {
          try { return Array.isArray(task.collaborators) ? task.collaborators : JSON.parse(task.collaborators as string); }
          catch { return []; }
        })();

        if (!isSelfTask) {
          // 1. Notify Assignee that a task was assigned to them
          const assigneeIds = await this.resolveTelegramIds([task.assignee]);
          if (assigneeIds.length > 0) {
            const assignMessage =
              `${notifyHeader()}\n` +
              `🎯 <b>คุณได้รับมอบหมายงานใหม่!</b>\n\n` +
              `📌 <b>หัวข้อ:</b> ${task.title}\n` +
              `👔 <b>ผู้มอบหมาย:</b> ${creatorDisplayName}\n` +
              `👤 <b>ผู้รับผิดชอบ:</b> ${task.assignee}\n` +
              `📊 <b>Progress:</b> ${task.progress}%\n` +
              (task.manager ? `👔 <b>Manager:</b> ${task.manager}\n` : '') +
              (collabList.length > 0 ? `👥 <b>เพื่อนร่วมงาน:</b> ${collabList.join(', ')}\n` : '') +
              `📅 <b>กำหนดส่ง:</b> ${deadlineStr}\n` +
              `⚙️ <b>สถานะ:</b> ${STATUS_LABELS[task.status] || task.status}`;

            await this.telegramService.broadcastNotification(assigneeIds, assignMessage);
          }

          // 2. Notify collaborators & manager (excluding assignee and creator)
          const otherNames: string[] = [];
          if (task.manager) otherNames.push(task.manager);
          otherNames.push(...collabList);
          const otherIds = (await this.resolveTelegramIds(otherNames)).filter(
            id => !assigneeIds.includes(id) && id !== creator?.telegramId
          );

          if (otherIds.length > 0) {
            const teamMessage =
              `${notifyHeader()}\n` +
              `📋 <b>มีการมอบหมายงานใหม่ในทีม!</b>\n\n` +
              `📌 <b>หัวข้อ:</b> ${task.title}\n` +
              `👔 <b>ผู้มอบหมาย:</b> ${creatorDisplayName}\n` +
              `👤 <b>ผู้รับผิดชอบ:</b> ${task.assignee}\n` +
              `📊 <b>Progress:</b> ${task.progress}%\n` +
              (task.manager ? `👔 <b>Manager:</b> ${task.manager}\n` : '') +
              (collabList.length > 0 ? `👥 <b>เพื่อนร่วมงาน:</b> ${collabList.join(', ')}\n` : '') +
              `📅 <b>กำหนดส่ง:</b> ${deadlineStr}\n` +
              `⚙️ <b>สถานะ:</b> ${STATUS_LABELS[task.status] || task.status}`;

            await this.telegramService.broadcastNotification(otherIds, teamMessage);
          }
        } else {
          // Self-created task: notify Manager & Colleagues
          const notifyIds = await this.getTaskNotifyIds(task);
          if (notifyIds.length > 0) {
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
        }
      } catch (err: any) {
        console.error(`Failed to send Telegram notification for new task: ${err.message}`);
      }
    })();

    this.emitTaskEvent('TASK_CREATED', { id: task.id });
    return task;
  }

  async findAll(filters?: { status?: string; assignee?: string; isArchived?: boolean; createdBy?: string }): Promise<any[]> {
    const whereClause: any = {};
    if (filters?.status) whereClause.status = filters.status;
    if (filters?.assignee) whereClause.assignee = filters.assignee;
    if (filters?.createdBy) whereClause.createdBy = filters.createdBy;
    
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
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        }
      }
    });
    if (!task) throw new NotFoundException('ไม่พบงานที่ระบุ');
    return task;
  }

  async update(id: string, data: any, updaterName?: string): Promise<Task> {
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
    if (data.subtasks !== undefined) updateData.subtasks = data.subtasks;
    if (data.recurrence !== undefined) updateData.recurrence = data.recurrence;

    const task = await this.prisma.task.update({ where: { id }, data: updateData });

    // ── Log Activity Timeline ──
    const actor = updaterName || task.assignee || 'ผู้ใช้งาน';
    const statusChanged = data.status !== undefined && data.status !== oldTask.status;
    const progressChanged = data.progress !== undefined && Number(data.progress) !== oldTask.progress;
    const latestUpdateChanged = data.latest_update !== undefined && data.latest_update !== oldTask.latestUpdate;
    const subtasksChanged = data.subtasks !== undefined;

    if (statusChanged) {
      await this.logActivity(task.id, actor, 'status_change', `เปลี่ยนสถานะเป็น ${STATUS_LABELS[task.status] || task.status}`);
    }
    if (progressChanged) {
      await this.logActivity(task.id, actor, 'progress_change', `ปรับความคืบหน้าเป็น ${task.progress}%`);
    }
    if (latestUpdateChanged) {
      await this.logActivity(task.id, actor, 'update_log', 'บันทึกอัปเดตความคืบหน้า');
    }
    if (subtasksChanged) {
      await this.logActivity(task.id, actor, 'subtask_toggle', 'อัปเดตรายการงานย่อย (Checklist)');
    }
    if (data.deadline !== undefined) {
      const dStr = task.deadline ? task.deadline.toLocaleDateString('th-TH') : 'ไม่ระบุ';
      await this.logActivity(task.id, actor, 'deadline_change', `เปลี่ยนกำหนดส่งเป็น ${dStr}`);
    }

    // ── Handle Recurring Tasks Auto-generation ──
    const becameDone = statusChanged && task.status === 'done';
    if (becameDone && task.recurrence && task.recurrence !== 'none') {
      const nextDeadline = (() => {
        const baseDate = task.deadline ? new Date(task.deadline) : new Date();
        const next = new Date(baseDate);
        if (task.recurrence === 'daily') {
          next.setDate(next.getDate() + 1);
        } else if (task.recurrence === 'weekly') {
          next.setDate(next.getDate() + 7);
        } else if (task.recurrence === 'monthly') {
          next.setMonth(next.getMonth() + 1);
        }
        return next;
      })();

      // Reset subtasks for next cycle
      let resetSubtasks: any[] = [];
      if (task.subtasks) {
        try {
          const raw = Array.isArray(task.subtasks) ? task.subtasks : JSON.parse(task.subtasks as string);
          resetSubtasks = raw.map((s: any) => ({ ...s, completed: false }));
        } catch {
          resetSubtasks = [];
        }
      }

      const nextTask = await this.prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          status: 'todo',
          priority: task.priority,
          progress: 0,
          previousProgress: 0,
          deadline: nextDeadline,
          avatarUrl: task.avatarUrl,
          collaborators: task.collaborators || [],
          createdBy: task.createdBy,
          assignee: task.assignee,
          manager: task.manager,
          projectOwner: task.projectOwner,
          recurrence: task.recurrence,
          subtasks: resetSubtasks,
        },
      });

      const recurrenceLabel = task.recurrence === 'daily' ? 'รายวัน' : task.recurrence === 'weekly' ? 'รายสัปดาห์' : 'รายเดือน';
      await this.logActivity(
        task.id,
        'WorkSync Bot',
        'recurrence',
        `สร้างภารกิจรอบถัดไป (${recurrenceLabel}) สำเร็จ`,
      );

      await this.logActivity(
        nextTask.id,
        'WorkSync Bot',
        'created',
        `สร้างอัตโนมัติตามรอบ (${recurrenceLabel}) กำหนดส่ง ${nextDeadline.toLocaleDateString('th-TH')}`,
      );
    }

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

    if (data.latest_update) {
      this.notificationsService.scanAndNotifyMentions(
        data.latest_update,
        updaterName || 'เพื่อนร่วมงาน',
        task.id,
        task.title,
      ).catch(() => {});
    }

    this.emitTaskEvent('TASK_UPDATED', { id: task.id });
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

  async addLike(taskId: string, userId: string, targetType: string, targetId: string): Promise<any> {
    const existing = await this.prisma.taskLike.findFirst({
      where: {
        taskId,
        userId,
        targetType,
        targetId
      }
    });

    if (!existing) {
      await this.prisma.taskLike.create({
        data: {
          taskId,
          userId,
          targetType,
          targetId
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
    this.emitTaskEvent('TASK_DELETED', { id });
  }
}
