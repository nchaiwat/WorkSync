import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionLogsService } from '../transaction-logs/transaction-logs.service';

export interface CiamConfigResponse {
  ciam_base_url: string;
  ciam_client_id: string;
  ciam_client_secret_masked: string;
  ciam_sso_enabled: boolean;
  ciam_break_glass_active: boolean;
  ciam_ad_gateway_url: string;
  ciam_auto_provision_group: string;
  ciam_session_ttl_minutes: number;
  updated_at?: Date | null;
}

export class UpdateCiamDto {
  ciam_base_url?: string;
  ciam_client_id?: string;
  ciam_client_secret?: string;
  ciam_sso_enabled?: boolean;
  ciam_break_glass_active?: boolean;
  ciam_ad_gateway_url?: string;
  ciam_auto_provision_group?: string;
  ciam_session_ttl_minutes?: number;
}


@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, { value: string | null; dataType: string; updatedAt: Date }>();
  private isLoaded = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionLogsService: TransactionLogsService,
  ) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  async refreshCache(): Promise<void> {
    try {
      const rows = await this.prisma.systemSetting.findMany();
      this.cache.clear();
      for (const row of rows) {
        this.cache.set(row.key, {
          value: row.value,
          dataType: row.dataType,
          updatedAt: row.updatedAt,
        });
      }
      this.isLoaded = true;
      this.logger.log(`Dynamic System Settings cache refreshed: ${rows.length} keys loaded.`);
    } catch (err: any) {
      this.logger.warn(`Could not preload system settings (DB might not be ready yet): ${err.message}`);
    }
  }

  private async ensureCache(): Promise<void> {
    if (!this.isLoaded || this.cache.size === 0) {
      await this.refreshCache();
    }
  }

  async get(key: string, defaultValue = ''): Promise<string> {
    await this.ensureCache();
    return this.cache.get(key)?.value ?? defaultValue;
  }

  async getBoolean(key: string, defaultValue = false): Promise<boolean> {
    await this.ensureCache();
    const item = this.cache.get(key);
    if (!item || item.value === null) return defaultValue;
    return item.value.toLowerCase() === 'true' || item.value === '1';
  }

  async getNumber(key: string, defaultValue = 0): Promise<number> {
    await this.ensureCache();
    const item = this.cache.get(key);
    if (!item || item.value === null) return defaultValue;
    const n = Number(item.value);
    return isNaN(n) ? defaultValue : n;
  }

  maskSecret(secret: string | null | undefined): string {
    if (!secret) return '';
    if (secret.length <= 8) return '****';
    const last4 = secret.slice(-4);
    const prefix = secret.slice(0, 4);
    return `${prefix}****${last4}`;
  }

  async getCiamConfig(): Promise<CiamConfigResponse> {
    await this.ensureCache();

    const baseUrl = await this.get('ciam_base_url', 'https://ciam.windowasia.com');
    const clientId = await this.get('ciam_client_id', 'worksync-spoke-client');
    const secret = await this.get('ciam_client_secret', '');
    const ssoEnabled = await this.getBoolean('ciam_sso_enabled', true);
    const breakGlass = await this.getBoolean('ciam_break_glass_active', false);
    const adGateway = await this.get('ciam_ad_gateway_url', 'http://192.168.12.11:3100');
    const autoGroup = await this.get('ciam_auto_provision_group', 'User');
    const sessionTtl = await this.getNumber('ciam_session_ttl_minutes', 480);

    const secretEntry = this.cache.get('ciam_client_secret');
    const updatedAt = secretEntry?.updatedAt || new Date();

    return {
      ciam_base_url: baseUrl,
      ciam_client_id: clientId,
      ciam_client_secret_masked: this.maskSecret(secret),
      ciam_sso_enabled: ssoEnabled,
      ciam_break_glass_active: breakGlass,
      ciam_ad_gateway_url: adGateway,
      ciam_auto_provision_group: autoGroup,
      ciam_session_ttl_minutes: sessionTtl,
      updated_at: updatedAt,
    };
  }

  async updateCiamConfig(dto: UpdateCiamDto, adminUsername: string, ip: string) {
    const changedFields: string[] = [];

    const fieldMap: Record<string, { val: any; dataType: string; desc: string }> = {
      ciam_base_url: { val: dto.ciam_base_url, dataType: 'string', desc: 'URL หลักของ Central IAM Engine' },
      ciam_client_id: { val: dto.ciam_client_id, dataType: 'string', desc: 'Client ID ที่ลงทะเบียนไว้ใน Central IAM Portal' },
      ciam_sso_enabled: {
        val: dto.ciam_sso_enabled !== undefined
          ? String(dto.ciam_sso_enabled === true || String(dto.ciam_sso_enabled).toLowerCase() === 'true')
          : undefined,
        dataType: 'boolean',
        desc: 'สวิตช์หลักเปิด/ปิดการเข้าใช้งานด้วย Central IAM SSO',
      },
      ciam_break_glass_active: {
        val: dto.ciam_break_glass_active !== undefined
          ? String(dto.ciam_break_glass_active === true || String(dto.ciam_break_glass_active).toLowerCase() === 'true')
          : undefined,
        dataType: 'boolean',
        desc: 'โหมดปลดระบบฉุกเฉิน',
      },
      ciam_ad_gateway_url: { val: dto.ciam_ad_gateway_url, dataType: 'string', desc: 'URL เซิร์ฟเวอร์ AD Gateway ภายในองค์กร' },
      ciam_auto_provision_group: { val: dto.ciam_auto_provision_group, dataType: 'string', desc: 'ชื่อกลุ่มสิทธิ์เริ่มต้น' },
      ciam_session_ttl_minutes: { val: dto.ciam_session_ttl_minutes !== undefined ? String(dto.ciam_session_ttl_minutes) : undefined, dataType: 'integer', desc: 'อายุ Access Token ของระบบลูก' },
    };


    // Special secret handling: skip if empty or masked like sec_****
    if (dto.ciam_client_secret && !dto.ciam_client_secret.includes('****')) {
      fieldMap['ciam_client_secret'] = {
        val: dto.ciam_client_secret,
        dataType: 'encrypted',
        desc: 'รหัสลับเฉพาะของระบบลูก',
      };
    }

    for (const [key, meta] of Object.entries(fieldMap)) {
      if (meta.val !== undefined && meta.val !== null) {
        const currentVal = await this.get(key, '');
        if (currentVal !== String(meta.val)) {
          await this.prisma.systemSetting.upsert({
            where: { key },
            update: { value: String(meta.val), dataType: meta.dataType },
            create: {
              key,
              value: String(meta.val),
              dataType: meta.dataType,
              category: 'central_iam',
              description: meta.desc,
            },
          });
          changedFields.push(key);
        }
      }
    }

    // Refresh memory cache immediately
    await this.refreshCache();

    // Record Audit Log CFG-01
    await this.transactionLogsService.recordLog({
      category: 'system_setting',
      action: 'update_ciam_settings',
      status: 'success',
      message: 'แก้ไขการตั้งค่าระบบ Central IAM SSO',
      details: { changed_fields: changedFields, ip },
      triggeredBy: `user:${adminUsername}`,
    });

    return {
      status: 'success',
      message: 'บันทึกการตั้งค่า Central IAM SSO เรียบร้อยแล้ว',
      changed_fields: changedFields,
    };
  }

  async testCiamConnection(): Promise<any> {
    const baseUrl = (await this.get('ciam_base_url', 'https://ciam.windowasia.com')).replace(/\/+$/, '');
    const startTime = Date.now();

    try {
      const wellKnownUrl = `${baseUrl}/.well-known/openid-configuration`;
      const res = await fetch(wellKnownUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000), // 3s timeout
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        return {
          status: 'error',
          latency_ms: latencyMs,
          message: `เซิร์ฟเวอร์ตอบกลับด้วยรหัส HTTP ${res.status}`,
          ciam_issuer: baseUrl,
        };
      }

      const oidcConfig = await res.json();
      const jwksUri = oidcConfig.jwks_uri || `${baseUrl}/.well-known/jwks.json`;

      let keysFound = 0;
      let keyId = 'unknown';

      try {
        const jwksRes = await fetch(jwksUri, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        if (jwksRes.ok) {
          const jwks = await jwksRes.json();
          if (Array.isArray(jwks.keys)) {
            keysFound = jwks.keys.length;
            keyId = jwks.keys[0]?.kid || 'first-key';
          }
        }
      } catch (e) {
        // partial success if openid config was read
      }

      return {
        status: 'connected',
        latency_ms: latencyMs,
        ciam_issuer: oidcConfig.issuer || baseUrl,
        jwks_uri: jwksUri,
        keys_found: keysFound,
        key_id: keyId,
        message: 'สามารถเชื่อมต่อไปยัง Window Asia Central IAM ได้อย่างสมบูรณ์',
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        status: 'error',
        latency_ms: latencyMs,
        message: `ไม่สามารถเชื่อมต่อได้: ${err.message || 'Timeout / Connection Refused'}`,
        ciam_issuer: baseUrl,
      };
    }
  }
}
