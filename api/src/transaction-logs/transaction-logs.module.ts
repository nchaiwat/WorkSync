import { Module } from '@nestjs/common';
import { TransactionLogsService } from './transaction-logs.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TransactionLogsService],
  exports: [TransactionLogsService],
})
export class TransactionLogsModule {}
