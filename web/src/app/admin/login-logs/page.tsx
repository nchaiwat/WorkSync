'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMe, getAuthToken, logout as authLogout, admin } from '@/lib/auth';

interface LoginLog {
  id: string;
  username: string;
  authType: string;
  ipAddress: string;
  status: 'ACCEPT' | 'REJECT' | 'DENIED' | 'ERROR';
  message?: string | null;
  createdAt: string;
}

export default function AdminLoginLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');

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
      loadLogs();
    } catch {
      router.push('/login');
    }
  };

  const loadLogs = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const result = await admin.getLoginLogs(token);
      setLogs(result.data);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถโหลดประวัติการเข้าใช้งานได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authLogout();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Filter logs based on search and filters
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.username.toLowerCase().includes(search.toLowerCase()) ||
      log.ipAddress.toLowerCase().includes(search.toLowerCase()) ||
      (log.message || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || log.status === statusFilter;
    const matchesMode = modeFilter === 'ALL' || log.authType === modeFilter;

    return matchesSearch && matchesStatus && matchesMode;
  });

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
                &larr; กลับหน้าหลัก
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                📋 ประวัติการเข้าใช้งาน (AD/Local Logs)
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
          <div className="flex gap-6 mt-4 border-t border-gray-100 dark:border-slate-700 pt-3">
            <Link
              href="/admin/users"
              className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              👥 ผู้ใช้งานในระบบ
            </Link>
            <Link
              href="/admin/login-logs"
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 pb-2"
            >
              📋 ประวัติการเข้าใช้งาน
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-r-lg p-4 shadow-sm">
            <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Filters Panel */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">ค้นหา</label>
              <input
                type="text"
                placeholder="ค้นหาด้วย Username, IP หรือ รายละเอียด..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">สถานะ</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              >
                <option value="ALL">ทั้งหมด</option>
                <option value="ACCEPT">ACCEPT (สำเร็จ)</option>
                <option value="REJECT">REJECT (รหัสผ่านผิด)</option>
                <option value="DENIED">DENIED (ไม่มีสิทธิ์)</option>
                <option value="ERROR">ERROR (ระบบขัดข้อง)</option>
              </select>
            </div>

            {/* Mode Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">รูปแบบล็อกอิน</label>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              >
                <option value="ALL">ทั้งหมด</option>
                <option value="LOCAL">LOCAL (บัญชีระบบ)</option>
                <option value="AD">AD (Active Directory)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                  <th className="px-6 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">วัน-เวลา</th>
                  <th className="px-6 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</th>
                  <th className="px-6 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">รูปแบบล็อกอิน</th>
                  <th className="px-6 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Client IP</th>
                  <th className="px-6 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">สถานะการทำงาน</th>
                  <th className="px-6 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">รายละเอียด / เหตุผล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      กำลังโหลดข้อมูลประวัติการเข้าใช้งาน...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      ไม่พบประวัติการเข้าใช้งานตามเงื่อนไขที่ค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    // Badge colors logic
                    let statusBadgeClass = '';
                    if (log.status === 'ACCEPT') {
                      statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900';
                    } else if (log.status === 'REJECT') {
                      statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900';
                    } else if (log.status === 'DENIED') {
                      statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900';
                    } else {
                      statusBadgeClass = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900';
                    }

                    return (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors">
                        <td className="px-6 py-1.5 text-sm text-gray-600 dark:text-gray-300">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-1.5">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {log.username}
                          </span>
                        </td>
                        <td className="px-6 py-1.5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${
                            log.authType === 'AD'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900'
                              : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900'
                          }`}>
                            {log.authType === 'AD' ? '🏢 Active Directory' : '👤 Local System'}
                          </span>
                        </td>
                        <td className="px-6 py-1.5 text-sm font-mono text-gray-600 dark:text-gray-300">
                          {log.ipAddress}
                        </td>
                        <td className="px-6 py-1.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-1.5 text-sm text-gray-600 dark:text-gray-300">
                          {log.message || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
