import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do (รอดำเนินการ)',
  in_progress: 'Doing (กำลังทำ)',
  review: 'Review (รอตรวจสอบ)',
  done: 'Done (เสร็จสิ้น)',
};

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    // Check every 60 seconds for daily digest schedule
    setInterval(() => {
      this.checkAndSendDailyDigests().catch((err) => {
        this.logger.error(`Error in daily digest runner: ${err.message}`);
      });
    }, 60000);
  }

  async getTransporter() {
    const host = await this.settingsService.get('smtp_host', 'smtp.gmail.com');
    const port = await this.settingsService.getNumber('smtp_port', 587);
    const user = await this.settingsService.get('smtp_sender_email', 'itwindowasia@gmail.com');
    const pass = await this.settingsService.getRawSmtpPassword();
    const secure = port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const sender = await this.settingsService.get('smtp_sender_email', 'itwindowasia@gmail.com');
      const transporter = await this.getTransporter();
      await transporter.sendMail({
        from: `"WorkSync" <${sender}>`,
        to,
        subject,
        html,
      });
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
      throw err;
    }
  }

  async testSmtp(testRecipient: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.sendMail(
        testRecipient,
        '🧪 ทดสอบการเชื่อมต่อระบบอีเมล WorkSync',
        `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 28px; background: #f8fafc; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <div style="background: #007AFF; color: #fff; width: 32px; height: 32px; border-radius: 8px; text-align: center; line-height: 32px; font-weight: bold;">W</div>
            <span style="font-size: 18px; font-weight: bold; color: #0f172a;">WorkSync</span>
          </div>
          <h2 style="color: #007AFF; margin-top: 0;">การเชื่อมต่อ SMTP สำเร็จ!</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">ยินดีด้วยครับ ระบบส่งอีเมล (SMTP Config) ของ WorkSync พร้อมใช้งานสำหรับส่งแจ้งเตือนและส่งรายงานสรุปงานประจำวันแล้วครับ</p>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
            ทดสอบเมื่อ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
          </div>
        </div>`
      );
      return { success: true, message: 'ส่งอีเมลทดสอบสำเร็จแล้ว' };
    } catch (err: any) {
      return { success: false, message: err.message || 'ส่งอีเมลทดสอบไม่สำเร็จ กรุณาตรวจสอบ SMTP Host/Port/Password' };
    }
  }

  async checkAndSendDailyDigests(): Promise<void> {
    try {
      const now = new Date();
      // Format current time in Asia/Bangkok as "HH:mm"
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Bangkok',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD

      // Find users who enabled digest and have valid email
      const users = await this.prisma.user.findMany({
        where: {
          emailDigestEnabled: true,
          email: { not: null },
          status: 'active',
        },
      });

      for (const u of users) {
        if (!u.email) continue;
        const targetTime = u.emailDigestTime || '08:30';

        // Check if time matches current minute
        if (targetTime !== timeStr) continue;

        // Check if already sent today
        if (u.lastDigestSentAt) {
          const lastSentDateStr = new Date(u.lastDigestSentAt).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Bangkok',
          });
          if (lastSentDateStr === todayDateStr) {
            continue; // Already sent today
          }
        }

        // Send digest email to this user
        await this.generateAndSendDigest(u);
      }
    } catch (err: any) {
      this.logger.error(`Failed to process daily digests: ${err.message}`);
    }
  }

  private async generateAndSendDigest(user: any): Promise<void> {
    try {
      const allTasks = await this.prisma.task.findMany({
        where: { isArchived: false },
        orderBy: { deadline: 'asc' },
      });

      const userDisplayName = user.nickname
        ? `${user.nickname} (${user.firstName})`
        : user.firstName || user.username;

      // Filter tasks for user
      const myTasks = allTasks.filter(t => 
        t.assignee && (
          t.assignee === userDisplayName ||
          t.assignee === user.firstName ||
          t.assignee === user.username ||
          (user.firstName && t.assignee.includes(`(${user.firstName})`)) ||
          (user.username && t.assignee.includes(`(${user.username})`))
        )
      );

      const assignedByMe = allTasks.filter(t =>
        t.createdBy === user.id &&
        t.assignee &&
        t.assignee !== userDisplayName &&
        t.assignee !== user.firstName
      );

      const involvedTasks = allTasks.filter(t =>
        t.createdBy !== user.id &&
        !myTasks.includes(t) &&
        (
          (t.manager && (t.manager === userDisplayName || t.manager === user.firstName || (user.firstName && t.manager.includes(`(${user.firstName})`)))) ||
          (t.collaborators && Array.isArray(t.collaborators) && t.collaborators.some((c: any) => String(c).includes(user.firstName || user.username)))
        )
      );

      const totalCount = myTasks.length + assignedByMe.length + involvedTasks.length;
      if (totalCount === 0) return; // No tasks to report

      const completedCount = myTasks.filter(t => t.status === 'done').length;
      const doingCount = myTasks.filter(t => t.status === 'in_progress' || t.status === 'review').length;
      const nowMs = Date.now();
      const overdueCount = myTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline).getTime() < nowMs).length;

      const dateHeader = new Date().toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px 12px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); padding: 32px 24px; color: #ffffff; text-align: left;">
              <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85; font-weight: bold; margin-bottom: 6px;">Daily Work Digest</div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800;">สรุปภารกิจประจำวัน — WorkSync</h1>
              <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">${dateHeader}</p>
            </div>

            <!-- Body -->
            <div style="padding: 24px;">
              <p style="font-size: 15px; color: #1e293b; margin-top: 0;">สวัสดีคุณ <b>${userDisplayName}</b>,</p>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">นี่คือรายงานสรุปภารกิจและการดำเนินงานของคุณในระบบ WorkSync ประจำวันนี้ครับ</p>

              <!-- Stats Cards -->
              <div style="display: flex; gap: 8px; margin: 20px 0;">
                <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #007AFF;">${myTasks.length}</div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">งานของฉัน</div>
                </div>
                <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #16a34a;">${completedCount}</div>
                  <div style="font-size: 11px; color: #16a34a; margin-top: 2px;">เสร็จสิ้น</div>
                </div>
                <div style="flex: 1; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 12px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #ea580c;">${doingCount}</div>
                  <div style="font-size: 11px; color: #ea580c; margin-top: 2px;">กำลังทำ</div>
                </div>
                <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 12px; text-align: center;">
                  <div style="font-size: 20px; font-weight: bold; color: #dc2626;">${overdueCount}</div>
                  <div style="font-size: 11px; color: #dc2626; margin-top: 2px;">เกินกำหนด</div>
                </div>
              </div>

              <!-- Task List Section -->
              <h3 style="font-size: 14px; font-weight: bold; color: #0f172a; margin: 24px 0 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
                📋 ภารกิจของคุณ (${myTasks.length})
              </h3>
              ${myTasks.slice(0, 8).map(t => {
                const deadlineText = t.deadline ? new Date(t.deadline).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }) : 'ไม่ระบุ';
                const isOverdue = t.status !== 'done' && t.deadline && new Date(t.deadline).getTime() < nowMs;
                return `
                  <div style="padding: 10px 12px; border-radius: 10px; margin-bottom: 8px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 13px; font-weight: 600; color: #1e293b;">
                      ${t.title}
                      ${isOverdue ? '<span style="color: #dc2626; font-size: 10px; font-weight: bold; margin-left: 6px; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">เกินกำหนด</span>' : ''}
                    </div>
                    <div style="font-size: 11px; color: #64748b; text-align: right;">
                      <span style="font-weight: bold; color: #007AFF;">${t.progress}%</span> • ส่ง ${deadlineText}
                    </div>
                  </div>
                `;
              }).join('')}

              ${myTasks.length > 8 ? `<p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 8px 0;">...และภารกิจอื่นๆ อีก ${myTasks.length - 8} รายการ</p>` : ''}

              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 32px; padding-top: 16px;">
                <a href="https://worksync.windowasia.com" target="_blank" style="background: #007AFF; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: bold; border-radius: 12px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(0,122,255,0.25);">
                  เปิดดูใน WorkSync →
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
              อีเมลฉบับนี้ส่งโดยอัตโนมัติตามการตั้งค่าโปรไฟล์ของคุณใน WorkSync
            </div>
          </div>
        </div>
      `;

      await this.sendMail(
        user.email,
        `[WorkSync] สรุปภารกิจประจำวันของคุณ — ${dateHeader}`,
        html
      );

      // Record sent time
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastDigestSentAt: new Date() },
      });

      this.logger.log(`Daily digest sent to ${user.email} (${userDisplayName})`);
    } catch (err: any) {
      this.logger.error(`Error sending digest to ${user.email}: ${err.message}`);
    }
  }
}
