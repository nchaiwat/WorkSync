import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { CommentsModule } from './comments/comments.module';
import { LoginLogsModule } from './login-logs/login-logs.module';
import { SettingsModule } from './settings/settings.module';
import { TransactionLogsModule } from './transaction-logs/transaction-logs.module';
import { DirectoryModule } from './directory/directory.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';

import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    TelegramModule,
    AuthModule,
    UsersModule,
    TasksModule,
    CommentsModule,
    LoginLogsModule,
    SettingsModule,
    TransactionLogsModule,
    DirectoryModule,
    EmailModule,
    NotificationsModule,
    AiModule,
  ],
  controllers: [AppController],
})

export class AppModule {}
