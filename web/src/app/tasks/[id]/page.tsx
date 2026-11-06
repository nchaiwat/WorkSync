'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TaskDetail from '@/components/TaskDetail';
import { api } from '@/lib/api';
import { getAuthToken, getMe, formatUserDisplayName } from '@/lib/auth';
import type { Task, User } from '@/types';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; first_name: string; role: string; formattedName: string; nickname?: string; department?: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [isAssigneeOrCreator, setIsAssigneeOrCreator] = useState(false);

  useEffect(() => {
    loadTask();
    api.getUsers().then(setUsers).catch(console.error);
  }, [taskId]);

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
          return;
        }

        const fullName = formatUserDisplayName(user);

        setCurrentUser({
          id: user.id,
          username: user.username || '',
          first_name: user.first_name || '',
          role: roleId || 'user',
          formattedName: fullName,
          nickname: user.nickname || '',
          department: user.department || '',
        });
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const isUserMatch = (taskField: string | null | undefined) => {
    if (!taskField || !currentUser) return false;
    if (taskField === currentUser.formattedName) return true;
    if (currentUser.first_name && taskField.includes(`(${currentUser.first_name})`)) return true;
    if (currentUser.username && taskField.includes(`(${currentUser.username})`)) return true;
    if (taskField === currentUser.first_name || taskField === currentUser.username) return true;
    return false;
  };

  useEffect(() => {
    if (task && currentUser) {
      const ADMIN_ROLE_ID = 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0';
      const isAdmin = currentUser.role === ADMIN_ROLE_ID || currentUser.role === 'admin';
      const isCreator = currentUser.id === task.creator_id;
      const isAssignee = isUserMatch(task.assignee);
      const isManager = isUserMatch(task.manager);

      setCanEdit(isAdmin || isCreator || isAssignee || isManager);
      setIsAssigneeOrCreator(isAdmin || isCreator || isAssignee);
    }
  }, [task, currentUser]);

  const loadTask = async () => {
    try {
      const data = await api.getTaskById(taskId);
      setTask(data);
    } catch {
      setTask(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (task) {
      api.markTaskAsRead(task.id).catch(console.error);
    }
  }, [task]);

  const handleUpdate = async (updated: Task) => {
    setTask(updated);
  };

  const handleDelete = async (taskId: string, reason: string) => {
    try {
      await api.deleteTask(taskId, reason);
      router.push('/tasks');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ลบงานไม่สำเร็จ';
      alert(msg);
    }
  };

  const handleArchive = async (taskId: string, reason: string) => {
    try {
      await api.archiveTask(taskId, reason);
      alert('เก็บถาวรงานเรียบร้อยแล้ว');
      router.push('/tasks');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เก็บถาวรงานไม่สำเร็จ';
      alert(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] dark:bg-[#0B0F19]">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#007AFF] border-t-transparent" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] dark:bg-[#0B0F19]">
        <div className="text-center p-8 rounded-2xl bg-white dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-slate-500 dark:text-slate-400 mb-4 font-semibold">ไม่พบข้อมูลภารกิจนี้ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 bg-[#007AFF] text-white rounded-xl text-sm font-semibold hover:bg-[#0062cc] transition-all shadow-sm"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 pb-16 transition-colors">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-[#151D2A]/80 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-[#007AFF] hover:opacity-80 transition-opacity font-medium text-sm sm:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            <span>กลับ</span>
          </button>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-md">
            รายละเอียดภารกิจ
          </h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <TaskDetail
          task={task}
          onUpdate={handleUpdate}
          canEdit={canEdit}
          isCreator={isAssigneeOrCreator}
          currentUserName={currentUser?.formattedName || 'Anonymous'}
          currentUser={currentUser}
          onDelete={handleDelete}
          onArchive={handleArchive}
          users={users}
        />
      </main>
    </div>
  );
}
