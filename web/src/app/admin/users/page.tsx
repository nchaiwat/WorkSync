'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMe, getAuthToken, logout as authLogout, admin } from '@/lib/auth';
import type { User } from '@/types';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form state
  const [createData, setCreateData] = useState({
    email: '',
    password: '',
    username: '',
    nickname: '',
    first_name: '',
    last_name: '',
    role: '',
    department: '',
    position: '',
    telegram_id: '',
    is_ad_auth: false,
  });

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
      loadUsers();
    } catch {
      router.push('/login');
    }
  };

  const loadUsers = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const result = await admin.getUsers(token);
      setUsers(result.data);
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const token = getAuthToken();
    if (!token) return;

    try {
      await admin.createUser(token, createData);
      setSuccess('สร้างผู้ใช้สำเร็จ');
      setShowCreateModal(false);
      setCreateData({
        email: '',
        password: '',
        username: '',
        nickname: '',
        first_name: '',
        last_name: '',
        role: '',
        department: '',
        position: '',
        telegram_id: '',
        is_ad_auth: false,
      });
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'สร้างผู้ใช้ไม่สำเร็จ');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const token = getAuthToken();
    if (!token || !editingUser) return;

    try {
      await admin.updateUser(token, editingUser.id, {
        first_name: editingUser.first_name,
        last_name: editingUser.last_name,
        email: editingUser.email,
        username: editingUser.username,
        nickname: editingUser.nickname,
        password: (editingUser as any).password || undefined,
        status: editingUser.status,
        department: editingUser.department || undefined,
        position: editingUser.position || undefined,
        telegram_id: editingUser.telegram_id || undefined,
        is_ad_auth: editingUser.is_ad_auth,
      });
      setSuccess('แก้ไขผู้ใช้สำเร็จ');
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'แก้ไขผู้ใช้ไม่สำเร็จ');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('ต้องการลบผู้ใช้นี้หรือไม่?')) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      await admin.deleteUser(token, userId);
      setSuccess('ลบผู้ใช้สำเร็จ');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'ลบผู้ใช้ไม่สำเร็จ');
    }
  };

  const handleLogout = () => {
    authLogout();
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'ยังไม่เคยเข้าสู่ระบบ';
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
                👥 ผู้ใช้งานในระบบ
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow transition-colors flex items-center gap-2"
              >
                <span>➕</span> เพิ่มผู้ใช้ใหม่
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Messages */}
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

        {/* Data Table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role & Dept</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">AD Login</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Access</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      ไม่พบผู้ใช้งานในระบบ
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                              {user.first_name} {user.last_name}
                              {user.nickname && <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">({user.nickname})</span>}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              @{user.username} {user.email && `· ${user.email}`}
                            </div>
                            {user.telegram_id && (
                              <div className="text-xs text-sky-500 dark:text-sky-400 mt-0.5">
                                Telegram: {user.telegram_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-medium border border-blue-200 dark:border-blue-800">
                              {user.role?.name || 'Member'}
                            </span>
                          </div>
                          {user.department && (
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {user.department} {user.position && <span className="text-gray-400 dark:text-gray-500">— {user.position}</span>}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {user.is_ad_auth ? (
                          <span className="text-emerald-500 text-lg font-bold" title="ใช้งาน Active Directory">✔️</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          user.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {user.status === 'active' ? 'Active' : user.status === 'inactive' ? 'Inactive' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(user.last_access)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="แก้ไข"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="ลบ"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">✨ สร้างผู้ใช้ใหม่</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="create-user-form" onSubmit={handleCreateUser} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username <span className="text-rose-500">*</span></label>
                    <input type="text" required value={createData.username} onChange={(e) => setCreateData({ ...createData, username: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="username" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password <span className="text-rose-500">*</span></label>
                    <input type="password" required value={createData.password} onChange={(e) => setCreateData({ ...createData, password: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-5">
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อเล่น</label>
                    <input type="text" value={createData.nickname} onChange={(e) => setCreateData({ ...createData, nickname: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Nickname" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อ <span className="text-rose-500">*</span></label>
                    <input type="text" required value={createData.first_name} onChange={(e) => setCreateData({ ...createData, first_name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="First Name" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">นามสกุล <span className="text-rose-500">*</span></label>
                    <input type="text" required value={createData.last_name} onChange={(e) => setCreateData({ ...createData, last_name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="Last Name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อีเมล</label>
                    <input type="email" value={createData.email} onChange={(e) => setCreateData({ ...createData, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="user@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telegram ID</label>
                    <input type="text" value={createData.telegram_id} onChange={(e) => setCreateData({ ...createData, telegram_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="e.g. 123456789" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">แผนก <span className="text-rose-500">*</span></label>
                    <input type="text" required value={createData.department} onChange={(e) => setCreateData({ ...createData, department: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="เช่น IT, RD, PD, PU" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ตำแหน่ง <span className="text-rose-500">*</span></label>
                    <select required value={createData.position} onChange={(e) => setCreateData({ ...createData, position: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all">
                      <option value="">-- เลือกตำแหน่ง --</option>
                      <option value="Staff">Staff</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Manager">Manager</option>
                      <option value="C-Level">C-Level</option>
                      <option value="CEO">CEO</option>
                    </select>
                  </div>
                </div>
                {/* AD Authentication Toggle */}
                <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30">
                  <input
                    type="checkbox"
                    id="create-is-ad-auth"
                    checked={createData.is_ad_auth}
                    onChange={(e) => setCreateData({ ...createData, is_ad_auth: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="create-is-ad-auth" className="text-sm font-semibold text-blue-800 dark:text-blue-300 cursor-pointer">
                      🏢 ใช้ Active Directory Authentication
                    </label>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      ถ้าเปิดใช้งาน ผู้ใช้จะเข้าระบบด้วย Username/Password จาก AD ของบริษัท และ Telegram ID จะอัปเดตอัตโนมัติจากฟิลด์ Pager ใน AD
                    </p>
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors">ยกเลิก</button>
              <button type="submit" form="create-user-form" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow transition-colors">สร้างบัญชีผู้ใช้</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">✏️ แก้ไขข้อมูล: {editingUser.first_name}</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="edit-user-form" onSubmit={handleUpdateUser} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                    <input type="text" required value={editingUser.username} onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password <span className="text-xs text-gray-400 font-normal">(เว้นว่างหากไม่เปลี่ยน)</span></label>
                    <input type="password" value={(editingUser as any).password || ''} onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value } as any)} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-5">
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อเล่น</label>
                    <input type="text" value={editingUser.nickname || ''} onChange={(e) => setEditingUser({ ...editingUser, nickname: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อ</label>
                    <input type="text" required value={editingUser.first_name} onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">นามสกุล</label>
                    <input type="text" required value={editingUser.last_name} onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">อีเมล</label>
                    <input type="email" value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telegram ID</label>
                    <input type="text" value={editingUser.telegram_id || ''} onChange={(e) => setEditingUser({ ...editingUser, telegram_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">แผนก</label>
                    <input type="text" value={editingUser.department || ''} onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" placeholder="เช่น IT, RD, PD, PU" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ตำแหน่ง</label>
                    <select value={editingUser.position || ''} onChange={(e) => setEditingUser({ ...editingUser, position: e.target.value })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all">
                      <option value="">-- เลือกตำแหน่ง --</option>
                      <option value="Staff">Staff</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Manager">Manager</option>
                      <option value="C-Level">C-Level</option>
                      <option value="CEO">CEO</option>
                    </select>
                  </div>
                </div>
                {/* AD Authentication Toggle */}
                <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30">
                  <input
                    type="checkbox"
                    id="edit-is-ad-auth"
                    checked={editingUser.is_ad_auth ?? false}
                    onChange={(e) => setEditingUser({ ...editingUser, is_ad_auth: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="edit-is-ad-auth" className="text-sm font-semibold text-blue-800 dark:text-blue-300 cursor-pointer">
                      🏢 ใช้ Active Directory Authentication
                    </label>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      ถ้าเปิดใช้งาน ผู้ใช้จะเข้าระบบด้วย Username/Password จาก AD ของบริษัท และ Telegram ID จะอัปเดตอัตโนมัติจากฟิลด์ Pager ใน AD
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สถานะ</label>
                  <select value={editingUser.status} onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as User['status'] })} className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all">
                    <option value="active">Active (ใช้งาน)</option>
                    <option value="inactive">Inactive (ปิดใช้งาน)</option>
                    <option value="suspended">Suspended (ระงับ)</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingUser(null)} className="px-5 py-2.5 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors">ยกเลิก</button>
              <button type="submit" form="edit-user-form" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow transition-colors">บันทึกข้อมูล</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
