import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionLogsModule } from '../transaction-logs/transaction-logs.module';

@Module({
  imports: [PrismaModule, TransactionLogsModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
