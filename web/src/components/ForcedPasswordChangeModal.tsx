'use client';

import React, { useState } from 'react';

interface ForcedPasswordChangeModalProps {
  username: string;
  isExpired?: boolean;
  token?: string;
  onSuccess: () => void;
}

export default function ForcedPasswordChangeModal({
  username,
  isExpired = false,
  token,
  onSuccess,
}: ForcedPasswordChangeModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ─── Real-time Complexity Checklist (Section 13.1 / v2.12.0) ────────────
  const isLenValid = newPassword.length >= 8 && newPassword.length <= 16;
  const isUpperValid = /[A-Z]/.test(newPassword);
  const isLowerValid = /[a-z]/.test(newPassword);
  const isDigitValid = /[0-9]/.test(newPassword);
  const isSpecialValid = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(newPassword);
  const isNoUserValid =
    !username ||
    username.trim().length < 3 ||
    !newPassword.toLowerCase().includes(username.trim().toLowerCase());

  const isAllValid =
    isLenValid &&
    isUpperValid &&
    isLowerValid &&
    isDigitValid &&
    isSpecialValid &&
    isNoUserValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!oldPassword) {
      setError('กรุณาระบุรหัสผ่านเดิมเพื่อยืนยันตัวตน');
      return;
    }

    if (!isAllValid) {
      setError('กรุณาตั้งรหัสผ่านใหม่ให้ตรงตามเกณฑ์ความปลอดภัยครบทุกข้อ');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านยืนยันไม่ตรงกับรหัสผ่านใหม่');
      return;
    }

    setIsLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/auth/local/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.detail || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 dark:bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#151E2E] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">
            🔒
          </div>
          <div>
            <h3 className="text-base font-bold leading-tight">
              {isExpired ? 'รหัสผ่านหมดอายุตามรอบความปลอดภัย 90 วัน' : 'จำเป็นต้องเปลี่ยนรหัสผ่าน'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              บัญชี <strong className="text-blue-600 dark:text-blue-400">{username}</strong> (Enterprise Password Policy)
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 my-3 leading-relaxed">
          ตามมาตรฐานความปลอดภัยข้อมูล ISO 27001 บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) บัญชีท้องถิ่นต้องเปลี่ยนรหัสผ่านทุกๆ 90 วัน และต้องตรงตามเกณฑ์ความซับซ้อน
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium mb-3">
            ⚠️ {error}
          </div>
        )}

        {/* Real-time Checklist */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-750 text-[11px] mb-4 space-y-1.5">
          <div className="font-bold text-slate-700 dark:text-slate-200 mb-1">
            เกณฑ์ความปลอดภัยรหัสผ่าน (8 - 16 ตัวอักษร):
          </div>
          <div className={`flex items-center gap-2 ${isLenValid ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
            <span>{isLenValid ? '✓' : '•'}</span> ความยาว 8 - 16 ตัวอักษร
          </div>
          <div className={`flex items-center gap-2 ${isUpperValid ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
            <span>{isUpperValid ? '✓' : '•'}</span> มีตัวอักษรพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว
          </div>
          <div className={`flex items-center gap-2 ${isLowerValid ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
            <span>{isLowerValid ? '✓' : '•'}</span> มีตัวอักษรพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว
          </div>
          <div className={`flex items-center gap-2 ${isDigitValid ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
            <span>{isDigitValid ? '✓' : '•'}</span> มีตัวเลข (0-9) อย่างน้อย 1 ตัว
          </div>
          <div className={`flex items-center gap-2 ${isSpecialValid ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
            <span>{isSpecialValid ? '✓' : '•'}</span> มีอักขระพิเศษ (!@#$%^&*...) อย่างน้อย 1 ตัว
          </div>
          <div className={`flex items-center gap-2 ${isNoUserValid ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}`}>
            <span>{isNoUserValid ? '✓' : '✗'}</span> ห้ามมีชื่อผู้ใช้ ({username}) ปะปนในรหัสผ่าน
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              รหัสผ่านเดิม *
            </label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="กรอกรหัสผ่านปัจจุบัน"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              รหัสผ่านใหม่ (8-16 ตัวอักษร) *
            </label>
            <input
              type="password"
              required
              maxLength={16}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="กรอกรหัสผ่านใหม่ตามเกณฑ์ด้านบน"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ยืนยันรหัสผ่านใหม่ *
            </label>
            <input
              type="password"
              required
              maxLength={16}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="กรอกรหัสผ่านใหม่อีกครั้งให้ตรงกัน"
            />
          </div>

          <button
            type="submit"
            disabled={!isAllValid || newPassword !== confirmPassword || isLoading}
            className="w-full mt-3 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? 'กำลังบันทึกรหัสผ่านใหม่...' : '💾 บันทึกรหัสผ่านใหม่ (มีอายุ 90 วัน)'}
          </button>
        </form>
      </div>
    </div>
  );
}
