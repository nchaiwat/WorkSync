import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LoginLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.loginLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
