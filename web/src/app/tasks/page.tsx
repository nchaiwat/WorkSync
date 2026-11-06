'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TaskList from '@/components/TaskList';
import { api } from '@/lib/api';
import type { Task, User } from '@/types';
import Link from 'next/link';
import { getAuthToken, getMe, formatUserDisplayName } from '@/lib/auth';

export default function TasksPage() {
  const router = useRouter();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [unfilteredTasks, setUnfilteredTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; username: string; first_name: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }
    getMe(token)
      .then((user) => {
        setCurrentUser({
          id: user.id,
          name: formatUserDisplayName(user),
          username: user.username || '',
          first_name: user.first_name || '',
        });
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
    const creator = urlParams.get('creator');
    if (creator) {
      setCreatorFilter(creator);
    }
  }, []);

  const isUserMatch = (taskField: string | null | undefined) => {
    if (!taskField || !currentUser) return false;
    if (taskField === currentUser.name) return true;
    if (currentUser.first_name && taskField.includes(`(${currentUser.first_name})`)) return true;
    if (currentUser.username && taskField.includes(`(${currentUser.username})`)) return true;
    if (taskField === currentUser.first_name || taskField === currentUser.username) return true;
    return false;
  };

  const loadTasks = async () => {
    try {
      const result = await api.getTasks();
      
      let relatedTasks = result.data.filter(
        (t) =>
          !t.is_archived &&
          (t.creator_id === currentUser?.id ||
          isUserMatch(t.assignee) ||
          isUserMatch(t.manager) ||
          (t.collaborators && t.collaborators.some((col) => isUserMatch(col))))
      );
      
      setUnfilteredTasks(relatedTasks);

      let filtered = [...relatedTasks];
      if (creatorFilter) {
        filtered = filtered.filter(t => t.created_by_name === creatorFilter || t.assignee === creatorFilter);
      }

      filtered.sort((a, b) => {
        const aIsManager = isUserMatch(a.manager);
        const bIsManager = isUserMatch(b.manager);
        if (aIsManager && !bIsManager) return -1;
        if (!aIsManager && bIsManager) return 1;

        const aIsAssignee = isUserMatch(a.assignee);
        const bIsAssignee = isUserMatch(b.assignee);
        if (aIsAssignee && !bIsAssignee) return -1;
        if (!aIsAssignee && bIsAssignee) return 1;

        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      });
      
      setTasks(filtered);
    } catch {
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadTasks();
    }
  }, [creatorFilter, currentUser]);

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
      'อัปเดตความคืบหน้าล่าสุด'
    ];

    const statusMap: Record<string, string> = {
      todo: 'To Do',
      in_progress: 'Doing',
      review: 'Review',
      done: 'Done'
    };

    const csvRows = [
      headers.join(','),
      ...unfilteredTasks.map(t => {
        const title = `"${(t.title || '').replace(/"/g, '""')}"`;
        const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
        const projOwner = `"${(t.project_owner || '').replace(/"/g, '""')}"`;
        const status = `"${statusMap[t.status] || t.status}"`;
        const progress = `"${t.progress || 0}%"`;
        const assignee = `"${(t.assignee || '').replace(/"/g, '""')}"`;
        const manager = `"${(t.manager || '').replace(/"/g, '""')}"`;
        const collaborators = `"${(t.collaborators || []).join('; ').replace(/"/g, '""')}"`;
        const deadline = t.deadline ? `"${new Date(t.deadline).toLocaleDateString('th-TH')}"` : '""';
        const createdBy = `"${(t.created_by_name || '').replace(/"/g, '""')}"`;
        const createdAt = t.created_at ? `"${new Date(t.created_at).toLocaleString('th-TH')}"` : '""';
        const updatedAt = t.updated_at ? `"${new Date(t.updated_at).toLocaleString('th-TH')}"` : '""';
        
        let latestUpdate = t.latest_update || '';
        const sections = latestUpdate.split(/---\r?\n|---/g).map(s => s.trim()).filter(Boolean);
        const firstSec = sections[0] || '';
        const cleanUpdate = firstSec.replace(/\[attachment:([^|\]]+)\|name:([^\]]+)\]/g, '').trim();
        const latestUpdateEscaped = `"${cleanUpdate.replace(/"/g, '""')}"`;

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
          latestUpdateEscaped
        ].join(',');
      })
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tasks_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTasks = statusFilter === 'all'
    ? tasks
    : tasks.filter(t => t.status === statusFilter);

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 pb-16 transition-colors">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-[#151D2A]/80 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1 text-[#007AFF] hover:opacity-80 transition-opacity font-medium text-sm sm:text-base">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            <span>กลับ</span>
          </Link>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-md">
            {creatorFilter ? `ภารกิจของ ${creatorFilter.match(/^([^\s(]+)/)?.[1] || creatorFilter}` : 'ภารกิจทั้งหมด'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm"
              title="Export CSV"
            >
              📥 CSV
            </button>
            <Link
              href="/tasks/new"
              className="px-3.5 py-1.5 bg-[#007AFF] hover:bg-[#0062cc] text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.3)] active:scale-95"
            >
              ➕ เพิ่มงาน
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* iOS-style Pill Status Filter */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-2 scrollbar-none">
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
                  : 'bg-white dark:bg-[#151D2A] text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#007AFF] border-t-transparent" />
            <p className="text-xs text-slate-400 mt-3 font-medium">กำลังโหลดภารกิจ...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-white dark:bg-[#151D2A] border border-slate-200/80 dark:border-slate-800 p-8 shadow-sm">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">ไม่พบภารกิจ</h3>
            <p className="text-xs text-slate-400">ยังไม่มีงานในสถานะที่เลือก</p>
          </div>
        ) : (
          <TaskList tasks={filteredTasks} loading={false} currentUserName={currentUser?.name} users={users} />
        )}
      </main>
    </div>
  );
}
