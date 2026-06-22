import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly apiBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.apiBaseUrl = this.configService.get<string>('TELEGRAM_API_BASE_URL') || 'https://api.telegram.org';
  }

  /**
   * Send a Direct Message to a specific Telegram user by their chat_id (Telegram ID).
   * If the user has not started a chat with the bot, the message will be silently skipped.
   */
  async sendDirectMessage(telegramId: string, message: string): Promise<void> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured. Skipping notification.');
      return;
    }

    if (!telegramId || telegramId.trim() === '') {
      return; // No Telegram ID — skip silently
    }

    try {
      const url = `${this.apiBaseUrl}/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId.trim(),
          text: message,
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errDesc = (errorBody as any)?.description || response.statusText;
        // "chat not found" means user hasn't started the bot yet — just warn, don't throw
        this.logger.warn(`Telegram DM to ${telegramId} failed: ${errDesc}`);
      } else {
        this.logger.log(`Telegram DM sent to: ${telegramId}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send Telegram DM to ${telegramId}: ${error.message}`);
    }
  }

  /**
   * Broadcast a message to multiple Telegram IDs (e.g. manager + colleagues).
   * Skips any recipient with no Telegram ID or who hasn't started the bot.
   */
  async broadcastNotification(telegramIds: string[], message: string): Promise<void> {
    const unique = [...new Set(telegramIds.filter(id => id && id.trim() !== ''))];
    if (unique.length === 0) return;

    // Fire all DMs concurrently — failures are handled individually
    await Promise.allSettled(unique.map(id => this.sendDirectMessage(id, message)));
  }
}
