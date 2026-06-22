import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'WorkSync NestJS API is running!';
  }

  @Get('server/health')
  getHealth() {
    return { status: 'ok' };
  }
}
