import { Module } from '@nestjs/common';
import { LoginLogsService } from './login-logs.service';
import { LoginLogsController } from './login-logs.controller';

@Module({
  providers: [LoginLogsService],
  controllers: [LoginLogsController],
})
export class LoginLogsModule {}
