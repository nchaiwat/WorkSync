'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getAuthFirstName, getAuthUsername, getAuthToken, getMe, formatUserDisplayName } from '@/lib/auth';
import { STATUS_CONFIG } from '@/types';
import type { User } from '@/types';

export default function NewTaskPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [currentDepartment, setCurrentDepartment] = useState('');
  const [currentPosition, setCurrentPosition] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    manager: '',
    status: 'todo' as 'todo' | 'in_progress' | 'review' | 'done',
    progress: 0,
    deadline: '',
    colleagues: [] as string[],
    project_owner: '',
  });

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }
    
    getMe(token)
      .then((user) => {
        const ADMIN_ROLE_ID = 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0';
        const roleId = typeof user.role === 'object' ? user.role?.id : user.role;
        if (roleId === ADMIN_ROLE_ID) {
          router.push('/admin/users');
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, []);

  useEffect(() => {
    const name = getAuthFirstName() || getAuthUsername() || 'ไม่ทราบชื่อ';
    setCurrentUser(name);
    
    // Load users for dropdown
    const token = getAuthToken();
    if (token) {
      api.getUsers().then((data: User[]) => {
        setUsers(data);
        // Find current user's department
        const me = data.find(u => 
          u.first_name === name || u.username === name
        );
        if (me) {
          setCurrentDepartment(me.department || '');
          setCurrentPosition(me.position || '');
          setCurrentUser(formatUserDisplayName(me)); // set formatted name as assignee
        }
      }).catch(() => {});
    }
  }, []);

  const getPositionRank = (position?: string): number => {
    const pos = (position || '').toLowerCase().trim();
    if (pos === 'staff') return 1;
    if (pos === 'supervisor') return 2;
    if (pos === 'manager') return 3;
    if (pos === 'c-level' || pos === 'c level') return 4;
    if (pos === 'ceo') return 5;
    return 1; // default fallback
  };

  const isAllowedManager = (managerPosition?: string): boolean => {
    const userRank = getPositionRank(currentPosition);
    const mgrRank = getPositionRank(managerPosition);

    if (userRank <= 2) {
      return mgrRank >= 2;
    }
    if (userRank === 3) {
      return mgrRank >= 3;
    }
    return mgrRank >= 5; // C-Level and CEO can only choose CEO (Rank 5)
  };

  // Candidate managers matching the position hierarchy rules
  const candidateManagers = useMemo(() => {
    const valid = users.filter(u => isAllowedManager(u.position));
    if (!currentDepartment) {
      return { sameDept: valid, otherDept: [] };
    }
    const sameDept = valid.filter(u => u.department === currentDepartment);
    const otherDept = valid.filter(u => u.department !== currentDepartment);
    return { sameDept, otherDept };
  }, [users, currentPosition, currentDepartment]);

  // Candidate colleagues (excluding CEO, sorted by department)
  const candidateColleagues = useMemo(() => {
    const valid = users.filter(u => (u.position || '').toLowerCase().trim() !== 'ceo');
    if (!currentDepartment) {
      return { sameDept: valid, otherDept: [] };
    }
    const sameDept = valid.filter(u => u.department === currentDepartment);
    const otherDept = valid.filter(u => u.department !== currentDepartment);
    return { sameDept, otherDept };
  }, [users, currentDepartment]);

  const toggleColleague = (userId: string) => {
    setFormData({
      ...formData,
      colleagues: formData.colleagues.includes(userId)
        ? formData.colleagues.filter(c => c !== userId)
        : [...formData.colleagues, userId],
    });
  };

  const getDisplayDeadline = (deadlineStr: string) => {
    if (!deadlineStr) return '';
    const date = new Date(deadlineStr);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Convert ISO/date string to YYYY-MM-DD (value for input[type=date])
  const toInputDateValue = (deadlineStr: string) => {
    if (!deadlineStr) return '';
    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Validate manager exists
      if (formData.manager) {
        const managerExists = users.find(u => u.first_name === formData.manager || u.username === formData.manager);
        if (!managerExists) {
          alert('Manager ที่เลือกไม่มีตัวตนในระบบ');
          setIsSubmitting(false);
          return;
        }
      }

      // Validate colleagues exist
      for (const colName of formData.colleagues) {
        const colExists = users.find(u => u.first_name === colName || u.username === colName);
        if (!colExists) {
          alert('เพื่อนร่วมงานที่เลือกมีบางคนที่ไม่มีตัวตนในระบบ');
          setIsSubmitting(false);
          return;
        }
      }

      // Transform manager to formatted name if set
      let formattedManager = '';
      if (formData.manager) {
        const m = users.find(u => u.first_name === formData.manager || u.username === formData.manager);
        if (m) formattedManager = formatUserDisplayName(m);
      }

      const formattedColleagues = formData.colleagues.map(colName => {
        const c = users.find(u => u.first_name === colName || u.username === colName);
        return c ? formatUserDisplayName(c) : colName;
      });

      await api.createTask({
        title: formData.title,
        description: formData.description,
        assignee: currentUser,
        manager: formattedManager,
        status: formData.status,
        progress: formData.progress,
        deadline: formData.deadline || null,
        collaborators: formattedColleagues,
        avatar_url: '',
        project_owner: formData.project_owner || null,
      });
      router.push('/');
    } catch (err: any) {
      alert('สร้างงานไม่สำเร็จ: ' + (err?.message || String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => router.back()} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
              ← กลับ
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              ➕ เพิ่มงานใหม่
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: ข้อมูลโครงการ (Project Details) */}
          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-slate-50/10 dark:bg-slate-900/10 space-y-4 shadow-sm">
            <h3 className="text-sm font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>📂</span> ข้อมูลโครงการ (Project Details)
            </h3>
            
            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                📌 ชื่องาน <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-slate-350 dark:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 transition-colors focus:outline-none shadow-sm"
                placeholder="เช่น พัฒนาฟีเจอร์ใหม่"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                💬 รายละเอียด
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-slate-355 dark:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 transition-colors focus:outline-none shadow-sm"
                rows={3}
                placeholder="รายละเอียดงาน..."
              />
            </div>

            {/* Project Owner */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                👑 Project Owner (เจ้าของโครงการ)
              </label>
              <input
                type="text"
                list="new-project-owners"
                value={formData.project_owner}
                onChange={e => setFormData(prev => ({ ...prev, project_owner: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-slate-355 dark:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 transition-colors focus:outline-none shadow-sm"
                placeholder="เช่น Phatta/AC, IT, บัญชี"
              />
              <datalist id="new-project-owners">
                {users.map(u => {
                  const displayName = formatUserDisplayName(u);
                  const hint = `${u.first_name} ${u.last_name} (@${u.username})${u.department ? ` — ${u.department}` : ''}${u.position ? ` (${u.position})` : ''}`;
                  return (
                    <option key={u.id} value={displayName}>
                      {hint}
                    </option>
                  );
                })}
              </datalist>
            </div>
          </div>

          {/* Section 2: ผู้เกี่ยวข้องในการดำเนินงาน (People Involved) */}
          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-slate-50/10 dark:bg-slate-900/10 space-y-4 shadow-sm">
            <h3 className="text-sm font-extrabold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>👥</span> ผู้เกี่ยวข้องในการดำเนินงาน (People Involved)
            </h3>

            {/* Assignee - Auto-set to current user (read-only) */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                👤 ผู้รับผิดชอบ
              </label>
              <div className="w-full px-3 py-2.5 border-2 border-slate-200 dark:border-slate-600/50 rounded-lg bg-gray-50 dark:bg-slate-700/60 text-gray-800 dark:text-gray-200 shadow-sm font-bold flex items-center gap-2">
                <span>👤</span> {currentUser || 'กำลังโหลด...'}
              </div>
            </div>

            {/* Manager - Dropdown */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                👔 Manager (หัวหน้า)
              </label>
              <select
                value={formData.manager}
                onChange={e => setFormData(prev => ({ ...prev, manager: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-slate-355 dark:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 transition-colors focus:outline-none shadow-sm cursor-pointer"
              >
                <option value="">-- ไม่กำหนด --</option>
                {candidateManagers.sameDept.map(u => (
                  <option key={u.id} value={u.first_name || u.username}>
                    {u.first_name} {u.last_name} (@{u.username})
                    {u.department ? ` — ${u.department}` : ''}
                    {u.position ? ` (${u.position})` : ''}
                  </option>
                ))}
                {candidateManagers.sameDept.length > 0 && candidateManagers.otherDept.length > 0 && (
                  <option disabled className="text-gray-400 dark:text-gray-500">
                    ──────────────────── คนแผนกอื่น ────────────────────
                  </option>
                )}
                {candidateManagers.otherDept.map(u => (
                  <option key={u.id} value={u.first_name || u.username}>
                    {u.first_name} {u.last_name} (@{u.username})
                    {u.department ? ` — ${u.department}` : ''}
                    {u.position ? ` (${u.position})` : ''}
                  </option>
                ))}
              </select>
              {currentDepartment && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  แสดงเฉพาะคนในแผนก {currentDepartment} ก่อน
                </p>
              )}
            </div>

            {/* Colleagues - Checkboxes */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                🤝 เพื่อนร่วมงาน (Colleagues)
              </label>
              <div className="max-h-48 overflow-y-auto border-2 border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700 shadow-inner">
                {candidateColleagues.sameDept.length === 0 && candidateColleagues.otherDept.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    ยังไม่มีผู้ใช้ในระบบ
                  </p>
                ) : (
                  <>
                    {candidateColleagues.sameDept.map(u => (
                      <label key={u.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-600/30 rounded px-1 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.colleagues.includes(u.first_name || u.username)}
                          onChange={() => toggleColleague(u.first_name || u.username)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {u.first_name} {u.last_name} (@{u.username})
                          {u.position && <span className="text-xs text-gray-550"> — {u.position}</span>}
                        </span>
                      </label>
                    ))}
                    
                    {candidateColleagues.sameDept.length > 0 && candidateColleagues.otherDept.length > 0 && (
                      <div className="border-t border-dashed border-gray-300 dark:border-slate-600 my-2 pt-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        คนแผนกอื่น
                      </div>
                    )}

                    {candidateColleagues.otherDept.map(u => (
                      <label key={u.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-600/30 rounded px-1 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.colleagues.includes(u.first_name || u.username)}
                          onChange={() => toggleColleague(u.first_name || u.username)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                          {u.first_name} {u.last_name} (@{u.username})
                          {u.department && (
                            <span className="text-xs text-gray-450"> ({u.department})</span>
                          )}
                          {u.position && <span className="text-xs text-gray-550"> — {u.position}</span>}
                        </span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: การวัดผลและกำหนดส่ง (Status & Deadline) */}
          <div className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-slate-50/10 dark:bg-slate-900/10 space-y-4 shadow-sm">
            <h3 className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>⚙️</span> การวัดผลและกำหนดส่ง (Status & Deadline)
            </h3>

            {/* Status + Progress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  🔄 สถานะ
                </label>
                <div className="flex gap-2">
                  {(['todo', 'in_progress', 'review', 'done'] as const).map((status) => {
                    const active = formData.status === status;
                    const config = STATUS_CONFIG[status];
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, status }))}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                          active
                            ? `${config.bgColor} ${config.color} border-primary-500 shadow-sm`
                            : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  📈 ความคืบหน้า ({formData.progress}%)
                </label>
                <div className="flex items-center gap-4 mt-2 h-10">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={e => setFormData(prev => ({ ...prev, progress: parseInt(e.target.value) || 0 }))}
                    className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                📅 กำหนดส่ง
              </label>
              <div className="relative">
                {/* Visible overlay showing dd/mm/yyyy */}
                <div
                  className="absolute inset-0 flex items-center px-3 pointer-events-none z-10 rounded-lg"
                >
                  <span className={formData.deadline ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
                    {formData.deadline ? getDisplayDeadline(formData.deadline) : 'dd/mm/yyyy'}
                  </span>
                  <span className="ml-auto text-lg">📅</span>
                </div>
                {/* Native date input — full-area clickable, visually hidden by opacity but NOT pointer-events:none */}
                <input
                  type="date"
                  value={toInputDateValue(formData.deadline)}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      // Parse as local date to avoid timezone shift
                      const [y, m, d] = val.split('-').map(Number);
                      const local = new Date(y, m - 1, d, 12, 0, 0); // noon to avoid DST
                      setFormData(prev => ({ ...prev, deadline: local.toISOString() }));
                    } else {
                      setFormData(prev => ({ ...prev, deadline: '' }));
                    }
                  }}
                  style={{ colorScheme: 'auto', WebkitAppearance: 'none' } as React.CSSProperties}
                  className="w-full px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg bg-white dark:bg-slate-700 text-transparent dark:text-transparent shadow-sm cursor-pointer focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg font-bold transition-colors shadow-md"
            >
              {isSubmitting ? 'กำลังสร้าง...' : '➕ สร้างงาน'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 border-2 border-gray-300 dark:border-slate-600 rounded-lg text-gray-750 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold transition-colors shadow-sm"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
