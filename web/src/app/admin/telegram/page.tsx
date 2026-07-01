'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMe, getAuthToken, logout as authLogout, admin } from '@/lib/auth';
import { api } from '@/lib/api';
import type { User } from '@/types';

export default function AdminTelegramPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [testId, setTestId] = useState('');
  const [testMessage, setTestMessage] = useState('สวัสดีนี่คือข้อความทดสอบระบบแจ้งเตือนจากระบบ WorkSync บัญชีของคุณเชื่อมต่อเรียบร้อยแล้ว!');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const me = await getMe(token);
      const ADMIN_ROLE_ID = 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0'; // Administrator role
      const roleId = typeof me.role === 'object' ? me.role?.id : me.role;
      if (roleId !== ADMIN_ROLE_ID) {
        router.push('/');
        return;
      }
      setIsAdmin(true);
      await loadUsers();
    } catch {
      router.push('/login');
    }
  };

  const loadUsers = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const result = await admin.getUsers(token);
      setUsers(result.data.filter((u: any) => u.status === 'active'));
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authLogout();
    router.push('/login');
  };

  const handleSelectUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user && user.telegram_id) {
      setTestId(user.telegram_id);
    } else {
      setTestId('');
    }
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testId.trim()) {
      setError('กรุณาระบุ Telegram ID สำหรับทดสอบ');
      return;
    }
    if (!testMessage.trim()) {
      setError('กรุณากรอกข้อความทดสอบ');
      return;
    }

    setIsTesting(true);
    setError('');
    setSuccess('');

    try {
      await api.testTelegram(testId.trim(), testMessage.trim());
      setSuccess(`ส่งสัญญาณทดสอบเรียบร้อย! โปรดตรวจสอบที่หน้าต่างแชท Telegram บอท ของ ID: ${testId}`);
    } catch (err: any) {
      setError(err.message || 'การส่งสัญญาณล้มเหลว ตรวจสอบว่าผู้ใช้กด /start คุยกับบอทแล้วหรือยัง');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-gray-400">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-250 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-250 font-bold text-sm">
                ← หน้าหลัก
              </Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
                🛡️ ผู้ดูแลระบบ (Admin)
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-6 mt-4 border-t border-gray-100 dark:border-slate-700 pt-3 overflow-x-auto scrollbar-none">
            <Link
              href="/admin/users"
              className="text-sm font-medium text-gray-500 hover:text-gray-750 dark:text-gray-400 dark:hover:text-gray-200 pb-2 border-b-2 border-transparent"
            >
              👥 ผู้ใช้งานในระบบ
            </Link>
            <Link
              href="/admin/login-logs"
              className="text-sm font-medium text-gray-500 hover:text-gray-750 dark:text-gray-400 dark:hover:text-gray-200 pb-2 border-b-2 border-transparent"
            >
              📋 ประวัติการเข้าใช้งาน
            </Link>
            <Link
              href="/admin/announce"
              className="text-sm font-medium text-gray-500 hover:text-gray-750 dark:text-gray-400 dark:hover:text-gray-200 pb-2 border-b-2 border-transparent"
            >
              📢 ประกาศระบบ
            </Link>
            <Link
              href="/admin/telegram"
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 pb-2"
            >
              ✈️ จัดการ Telegram
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-r-lg p-4 shadow-sm">
            <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 rounded-r-lg p-4 shadow-sm">
            <p className="text-green-700 dark:text-green-400 text-sm font-medium">{success}</p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-slate-700 p-8 shadow-sm text-center max-w-xl mx-auto">
          {/* Large Telegram Icon */}
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
            <svg 
              className="w-10 h-10 fill-current" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.89 1.2-5.33 3.52-.5.35-.96.52-1.37.51-.45-.01-1.31-.25-1.95-.46-.78-.25-1.4-.39-1.35-.83.03-.23.35-.46.96-.69 3.77-1.64 6.29-2.72 7.56-3.25 3.6-.15 4.35 1.13 4.43 1.9z"/>
            </svg>
          </div>

          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
            ทดสอบการส่ง Telegram API
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            จำลองการส่งข้อมูลทดสอบทางเทคนิคผ่าน Bot Token และ Chat ID ที่ระบุ เพื่อยืนยันว่าการทำงานของ API ปกติและบอทสามารถสื่อสารหาพนักงานได้จริง
          </p>

          <form onSubmit={handleTestSend} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                เลือกสมาชิกเพื่อดึงข้อมูล ID อัตโนมัติ (หรือระบุเองด้านล่าง)
              </label>
              <select
                onChange={(e) => handleSelectUser(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- เลือกผู้ใช้ที่มี Telegram ID --</option>
                {users.filter(u => u.telegram_id).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nickname ? `${u.nickname} ` : ''}({u.first_name}) — ID: {u.telegram_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Telegram ID (Chat ID ของเป้าหมาย) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                placeholder="ป้อนหมายเลข Telegram ID เช่น 82736452"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                ข้อความทดสอบส่งสัญญาณ <span className="text-red-500">*</span>
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none h-24 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isTesting || !testId.trim() || !testMessage.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 mt-4"
            >
              {isTesting ? 'กำลังทดสอบเชื่อมต่อ...' : '✈️ เริ่มส่งสัญญาณทดสอบ'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
