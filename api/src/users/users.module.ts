import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
