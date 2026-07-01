'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMe, getAuthToken, logout as authLogout, admin } from '@/lib/auth';
import { api } from '@/lib/api';
import type { User } from '@/types';

export default function AdminAnnouncePage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Filter out users without telegram_id or with inactive status if needed, but show all active users.
      const activeUsers = result.data.filter((u: any) => u.status === 'active');
      setUsers(activeUsers);
      // Select all by default
      setSelectedUserIds(activeUsers.map((u: any) => u.id));
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(users.map(u => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('กรุณาระบุข้อความประกาศ');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('กรุณาเลือกผู้รับอย่างน้อย 1 คน');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await api.sendAnnouncement(message, selectedUserIds);
      setSuccess(`ประกาศข่าวสารสำเร็จ บรอดแคสต์ข้อความหาทีมงานทั้งหมด ${selectedUserIds.length} รายการ เรียบร้อยแล้ว`);
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'ส่งประกาศไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
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
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 pb-2"
            >
              📢 ประกาศระบบ
            </Link>
            <Link
              href="/admin/telegram"
              className="text-sm font-medium text-gray-500 hover:text-gray-750 dark:text-gray-400 dark:hover:text-gray-200 pb-2 border-b-2 border-transparent"
            >
              ✈️ จัดการ Telegram
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Announcement Form */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm h-fit">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              📝 ส่งประกาศข้อความใหม่
            </h2>
            <form onSubmit={handleSendAnnouncement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  เนื้อหาประกาศข่าวสาร <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="พิมพ์ข้อความที่ต้องการประกาศและส่งผ่าน Telegram บอท..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none h-48 resize-none shadow-inner"
                  required
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold">
                  👥 จำนวนผู้รับข้อความ: <span className="text-blue-600 dark:text-blue-400 font-bold">{selectedUserIds.length} คน</span>
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim() || selectedUserIds.length === 0}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-95 flex items-center gap-2"
                >
                  {isSubmitting ? 'กำลังส่งประกาศ...' : '📢 บรอดแคสต์ประกาศ'}
                </button>
              </div>
            </form>
          </div>

          {/* User Checklist */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-105 dark:border-slate-750 pb-3 mb-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                👥 รายชื่อผู้รับประกาศ
              </h2>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-blue-605 dark:text-blue-400">
                <input
                  type="checkbox"
                  checked={selectedUserIds.length === users.length && users.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                เลือกทั้งหมด
              </label>
            </div>

            <div className="overflow-y-auto max-h-[350px] pr-1 space-y-2.5">
              {users.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">ไม่พบรายชื่อพนักงาน</p>
              ) : (
                users.map((user) => {
                  const hasTelegram = !!user.telegram_id;
                  const isChecked = selectedUserIds.includes(user.id);
                  return (
                    <div 
                      key={user.id}
                      onClick={() => handleToggleUser(user.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
                        isChecked 
                          ? 'border-blue-200 bg-blue-50/20 dark:border-blue-900/60 dark:bg-blue-950/10' 
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by div onClick
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                            {user.nickname ? `${user.nickname} ` : ''}({user.first_name})
                          </p>
                          <p className="text-[10px] text-gray-450 dark:text-gray-500 truncate font-medium">
                            {user.department || 'ไม่ระบุแผนก'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        hasTelegram 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                      }`}>
                        {hasTelegram ? 'Telegram' : 'ไม่มี ID'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
