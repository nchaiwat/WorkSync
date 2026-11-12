import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { TransactionLogsModule } from '../transaction-logs/transaction-logs.module';

@Module({
  imports: [PrismaModule, SettingsModule, TransactionLogsModule],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
