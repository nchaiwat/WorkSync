import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordLogDto {
  category: string;
  action: string;
  status?: 'success' | 'failed' | 'warning' | 'info';
  message: string;
  details?: any;
  recordsCount?: number;
  durationMs?: number;
  triggeredBy: string;
}

@Injectable()
export class TransactionLogsService {
  private readonly logger = new Logger(TransactionLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordLog(data: RecordLogDto) {
    try {
      const detailsStr = typeof data.details === 'object' && data.details !== null
        ? JSON.stringify(data.details)
        : (data.details ? String(data.details) : null);

      return await this.prisma.transactionLog.create({
        data: {
          category: data.category,
          action: data.action,
          status: data.status || 'success',
          message: data.message,
          details: detailsStr,
          recordsCount: data.recordsCount ?? 0,
          durationMs: data.durationMs ?? 0,
          triggeredBy: data.triggeredBy,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to record transaction log: ${err.message}`, err.stack);
      return null;
    }
  }

  async getRecentLogs(category?: string, limit = 50) {
    try {
      const where: any = {};
      if (category) {
        where.category = category;
      }
      return await this.prisma.transactionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
      });
    } catch (err: any) {
      this.logger.warn(`Could not query transaction logs: ${err.message}`);
      return [];
    }
  }
}
