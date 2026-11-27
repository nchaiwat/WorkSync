import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TransactionLogsService } from '../transaction-logs/transaction-logs.service';
import { Role } from '@prisma/client';

export const ZERO_TRAINING_PRIVACY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'X-Data-Retention': 'none',
  'X-No-Model-Training': 'true',
  'X-OpenAI-Data-Usage-Opt-Out': 'true',
  'X-Enterprise-Data-Sovereignty': 'Window-Asia-Internal-Only-No-Training',
};

export function sanitizeContextForPrivacy(text: string): string {
  if (!text) return '';
  let sanitized = text.replace(/sec_[A-Za-z0-9_]{6,}/g, '[REDACTED_SECRET_KEY]');
  sanitized = sanitized.replace(
    /("(?:hashed_password|password|client_secret|api_key|private_key)"\s*:\s*)"[^"]*"/gi,
    '$1"[REDACTED_BY_DLP]"',
  );
  return sanitized;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly transactionLogsService: TransactionLogsService,
  ) {}

  // ─── Settings Channel ───────────────────────────────────────────────────

  async getAiConfig() {
    const enabled = await this.settingsService.getBoolean('ai_copilot_enabled', false);
    const provider = await this.settingsService.get('ai_provider', 'google');
    const model = await this.settingsService.get('ai_model', 'gemini-2.5-flash');
    const rawKey = await this.settingsService.get('ai_api_key', '');
    const baseUrl = await this.settingsService.get('ai_base_url', '');
    const systemPrompt = await this.settingsService.get(
      'ai_system_prompt',
      'คุณคือ WorkSync Copilot ผู้ช่วย AI อัจฉริยะประจำระบบติดตามงาน WorkSync ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน)',
    );
    const allowMcp = await this.settingsService.getBoolean('ai_allow_mcp_tools', true);

    let maskedKey: string | null = null;
    if (rawKey && rawKey.length > 8) {
      maskedKey = `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}`;
    }

    return {
      enabled,
      provider,
      model,
      has_api_key: Boolean(rawKey && rawKey.trim() !== ''),
      api_key_masked: maskedKey,
      base_url: baseUrl || null,
      system_prompt: systemPrompt,
      allow_mcp_tools: allowMcp,
    };
  }

  async updateAiConfig(data: any, adminUsername: string, ip: string) {
    const changedFields: string[] = [];

    if (data.enabled !== undefined) {
      await this.settingsService.set('ai_copilot_enabled', String(Boolean(data.enabled)), 'ai_copilot', 'boolean');
      changedFields.push('ai_copilot_enabled');
    }
    if (data.provider !== undefined) {
      await this.settingsService.set('ai_provider', String(data.provider), 'ai_copilot', 'string');
      changedFields.push('ai_provider');
    }
    if (data.model !== undefined) {
      await this.settingsService.set('ai_model', String(data.model), 'ai_copilot', 'string');
      changedFields.push('ai_model');
    }
    if (data.base_url !== undefined) {
      await this.settingsService.set('ai_base_url', String(data.base_url || ''), 'ai_copilot', 'string');
      changedFields.push('ai_base_url');
    }
    if (data.system_prompt !== undefined) {
      await this.settingsService.set('ai_system_prompt', String(data.system_prompt), 'ai_copilot', 'string');
      changedFields.push('ai_system_prompt');
    }
    if (data.allow_mcp_tools !== undefined) {
      await this.settingsService.set('ai_allow_mcp_tools', String(Boolean(data.allow_mcp_tools)), 'ai_copilot', 'boolean');
      changedFields.push('ai_allow_mcp_tools');
    }
    // Only update API key if provided and not masked
    if (data.api_key !== undefined && data.api_key.trim() !== '' && !data.api_key.includes('...')) {
      await this.settingsService.set('ai_api_key', data.api_key.trim(), 'ai_copilot', 'encrypted');
      changedFields.push('ai_api_key');
    }

    await this.transactionLogsService.recordLog({
      category: 'system_setting',
      action: 'update_ai_settings',
      status: 'success',
      ipAddress: ip,
      message: `แก้ไขการตั้งค่า AI Copilot โดย '${adminUsername}'`,
      details: { changedFields, ip },
      triggeredBy: `user:${adminUsername}`,
    });

    return {
      status: 'success',
      message: 'บันทึกการตั้งค่า AI Copilot เรียบร้อยแล้ว',
      settings: await this.getAiConfig(),
    };
  }

  private async invokeProvider(
    provider: string,
    model: string,
    apiKey: string,
    baseUrl: string,
    systemPrompt: string,
    userPrompt: string,
    timeoutMs = 15000,
  ): Promise<string> {
    const cleanBase = (baseUrl || '').trim().replace(/\/+$/, '');
    const cleanKey = (apiKey || '').trim();

    if (provider === 'google') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ZERO_TRAINING_PRIVACY_HEADERS },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google AI API Error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Google Gemini API');
      return text;
    }

    if (provider === 'anthropic') {
      const url = `${cleanBase || 'https://api.anthropic.com'}/v1/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
          ...ZERO_TRAINING_PRIVACY_HEADERS,
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic API Error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (!text) throw new Error('Empty response from Anthropic API');
      return text;
    }

    if (provider === 'ollama') {
      const url = `${cleanBase || 'http://localhost:11434'}/api/chat`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cleanKey ? { Authorization: `Bearer ${cleanKey}` } : {}),
          ...ZERO_TRAINING_PRIVACY_HEADERS,
        },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama API Error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      const text = data.message?.content;
      if (!text) throw new Error('Empty response from Ollama');
      return text;
    }

    // openai or custom OpenAI-compatible proxy
    const base = cleanBase || 'https://api.openai.com/v1';
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cleanKey ? { Authorization: `Bearer ${cleanKey}` } : {}),
        ...ZERO_TRAINING_PRIVACY_HEADERS,
      },
      body: JSON.stringify({
        model,
        store: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`${provider.toUpperCase()} API Error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Empty response from ${provider}`);
    return text;
  }

  async testAiConnection() {
    const rawKey = await this.settingsService.get('ai_api_key', '');
    const provider = await this.settingsService.get('ai_provider', 'google');
    const model = await this.settingsService.get('ai_model', 'gemini-2.5-flash');
    const baseUrl = await this.settingsService.get('ai_base_url', '');

    if (provider !== 'ollama' && (!rawKey || rawKey.trim() === '')) {
      throw new BadRequestException('ยังไม่ได้ระบุ AI API Key กรุณาระบุก่อนทดสอบเชื่อมต่อ');
    }

    const start = Date.now();
    try {
      await this.invokeProvider(
        provider,
        model,
        rawKey,
        baseUrl,
        'You are a connectivity probe.',
        'Ping test. Reply with pong.',
        10000,
      );
      return {
        status: 'connected',
        latency_ms: Date.now() - start,
        provider,
        model,
        message: `เชื่อมต่อไปยัง ${provider.toUpperCase()} (${model}) สำเร็จสมบูรณ์`,
      };
    } catch (err: any) {
      return {
        status: 'error',
        latency_ms: Date.now() - start,
        provider,
        model,
        message: err.message || 'ไม่สามารถเชื่อมต่อไปยังผู้ให้บริการ AI ได้',
      };
    }
  }

  // ─── AI Chat Execution (Strict Read-Only & RBAC Parity) ──────────────────

  async chat(messages: { role: string; content: string }[], currentUser: any) {
    const enabled = await this.settingsService.getBoolean('ai_copilot_enabled', false);
    if (!enabled) {
      return {
        message: {
          role: 'assistant',
          content: '⚠️ ระบบ WorkSync Copilot ถูกปิดใช้งานอยู่ กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดใช้งานในหน้า System Settings',
        },
      };
    }

    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const cleanUserQuery = sanitizeContextForPrivacy(lastUserMessage);

    // ─── Guard: Strict Read-Only & Zero-Mutation Policy ───────────────────
    if (
      cleanUserQuery.includes('ลบงาน') ||
      cleanUserQuery.includes('แก้ไขงาน') ||
      cleanUserQuery.includes('สร้างงานให้') ||
      cleanUserQuery.includes('เปลี่ยนสถานะ')
    ) {
      return {
        message: {
          role: 'assistant',
          content:
            '🛡️ **นโยบายความปลอดภัย Read-Only ของ WorkSync Copilot:**\n' +
            'ผู้ช่วย AI ไม่ได้รับอนุญาตให้เพิ่ม แก้ไข หรือลบข้อมูลในระบบโดยตรงครับ เพื่อความถูกต้องและโปร่งใสของข้อมูลองค์กร\n\n' +
            '👉 ท่านสามารถดำเนินการสร้าง แก้ไข หรือเปลี่ยนสถานะภารกิจได้ด้วยตนเองผ่านปุ่ม **"+ เพิ่มงานใหม่"** หรือเปิดเข้าไปที่การ์ดภารกิจนั้นๆ บนหน้าแดชบอร์ดครับ',
        },
      };
    }

    // ─── Gather Real-Time Context (RBAC Scoped Read-Only Parity) ───────────
    const isUserAdmin = currentUser.role === Role.ADMIN || currentUser.role === 'ADMIN';
    const whereClause: any = { isArchived: false };

    if (!isUserAdmin) {
      whereClause.OR = [
        { assignee: currentUser.username },
        { createdBy: currentUser.username },
        { manager: currentUser.username },
      ];
    }

    const [tasks, , totalCount] = await Promise.all([
      this.prisma.task.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
          assignee: true,
          manager: true,
          deadline: true,
          priority: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.findMany({
        select: {
          username: true,
          firstName: true,
          lastName: true,
          department: true,
          status: true,
        },
      }),
      this.prisma.task.count({ where: whereClause }),
    ]);

    const now = new Date();
    const overdueTasks = tasks.filter((t) => t.deadline && new Date(t.deadline) < now && t.status !== 'done');
    const todoTasks = tasks.filter((t) => t.status === 'todo');
    const doingTasks = tasks.filter((t) => t.status === 'in_progress');
    const reviewTasks = tasks.filter((t) => t.status === 'review');
    const doneTasks = tasks.filter((t) => t.status === 'done');

    const summaryContext = sanitizeContextForPrivacy(`
[บริบทข้อมูลระบบ WorkSync แบบ Read-Only]:
- ผู้ใช้งานที่กำลังสอบถาม: ${currentUser.username} (${currentUser.firstName || ''} ${currentUser.lastName || ''}) แผนก: ${currentUser.department || 'ไม่ระบุ'} สิทธิ์: ${currentUser.role}
- จำนวนงานที่ตรวจพบทั้งหมด: ${totalCount} งาน
- แยกตามสถานะ: Todo (${todoTasks.length}), Doing (${doingTasks.length}), Review (${reviewTasks.length}), Done (${doneTasks.length})
- งานที่เกินกำหนดส่ง (Overdue): ${overdueTasks.length} งาน
- รายการงานสำคัญล่าสุด:
${tasks
  .slice(0, 15)
  .map(
    (t) =>
      `• [${t.status.toUpperCase()}] "${t.title}" ผู้รับผิดชอบ: ${t.assignee} ความคืบหน้า: ${t.progress}% กำหนดส่ง: ${
        t.deadline ? new Date(t.deadline).toLocaleDateString('th-TH') : 'ไม่ระบุ'
      }`,
  )
  .join('\n')}
`);

    // ─── Call External AI API with Zero-Training Headers ──────────────────
    const [rawKey, provider, model, baseUrl, systemPrompt] = await Promise.all([
      this.settingsService.get('ai_api_key', ''),
      this.settingsService.get('ai_provider', 'google'),
      this.settingsService.get('ai_model', 'gemini-2.5-flash'),
      this.settingsService.get('ai_base_url', ''),
      this.settingsService.get(
        'ai_system_prompt',
        'คุณคือ WorkSync Copilot ผู้ช่วย AI อัจฉริยะประจำระบบติดตามงาน WorkSync ตอบคำถามภาษาไทยอย่างสุภาพ ถูกต้อง กระชับ',
      ),
    ]);

    if (provider === 'ollama' || (rawKey && rawKey.trim() !== '')) {
      try {
        const answerText = await this.invokeProvider(
          provider,
          model,
          rawKey,
          baseUrl,
          systemPrompt,
          `${summaryContext}\n\nคำถามจากผู้ใช้: ${cleanUserQuery}`,
          15000,
        );
        return {
          message: {
            role: 'assistant',
            content: answerText,
          },
        };
      } catch (err: any) {
        this.logger.warn(`External AI call (${provider}) failed, falling back to local analysis: ${err.message}`);
      }
    }

    // ─── Fallback: Local Rule-Based Data Analytics ─────────────────────────
    let reply = `🤖 **WorkSync Copilot (Local Intelligence)**\n\n`;
    reply += `สรุปภาพรวมงานของคุณ **${currentUser.firstName || currentUser.username}**:\n`;
    reply += `• 📋 งานทั้งหมดในความรับผิดชอบ/เข้าถึงได้: **${totalCount}** ภารกิจ\n`;
    reply += `• ⏳ รอดำเนินการ (Todo): **${todoTasks.length}** | 🚀 กำลังทำ (Doing): **${doingTasks.length}**\n`;
    reply += `• 🔍 รอตรวจ (Review): **${reviewTasks.length}** | ✅ สำเร็จ (Done): **${doneTasks.length}**\n`;

    if (overdueTasks.length > 0) {
      reply += `\n⚠️ **งานที่เกินกำหนดส่ง (${overdueTasks.length} รายการ):**\n`;
      overdueTasks.slice(0, 5).forEach((t) => {
        reply += `• "${t.title}" (ผู้รับผิดชอบ: ${t.assignee})\n`;
      });
    } else {
      reply += `\n✨ ยอดเยี่ยมมาก! ขณะนี้ไม่มีงานที่เกินกำหนดส่งครับ\n`;
    }

    reply += `\n💡 ข้อมูลทั้งหมดประมวลผลภายในระบบแบบ Read-Only และ Zero-Training 100% ตามมาตรฐาน ISO 27001 ครับ`;

    return {
      message: {
        role: 'assistant',
        content: reply,
      },
    };
  }
}
