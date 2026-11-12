import { User } from '@prisma/client';

export const LOCAL_PASSWORD_EXPIRY_DAYS = 90;

export interface PasswordComplexityResult {
  valid: boolean;
  error?: string;
  rules: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    digit: boolean;
    special: boolean;
    noUsername: boolean;
  };
}

export function validatePasswordComplexity(password: string, username?: string): PasswordComplexityResult {
  const pwd = (password || '').trim();
  const rules = {
    length: pwd.length >= 8 && pwd.length <= 16,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    digit: /[0-9]/.test(pwd),
    special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(pwd),
    noUsername: true,
  };

  if (username && username.trim().length >= 3) {
    if (pwd.toLowerCase().includes(username.trim().toLowerCase())) {
      rules.noUsername = false;
    }
  }

  const valid = Object.values(rules).every(Boolean);

  let error: string | undefined = undefined;
  if (!rules.length) {
    error = `รหัสผ่านต้องมีความยาวระหว่าง 8 ถึง 16 ตัวอักษร (ปัจจุบัน ${pwd.length} ตัวอักษร)`;
  } else if (!rules.uppercase) {
    error = 'รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว';
  } else if (!rules.lowercase) {
    error = 'รหัสผ่านต้องมีตัวอักษรพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว';
  } else if (!rules.digit) {
    error = 'รหัสผ่านต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว';
  } else if (!rules.special) {
    error = 'รหัสผ่านต้องมีอักขระพิเศษ (!@#$%^&*...) อย่างน้อย 1 ตัว';
  } else if (!rules.noUsername) {
    error = 'รหัสผ่านต้องไม่มีชื่อผู้ใช้ (Username) ปะปนอยู่';
  }

  return { valid, error, rules };
}

export function checkPasswordExpiry(
  passwordChangedAt: Date | null | undefined,
  createdAt?: Date | null,
): { expired: boolean; daysLeft: number; daysElapsed: number } {
  const now = new Date();
  const base = passwordChangedAt ? new Date(passwordChangedAt) : (createdAt ? new Date(createdAt) : now);
  const diffMs = now.getTime() - base.getTime();
  const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, LOCAL_PASSWORD_EXPIRY_DAYS - daysElapsed);
  const expired = daysElapsed >= LOCAL_PASSWORD_EXPIRY_DAYS;

  return { expired, daysLeft, daysElapsed };
}
