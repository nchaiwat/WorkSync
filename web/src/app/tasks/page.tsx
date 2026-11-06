'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TaskList from '@/components/TaskList';
import ThemeToggle from '@/components/ThemeToggle';
import { api } from '@/lib/api';
import type { Task, User } from '@/types';
import Link from 'next/link';
import { getAuthToken, getMe, formatUserDisplayName } from '@/lib/auth';
import { isCurrentUserMatch, isSamePerson } from '@/lib/userMatch';

export default function TasksPage() {
  const router = useRouter();

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<'assigned_by_me' | 'involved_tasks' | 'all'>('all');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }
    getMe(token)
      .then((user) => {
        setCurrentUser(user);
        const ADMIN_ROLE_ID = 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0';
        const roleId = typeof user.role === 'object' ? user.role?.id : user.role;
        if (roleId === ADMIN_ROLE_ID) {
          router.push('/admin/users');
        }
      })
      .catch(() => {
        router.push('/login');
      });

    api.getUsers().then(setUsers).catch(console.error);
  }, [router]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const member = urlParams.get('member') || urlParams.get('creator');
    const view = urlParams.get('view');

    if (member) {
      setMemberFilter(member);
    }

    if (view === 'assigned_by_me' || view === 'involved_tasks' || view === 'all') {
      setViewFilter(view);
    } else if (view === 'my_tasks') {
      setViewFilter('all');
    }
  }, []);

  const loadTasks = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const result = await api.getTasks();

      // Filter all non-archived tasks related to current user
      const relatedTasks = result.data.filter(
        (t) =>
          !t.is_archived &&
          (t.creator_id === currentUser.id ||
            isCurrentUserMatch(t.created_by_name, currentUser) ||
            isCurrentUserMatch(t.assignee, currentUser) ||
            isCurrentUserMatch(t.manager, currentUser) ||
            (t.collaborators && t.collaborators.some((col) => isCurrentUserMatch(col, currentUser))))
      );

      // Sort by recent update
      relatedTasks.sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      });

      setAllTasks(relatedTasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setAllTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadTasks();
    }
  }, [currentUser, loadTasks]);

  // Tasks involving the selected member
  const memberTasks = useMemo(() => {
    if (!memberFilter) return allTasks;
    return allTasks.filter(
      (t) =>
        isSamePerson(t.assignee, memberFilter) ||
        isSamePerson(t.created_by_name, memberFilter)
    );
  }, [allTasks, memberFilter]);

  // Tasks strictly assigned by currentUser to this member
  const assignedByMeTasks = useMemo(() => {
    if (!currentUser) return [];
    return memberTasks.filter((t) => {
      const isCreator =
        t.creator_id === currentUser.id ||
        isCurrentUserMatch(t.created_by_name, currentUser);
      const isAssigneeNotMe = !isCurrentUserMatch(t.assignee, currentUser);
      const isTargetAssignee = memberFilter
        ? isSamePerson(t.assignee, memberFilter)
        : true;

      return isCreator && isAssigneeNotMe && isTargetAssignee;
    });
  }, [memberTasks, currentUser, memberFilter]);

  // Tasks reported to or involving currentUser (where currentUser is manager/collaborator, not creator)
  const involvedTasks = useMemo(() => {
    if (!currentUser) return [];
    return memberTasks.filter((t) => {
      const isCreator =
        t.creator_id === currentUser.id ||
        isCurrentUserMatch(t.created_by_name, currentUser);
      if (isCreator) return false;

      const isManager = isCurrentUserMatch(t.manager, currentUser);
      const isCollaborator =
        t.collaborators &&
        t.collaborators.some((col) => isCurrentUserMatch(col, currentUser));

      return isManager || isCollaborator;
    });
  }, [memberTasks, currentUser]);

  // Determine tasks to display based on selected viewFilter
  const tasksByView = useMemo(() => {
    if (!memberFilter) return allTasks;
    if (viewFilter === 'assigned_by_me') return assignedByMeTasks;
    if (viewFilter === 'involved_tasks') return involvedTasks;
    return memberTasks;
  }, [memberFilter, viewFilter, assignedByMeTasks, involvedTasks, memberTasks, allTasks]);

  // Apply status filter (all, todo, in_progress, review, done)
  const displayedTasks = useMemo(() => {
    if (statusFilter === 'all') return tasksByView;
    return tasksByView.filter((t) => t.status === statusFilter);
  }, [tasksByView, statusFilter]);

  const handleExportExcel = () => {
    const headers = [
      'หัวข้อภารกิจ',
      'รายละเอียด',
      'เจ้าของโครงการ',
      'สถานะ',
      'ความคืบหน้า',
      'ผู้รับผิดชอบ',
      'ผู้จัดการ',
      'ผู้ร่วมงาน',
      'กำหนดส่ง',
      'ผู้สร้างงาน',
      'วันที่สร้างงาน',
      'อัปเดตล่าสุด',
    ];

    const statusMap: Record<string, string> = {
      todo: 'To Do',
      in_progress: 'Doing',
      review: 'Review',
      done: 'Done',
    };

    const csvRows = [
      headers.join(','),
      ...displayedTasks.map((t) => {
        const title = `"${(t.title || '').replace(/"/g, '""')}"`;
        const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
        const projOwner = `"${(t.project_owner || '').replace(/"/g, '""')}"`;
        const status = `"${statusMap[t.status] || t.status}"`;
        const progress = `"${t.progress || 0}%"`;
        const assignee = `"${(t.assignee || '').replace(/"/g, '""')}"`;
        const manager = `"${(t.manager || '').replace(/"/g, '""')}"`;
        const collaborators = `"${(t.collaborators || []).join('; ').replace(/"/g, '""')}"`;
        const deadline = t.deadline
          ? `"${new Date(t.deadline).toLocaleDateString('th-TH')}"`
          : '""';
        const createdBy = `"${(t.created_by_name || '').replace(/"/g, '""')}"`;
        const createdAt = t.created_at
          ? `"${new Date(t.created_at).toLocaleString('th-TH')}"`
          : '""';
        const updatedAt = t.updated_at
          ? `"${new Date(t.updated_at).toLocaleString('th-TH')}"`
          : '""';

        return [
          title,
          desc,
          projOwner,
          status,
          progress,
          assignee,
          manager,
          collaborators,
          deadline,
          createdBy,
          createdAt,
          updatedAt,
        ].join(',');
      }),
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `worksync_tasks_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const memberNickname = memberFilter
    ? memberFilter.match(/^([^\s(]+)/)?.[1] || memberFilter
    : null;

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 pb-16 transition-colors">
      {/* iOS Translucent Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/85 dark:bg-[#151E2E]/85 border-b border-slate-200/80 dark:border-slate-800/80 shadow-[0_1px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[#007AFF] hover:opacity-80 transition-opacity font-semibold text-sm active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            <span>แดชบอร์ด</span>
          </Link>

          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate max-w-[220px] sm:max-w-md">
            {memberNickname ? `ภารกิจของ ${memberNickname}` : 'ภารกิจทั้งหมด'}
          </h1>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleExportExcel}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm active:scale-95 text-slate-700 dark:text-slate-200"
              title="Export CSV"
            >
              <span>📥</span>
              <span>CSV</span>
            </button>
            <Link
              href="/tasks/new"
              className="px-3.5 py-1.5 bg-[#007AFF] hover:bg-[#0062cc] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.3)] active:scale-95 flex items-center gap-1"
            >
              <span>+</span>
              <span>เพิ่มงาน</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Member View Switcher (Segmented Control) */}
        {memberFilter && (
          <div className="mb-6 bg-white dark:bg-[#151E2E] rounded-3xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">มุมมองภารกิจ</p>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {memberFilter}
                </h2>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] border border-blue-200/60 dark:border-blue-900/40">
                รวม {tasksByView.length} ภารกิจ
              </span>
            </div>

            {/* Segmented Control strictly separating Assigned vs Reported */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
              <button
                onClick={() => setViewFilter('assigned_by_me')}
                className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  viewFilter === 'assigned_by_me'
                    ? 'bg-white dark:bg-slate-700 text-[#007AFF] dark:text-blue-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🎯</span>
                <span className="truncate">งานที่ฉันมอบหมาย</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#007AFF] dark:text-blue-300 font-mono">
                  {assignedByMeTasks.length}
                </span>
              </button>

              <button
                onClick={() => setViewFilter('involved_tasks')}
                className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  viewFilter === 'involved_tasks'
                    ? 'bg-white dark:bg-slate-700 text-[#007AFF] dark:text-blue-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>👥</span>
                <span className="truncate">งานที่รายงานฉัน</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                  {involvedTasks.length}
                </span>
              </button>

              <button
                onClick={() => setViewFilter('all')}
                className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  viewFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>📋</span>
                <span className="truncate">ทั้งหมด</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                  {memberTasks.length}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Status Pills */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'todo', label: 'To Do' },
            { id: 'in_progress', label: 'Doing' },
            { id: 'review', label: 'Review' },
            { id: 'done', label: 'Done' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === item.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-[#151E2E] text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Tasks List Content */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#007AFF] border-t-transparent" />
            <p className="text-xs text-slate-400 mt-3 font-medium">กำลังโหลดภารกิจ...</p>
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#151E2E] border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] flex items-center justify-center text-2xl">
              {viewFilter === 'assigned_by_me' ? '🎯' : viewFilter === 'involved_tasks' ? '👥' : '📋'}
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
              {viewFilter === 'assigned_by_me'
                ? `ไม่มีงานที่คุณมอบหมายให้ ${memberNickname || 'สมาชิกคนนี้'}`
                : viewFilter === 'involved_tasks'
                ? `ไม่มีงานที่ ${memberNickname || 'สมาชิกคนนี้'} รายงานถึงคุณ`
                : 'ไม่พบภารกิจในสถานะนี้'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              {viewFilter === 'assigned_by_me'
                ? 'หากต้องการมอบหมายงานใหม่ สามารถกดปุ่ม + เพิ่มงาน แล้วเลือกโหมด "มอบหมายงานให้ทีม"'
                : 'งานที่เกี่ยวข้องจะแสดงเมื่อมีภารกิจที่ตรงกับเงื่อนไข'}
            </p>
          </div>
        ) : (
          <TaskList
            tasks={displayedTasks}
            loading={false}
            currentUserName={currentUser?.first_name || currentUser?.username}
            users={users}
          />
        )}
      </main>
    </div>
  );
}
