import { Injectable, Logger } from '@nestjs/common';
import { TransactionLogsService } from '../transaction-logs/transaction-logs.service';

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const WHITELIST_IPS = new Set([
  '127.0.0.1',
  'localhost',
  '::1',
  '::ffff:127.0.0.1',
  '172.18.0.1',
  '157.173.219.153',
  '49.231.185.245',
  '58.8.190.63',
]);

export interface BotDefenseResult {
  allowed: boolean;
  statusCode?: number;
  message?: string;
  retryAfter?: number;
}

@Injectable()
export class BotDefenseService {
  private readonly logger = new Logger(BotDefenseService.name);
  private ipRecords = new Map<string, number[]>();

  constructor(private readonly transactionLogsService: TransactionLogsService) {}

  async checkBotDefense(
    clientIp: string,
    body: {
      corporate_fax?: string;
      security_honey?: string;
      form_render_ts?: number | string;
      username?: string;
    },
  ): Promise<BotDefenseResult> {
    const cleanIp = (clientIp || '127.0.0.1').trim();
    const now = Date.now();

    // ─── Layer 1: Sliding-Window IP Rate Limiting ─────────────────────────
    if (!WHITELIST_IPS.has(cleanIp)) {
      const timestamps = (this.ipRecords.get(cleanIp) || []).filter(
        (t) => t > now - RATE_LIMIT_WINDOW_MS,
      );

      if (timestamps.length >= RATE_LIMIT_MAX) {
        const oldest = timestamps[0];
        const retryAfter = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));
        this.ipRecords.set(cleanIp, timestamps);

        await this.transactionLogsService.recordLog({
          category: 'security_bot',
          action: 'ip_rate_limited',
          status: 'warning',
          message: `IP ${cleanIp} ถูกบล็อกเนื่องจากส่งคำขอล็อกอินเกินกำหนด (10 ครั้ง/นาที)`,
          details: { ip: cleanIp, retryAfter, attempts: timestamps.length },
          triggeredBy: `ip:${cleanIp}`,
        });

        return {
          allowed: false,
          statusCode: 429,
          retryAfter,
          message: `คำขอเข้าสู่ระบบถี่เกินกำหนด กรุณารอ ${retryAfter} วินาที แล้วลองใหม่อีกครั้ง`,
        };
      }

      timestamps.push(now);
      this.ipRecords.set(cleanIp, timestamps);
    }

    // ─── Layer 2: Decoy Honeypot Trap Evaluation ──────────────────────────
    if (body.corporate_fax || body.security_honey) {
      await this.transactionLogsService.recordLog({
        category: 'security_bot',
        action: 'bot_honeypot_detected',
        status: 'warning',
        message: `ตรวจพบบอทกรอกฟิลด์ Decoy Honeypot จาก IP ${cleanIp}`,
        details: {
          ip: cleanIp,
          corporate_fax: body.corporate_fax,
          security_honey: body.security_honey,
          username: body.username,
        },
        triggeredBy: `ip:${cleanIp}`,
      });

      // Silent Rejection: Don't tell the attacker they hit a honeypot
      return {
        allowed: false,
        statusCode: 401,
        message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      };
    }

    // ─── Layer 3: Submission Velocity & Timing Guard ──────────────────────
    if (body.form_render_ts !== undefined && body.form_render_ts !== null) {
      const renderTs = Number(body.form_render_ts);
      if (!isNaN(renderTs)) {
        const deltaMs = now - renderTs;
        if (deltaMs < 400 || deltaMs < -10000) {
          await this.transactionLogsService.recordLog({
            category: 'security_bot',
            action: 'bot_timing_violation',
            status: 'warning',
            message: `ตรวจพบความเร็วการส่งข้อมูลผิดปกติของมนุษย์ (${deltaMs}ms) จาก IP ${cleanIp}`,
            details: { ip: cleanIp, deltaMs, renderTs, now },
            triggeredBy: `ip:${cleanIp}`,
          });

          return {
            allowed: false,
            statusCode: 400,
            message: 'ตรวจพบความเร็วการส่งข้อมูลผิดปกติ กรุณาลองใหม่อีกครั้ง',
          };
        }
      }
    }

    return { allowed: true };
  }
}
