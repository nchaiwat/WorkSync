import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionLogsService } from '../transaction-logs/transaction-logs.service';
import { SessionActivityService } from '../auth/session-activity.service';
import { CIAM_FRAMEWORK_VERSION } from '../common/ip.util';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const PROTECTED_EMERGENCY_ACCOUNTS = new Set([
  'admin',
  'superadmin',
  'emergency_admin',
  'local_admin',
]);

export class CreateAccountDto {
  username!: string;
  full_name!: string;
  email?: string;
  department?: string;
  group_name?: string;
  use_ad_auth?: boolean;
  password?: string;
  must_change_password?: boolean;
  created_by?: string;
}

export class UpdateStatusDto {
  is_active!: boolean;
  reason?: string;
  updated_by?: string;
}

@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionLogsService: TransactionLogsService,
    private readonly sessionActivityService: SessionActivityService,
  ) {}

  // ─── C.1 Directory Inventory & 04:00 AM Reconciliation ────────────────────
  async listAccounts(query: { status?: string; department?: string; search?: string }) {
    const { status = 'all', department, search } = query;

    const where: any = {};

    if (status === 'active') {
      where.status = 'active';
    } else if (status === 'inactive') {
      where.status = { not: 'active' };
    }

    if (department && department.trim() !== '') {
      where.department = { contains: department.trim(), mode: 'insensitive' };
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [users, allUsersCount, activeUsersCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active' } }),
    ]);

    const formattedAccounts = users.map((u) => {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
      const groupName = u.role === Role.ADMIN ? 'Admin' : (u.position || 'User');
      return {
        id: u.id,
        username: u.username,
        full_name: fullName,
        email: u.email,
        department: u.department || 'Window Asia',
        telegram_chat_id: u.telegramId || null,
        group_name: groupName,
        use_ad_auth: Boolean(u.isAdAuth),
        is_active: u.status === 'active',
        last_login_at: u.lastAccess,
        created_at: u.createdAt,
        updated_at: u.updatedAt,
      };
    });

    return {
      application_name: 'WorkSync (Task Tracking)',
      framework_version: CIAM_FRAMEWORK_VERSION,
      total_accounts: allUsersCount,
      active_accounts: activeUsersCount,
      inactive_accounts: allUsersCount - activeUsersCount,
      accounts: formattedAccounts,
    };
  }

  // ─── C.2 Remote User Provisioning ─────────────────────────────────────────
  async createAccount(payload: CreateAccountDto, ip: string) {
    const cleanUsername = String(payload.username).trim();
    const cleanEmail = payload.email ? String(payload.email).trim() : null;

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanUsername, mode: Prisma.QueryMode.insensitive } },
          ...(cleanEmail ? [{ email: { equals: cleanEmail, mode: Prisma.QueryMode.insensitive } }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException({
        success: false,
        message: `User '${cleanUsername}' already exists in WorkSync`,
        username: existing.username,
      });
    }

    // Split name
    const nameParts = (payload.full_name || cleanUsername).trim().split(/\s+/);
    const firstName = nameParts[0] || cleanUsername;
    const lastName = nameParts.slice(1).join(' ') || '-';

    // Least Privilege Auto-Provisioning (D.7.2): Always provision as USER
    const useAdAuth = payload.use_ad_auth !== undefined ? Boolean(payload.use_ad_auth) : true;
    const rawPassword =
      !useAdAuth && payload.password && String(payload.password).trim() !== ''
        ? String(payload.password).trim()
        : crypto.randomBytes(24).toString('hex');
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const mustChangePassword = !useAdAuth
      ? payload.must_change_password !== undefined
        ? Boolean(payload.must_change_password)
        : true
      : false;

    const user = await this.prisma.user.create({
      data: {
        username: cleanUsername,
        email: cleanEmail || `${cleanUsername}@waapps.net`,
        password: hashedPassword,
        firstName,
        lastName,
        role: Role.USER,
        status: 'active',
        department: payload.department || 'Window Asia',
        position: payload.group_name || 'Standard User',
        isAdAuth: useAdAuth,
        passwordChangedAt: new Date(),
        mustChangePassword,
      },
    });

    // Record ISO 27001 Log
    await this.transactionLogsService.recordLog({
      category: 'ciam_sso',
      action: 'remote_provision_user',
      status: 'info',
      ipAddress: ip,
      message: `สร้างบัญชีผู้ใช้ใหม่ผ่าน Central Management API: '${user.username}'`,
      details: {
        username: user.username,
        email: user.email,
        group_name: payload.group_name || 'Standard User',
        use_ad_auth: user.isAdAuth,
        must_change_password: mustChangePassword,
        created_by: payload.created_by || 'Central-IAM-Service',
        ip,
      },
      triggeredBy: payload.created_by || 'system:ciam',
    });

    return {
      success: true,
      id: user.id,
      username: user.username,
      message: `Account '${user.username}' created successfully.`,
      group_name: payload.group_name || 'Standard User',
      use_ad_auth: user.isAdAuth,
      is_active: true,
      created_at: user.createdAt,
    };
  }

  // ─── C.3 1-Click Offboarding & Reactivate ──────────────────────────────────
  async updateAccountStatus(username: string, payload: UpdateStatusDto, ip: string) {
    const cleanUsername = String(username).trim();
    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: cleanUsername, mode: Prisma.QueryMode.insensitive },
      },
    });

    if (!user) {
      throw new NotFoundException(`ไม่พบบัญชีผู้ใช้ '${cleanUsername}' ในระบบ WorkSync`);
    }

    // Protected Emergency Local Admin Guard
    if (!payload.is_active && PROTECTED_EMERGENCY_ACCOUNTS.has(user.username.toLowerCase())) {
      await this.transactionLogsService.recordLog({
        category: 'ciam_sso',
        action: 'protected_account_blocked',
        status: 'warning',
        ipAddress: ip,
        message: `ปฏิเสธคำสั่งระงับสิทธิ์บัญชีฉุกเฉินประจำระบบ: '${user.username}'`,
        details: { username: user.username, updated_by: payload.updated_by || 'Central-IAM-Service', ip },
        triggeredBy: payload.updated_by || 'system:ciam',
      });
      throw new ForbiddenException(
        `Protected account: Cannot disable emergency local administrator '${user.username}'`,
      );
    }

    const newStatus = payload.is_active ? 'active' : 'inactive';

    const updateData: any = {
      status: newStatus,
    };

    // If deactivating: clear devices, pin, and revoke active sessions immediately
    if (!payload.is_active) {
      updateData.devices = [];
      updateData.pinCode = null;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    if (!payload.is_active) {
      this.sessionActivityService.revokeUserSessions(user.id);
    }

    // Record Audit Log
    const action = payload.is_active ? 'account_reactivated' : 'account_deactivated';
    const statusType = payload.is_active ? 'success' : 'warning';
    const message = payload.is_active
      ? `คืนสิทธิ์การใช้งานบัญชี: '${updatedUser.username}' โดย Central IAM`
      : `ระงับสิทธิ์บัญชีผู้ใช้: '${updatedUser.username}' โดย Central IAM (1-Click Offboarding)`;

    await this.transactionLogsService.recordLog({
      category: 'ciam_sso',
      action,
      status: statusType,
      ipAddress: ip,
      message,
      details: {
        username: updatedUser.username,
        is_active: payload.is_active,
        reason: payload.reason || '1-Click Offboarding via Central Identity Management',
        updated_by: payload.updated_by || 'Central-IAM-Service',
        ip,
      },
      triggeredBy: payload.updated_by || 'system:ciam',
    });

    return {
      username: updatedUser.username,
      is_active: updatedUser.status === 'active',
      message: 'Account status updated successfully',
      updated_at: updatedUser.updatedAt,
    };
  }
}
