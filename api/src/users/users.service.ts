import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { validatePasswordComplexity } from '../auth/password-policy';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.UserCreateInput): Promise<User> {
    if (data.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new ConflictException('อีเมลนี้ถูกใช้งานแล้ว');
      }
    }

    const existingUsername = await this.prisma.user.findUnique({
      where: { username: data.username },
    });
    if (existingUsername) {
      throw new ConflictException('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
    }

    // Validate complexity for local accounts if not AD
    if (!data.isAdAuth && data.password && data.password.length < 30) {
      const complexity = validatePasswordComplexity(data.password, data.username);
      if (!complexity.valid) {
        throw new BadRequestException(complexity.error || 'รหัสผ่านไม่ผ่านเกณฑ์ความซับซ้อน');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        passwordChangedAt: new Date(),
        mustChangePassword: !data.isAdAuth, // Require local accounts to change on first login
      },
    });
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้งาน');
    }

    const updateData: any = { ...data };
    if (updateData.password && typeof updateData.password === 'string') {
      if (!user.isAdAuth && updateData.password.length < 30) {
        const complexity = validatePasswordComplexity(updateData.password, user.username);
        if (!complexity.valid) {
          throw new BadRequestException(complexity.error || 'รหัสผ่านไม่ผ่านเกณฑ์ความซับซ้อน');
        }
      }
      updateData.password = await bcrypt.hash(updateData.password, 10);
      updateData.passwordChangedAt = new Date();
      updateData.mustChangePassword = false;
    }
    if (updateData.pinCode && typeof updateData.pinCode === 'string') {
      updateData.pinCode = await bcrypt.hash(updateData.pinCode, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async registerDevice(userId: string, deviceToken: string) {
    const user = await this.findOneById(userId);
    if (!user) return;

    let devices: string[] = [];
    if (user.devices) {
      try {
        devices = Array.isArray(user.devices) ? (user.devices as string[]) : [];
      } catch {
        devices = [];
      }
    }

    if (!devices.includes(deviceToken)) {
      devices.push(deviceToken);
      await this.prisma.user.update({
        where: { id: userId },
        data: { devices: devices as any },
      });
    }
  }

  async updateLastAccess(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastAccess: new Date() },
    });
  }

  async remove(id: string): Promise<boolean> {
    const user = await this.findOneById(id);
    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้งาน');
    }
    await this.prisma.user.delete({
      where: { id },
    });
    return true;
  }
}
