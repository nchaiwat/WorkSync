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
  const [currentRawUser, setCurrentRawUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentDepartment, setCurrentDepartment] = useState('');
  const [currentPosition, setCurrentPosition] = useState('');

  // Mode: 'self' = งานของฉัน, 'assign' = มอบหมายงานให้ทีม
  const [taskMode, setTaskMode] = useState<'self' | 'assign'>('self');
  const [assignedUser, setAssignedUser] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');

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
  }, [router]);

  useEffect(() => {
    const name = getAuthFirstName() || getAuthUsername() || 'ไม่ทราบชื่อ';
    setCurrentUser(name);
    
    // Load users for dropdown
    const token = getAuthToken();
    if (token) {
      api.getUsers().then((data: User[]) => {
        setUsers(data);
        const me = data.find(u => 
          u.first_name === name || u.username === name
        );
        if (me) {
          setCurrentRawUser(me);
          setCurrentDepartment(me.department || '');
          setCurrentPosition(me.position || '');
          const formatted = formatUserDisplayName(me);
          setCurrentUser(formatted);
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
    return 1;
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
    return mgrRank >= 5;
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

  // Candidate assignees for delegation (excluding CEO, sorted by department and matching search)
  const candidateAssignees = useMemo(() => {
    const filtered = users.filter(u => {
      const isMe = currentRawUser && (u.id === currentRawUser.id || u.username === currentRawUser.username);
      if (isMe) return false;
      if (assigneeSearch.trim()) {
        const q = assigneeSearch.toLowerCase();
        const display = formatUserDisplayName(u).toLowerCase();
        const full = `${u.first_name} ${u.last_name} ${u.username} ${u.department || ''}`.toLowerCase();
        return display.includes(q) || full.includes(q);
      }
      return true;
    });

    if (!currentDepartment) {
      return { sameDept: filtered, otherDept: [] };
    }
    const sameDept = filtered.filter(u => u.department === currentDepartment);
    const otherDept = filtered.filter(u => u.department !== currentDepartment);
    return { sameDept, otherDept };
  }, [users, currentDepartment, currentRawUser, assigneeSearch]);

  // Candidate colleagues (excluding CEO and assigned user)
  const candidateColleagues = useMemo(() => {
    const valid = users.filter(u => {
      if ((u.position || '').toLowerCase().trim() === 'ceo') return false;
      if (taskMode === 'assign' && assignedUser) {
        if (u.first_name === assignedUser || u.username === assignedUser) return false;
      }
      return true;
    });
    if (!currentDepartment) {
      return { sameDept: valid, otherDept: [] };
    }
    const sameDept = valid.filter(u => u.department === currentDepartment);
    const otherDept = valid.filter(u => u.department !== currentDepartment);
    return { sameDept, otherDept };
  }, [users, currentDepartment, taskMode, assignedUser]);

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
      let finalAssignee = currentUser;
      let finalManager = '';

      if (taskMode === 'assign') {
        if (!assignedUser) {
          alert('กรุณาเลือกผู้รับผิดชอบงานที่ต้องการมอบหมาย');
          setIsSubmitting(false);
          return;
        }

        const targetUser = users.find(u => u.first_name === assignedUser || u.username === assignedUser || formatUserDisplayName(u) === assignedUser);
        if (!targetUser) {
          alert('ผู้รับผิดชอบที่เลือกไม่มีตัวตนในระบบ');
          setIsSubmitting(false);
          return;
        }
        finalAssignee = formatUserDisplayName(targetUser);

        // When delegating, default manager to current logged-in user
        if (formData.manager) {
          const m = users.find(u => u.first_name === formData.manager || u.username === formData.manager);
          finalManager = m ? formatUserDisplayName(m) : currentUser;
        } else {
          finalManager = currentUser;
        }
      } else {
        // Self-created task
        finalAssignee = currentUser;
        if (formData.manager) {
          const m = users.find(u => u.first_name === formData.manager || u.username === formData.manager);
          if (m) finalManager = formatUserDisplayName(m);
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

      const formattedColleagues = formData.colleagues.map(colName => {
        const c = users.find(u => u.first_name === colName || u.username === colName);
        return c ? formatUserDisplayName(c) : colName;
      });

      await api.createTask({
        title: formData.title,
        description: formData.description,
        assignee: finalAssignee,
        manager: finalManager,
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
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 pb-16 transition-colors duration-150">
      {/* iOS Translucent Frosted Glass Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-[#151D2A]/80 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-[#007AFF] hover:opacity-80 transition-opacity font-medium text-sm sm:text-base py-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            <span>กลับ</span>
          </button>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            เพิ่มภารกิจใหม่
          </h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* iOS Native Segmented Control for Task Mode */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex p-1 bg-slate-200/80 dark:bg-slate-800/90 rounded-2xl w-full max-w-md shadow-inner">
            <button
              type="button"
              onClick={() => {
                setTaskMode('self');
                setFormData(prev => ({ ...prev, manager: '' }));
              }}
              className={`flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                taskMode === 'self'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>👤</span>
              <span>สร้างงานของฉัน</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTaskMode('assign');
                if (currentRawUser) {
                  setFormData(prev => ({ ...prev, manager: currentRawUser.first_name || currentRawUser.username }));
                }
              }}
              className={`flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                taskMode === 'assign'
                  ? 'bg-[#007AFF] text-white shadow-[0_2px_8px_rgba(0,122,255,0.3)]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🎯</span>
              <span>มอบหมายงานให้ทีม</span>
            </button>
          </div>
        </div>

        {taskMode === 'assign' && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div className="text-xs sm:text-sm text-blue-900 dark:text-blue-200 leading-relaxed">
              <span className="font-bold">โหมดมอบหมายงาน:</span> คุณกำลังสร้างงานให้สมาชิกในทีม โดยคุณจะเป็นหัวหน้างาน (Manager) ผู้มอบหมาย และระบบจะส่งการแจ้งเตือนไปยัง Telegram ของผู้รับผิดชอบงานโดยตรง
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: ข้อมูลภารกิจ (Project Details) */}
          <div className="rounded-2xl bg-white dark:bg-[#151D2A] border border-slate-200/80 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#007AFF] dark:text-blue-400 flex items-center gap-1.5">
              <span>📂</span> ข้อมูลโครงการและภารกิจ
            </h3>
            
            {/* Title */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                📌 หัวข้องาน <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white dark:focus:bg-slate-800 transition-all text-sm"
                placeholder="เช่น ปรับปรุงระบบสต็อกสินค้า Phase 2"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                💬 รายละเอียดงาน
              </label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white dark:focus:bg-slate-800 transition-all text-sm"
                rows={3}
                placeholder="ระบุข้อกำหนด ขอบเขตงาน หรือผลลัพธ์ที่ต้องการ..."
              />
            </div>

            {/* Project Owner */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                👑 Project Owner (เจ้าของโครงการ/ฝ่ายที่ขอ)
              </label>
              <input
                type="text"
                list="new-project-owners"
                value={formData.project_owner}
                onChange={e => setFormData(prev => ({ ...prev, project_owner: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white dark:focus:bg-slate-800 transition-all text-sm"
                placeholder="เช่น IT, ฝ่ายขาย, ลูกค้าภายนอก"
              />
              <datalist id="new-project-owners">
                {users.map(u => {
                  const displayName = formatUserDisplayName(u);
                  const hint = `${u.first_name} ${u.last_name} (@${u.username})${u.department ? ` — ${u.department}` : ''}`;
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
          <div className="rounded-2xl bg-white dark:bg-[#151D2A] border border-slate-200/80 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <span>👥</span> ผู้รับผิดชอบและทีมงาน
            </h3>

            {/* Assignee Selection */}
            {taskMode === 'self' ? (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  👤 ผู้รับผิดชอบงาน
                </label>
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#007AFF] dark:text-blue-300 font-bold flex items-center justify-center text-xs">
                    {currentUser.charAt(0)}
                  </div>
                  <span>{currentUser || 'กำลังโหลด...'}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#007AFF] border border-blue-200/60 dark:border-blue-900/40">
                    งานตัวเอง
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  🎯 เลือกผู้รับผิดชอบงาน (Assignee) <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={assigneeSearch}
                      onChange={e => setAssigneeSearch(e.target.value)}
                      placeholder="🔍 ค้นหาชื่อ นามสกุล ชื่อเล่น หรือแผนก..."
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
                  </div>

                  <select
                    value={assignedUser}
                    onChange={e => setAssignedUser(e.target.value)}
                    required={taskMode === 'assign'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF] text-sm cursor-pointer shadow-sm"
                  >
                    <option value="">-- เลือกผู้รับผิดชอบงาน --</option>
                    {candidateAssignees.sameDept.length > 0 && (
                      <optgroup label={`คนในแผนก ${currentDepartment || 'เดียวกัน'}`}>
                        {candidateAssignees.sameDept.map(u => (
                          <option key={u.id} value={u.first_name || u.username}>
                            {u.nickname ? `${u.nickname} ` : ''}({u.first_name}) {u.last_name} — {u.position || 'Staff'}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {candidateAssignees.otherDept.length > 0 && (
                      <optgroup label="แผนกอื่น ๆ ในองค์กร">
                        {candidateAssignees.otherDept.map(u => (
                          <option key={u.id} value={u.first_name || u.username}>
                            {u.nickname ? `${u.nickname} ` : ''}({u.first_name}) {u.last_name} — {u.department || 'ทั่วไป'} ({u.position || 'Staff'})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>
            )}

            {/* Manager Selection */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                👔 Manager (หัวหน้างาน / ผู้มอบหมาย)
              </label>
              {taskMode === 'assign' ? (
                <div className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-semibold text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👔</span>
                    <span>{currentUser}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/40">
                    ผู้มอบหมายงาน
                  </span>
                </div>
              ) : (
                <select
                  value={formData.manager}
                  onChange={e => setFormData(prev => ({ ...prev, manager: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007AFF] text-sm cursor-pointer shadow-sm"
                >
                  <option value="">-- ไม่กำหนด / รายงานตรง --</option>
                  {candidateManagers.sameDept.map(u => (
                    <option key={u.id} value={u.first_name || u.username}>
                      {u.first_name} {u.last_name} (@{u.username})
                      {u.department ? ` — ${u.department}` : ''}
                      {u.position ? ` (${u.position})` : ''}
                    </option>
                  ))}
                  {candidateManagers.sameDept.length > 0 && candidateManagers.otherDept.length > 0 && (
                    <option disabled className="text-slate-400">
                      ──────── คนแผนกอื่น ────────
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
              )}
            </div>

            {/* Colleagues / Collaborators */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                🤝 เพื่อนร่วมงานที่ช่วยเหลือ (Collaborators)
              </label>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700/80 p-3 bg-slate-50/40 dark:bg-slate-800/40 space-y-1">
                {candidateColleagues.sameDept.map(u => (
                  <label key={u.id} className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer text-xs sm:text-sm">
                    <input
                      type="checkbox"
                      checked={formData.colleagues.includes(u.first_name || u.username)}
                      onChange={() => toggleColleague(u.first_name || u.username)}
                      className="rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF] w-4 h-4"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {u.nickname ? `${u.nickname} ` : ''}({u.first_name}) {u.last_name}
                      {u.position && <span className="text-xs text-slate-500 font-normal"> — {u.position}</span>}
                    </span>
                  </label>
                ))}
                {candidateColleagues.otherDept.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 my-2 pt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    แผนกอื่น ๆ
                  </div>
                )}
                {candidateColleagues.otherDept.map(u => (
                  <label key={u.id} className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-white dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer text-xs sm:text-sm">
                    <input
                      type="checkbox"
                      checked={formData.colleagues.includes(u.first_name || u.username)}
                      onChange={() => toggleColleague(u.first_name || u.username)}
                      className="rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF] w-4 h-4"
                    />
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {u.nickname ? `${u.nickname} ` : ''}({u.first_name}) {u.last_name}
                      {u.department && <span className="text-xs text-slate-500 font-normal"> ({u.department})</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: การวัดผลและกำหนดส่ง (Status & Deadline) */}
          <div className="rounded-2xl bg-white dark:bg-[#151D2A] border border-slate-200/80 dark:border-slate-800/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-5 sm:p-6 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span>⚙️</span> การวัดผลและกำหนดส่ง (Status & Schedule)
            </h3>

            {/* Status Pills */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                🔄 สถานะเริ่มต้น
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['todo', 'in_progress', 'review', 'done'] as const).map((status) => {
                  const active = formData.status === status;
                  const config = STATUS_CONFIG[status];
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, status }))}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-center flex items-center justify-center gap-1.5 ${
                        active
                          ? `${config.bgColor} ${config.color} border-[#007AFF] shadow-sm font-bold`
                          : 'bg-slate-50/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progress Slider */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                  📈 ความคืบหน้าเริ่มต้น
                </label>
                <span className="text-sm font-bold text-[#007AFF] font-mono">
                  {formData.progress}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.progress}
                onChange={e => setFormData(prev => ({ ...prev, progress: parseInt(e.target.value) || 0 }))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#007AFF] focus:outline-none"
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                📅 กำหนดส่ง (Deadline)
              </label>
              <div className="relative">
                <div className="absolute inset-0 flex items-center px-3.5 pointer-events-none z-10 rounded-xl">
                  <span className={formData.deadline ? 'text-slate-900 dark:text-slate-100 font-medium text-sm' : 'text-slate-400 text-sm'}>
                    {formData.deadline ? getDisplayDeadline(formData.deadline) : 'เลือกวันกำหนดส่ง...'}
                  </span>
                  <span className="ml-auto text-base">📅</span>
                </div>
                <input
                  type="date"
                  value={toInputDateValue(formData.deadline)}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      const [y, m, d] = val.split('-').map(Number);
                      const local = new Date(y, m - 1, d, 12, 0, 0);
                      setFormData(prev => ({ ...prev, deadline: local.toISOString() }));
                    } else {
                      setFormData(prev => ({ ...prev, deadline: '' }));
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-transparent shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#007AFF] hover:bg-[#0062cc] disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-sm sm:text-base transition-all shadow-[0_4px_14px_rgba(0,122,255,0.3)] active:scale-[0.98]"
            >
              {isSubmitting ? 'กำลังบันทึก...' : taskMode === 'assign' ? '🎯 มอบหมายงานนี้' : '➕ สร้างงานของฉัน'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
