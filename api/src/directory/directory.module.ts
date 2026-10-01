import { Module } from '@nestjs/common';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';
import { CiamM2mGuard } from './ciam-m2m.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { TransactionLogsModule } from '../transaction-logs/transaction-logs.module';

@Module({
  imports: [PrismaModule, SettingsModule, TransactionLogsModule],
  controllers: [DirectoryController],
  providers: [DirectoryService, CiamM2mGuard],
  exports: [DirectoryService],
})
export class DirectoryModule {}
