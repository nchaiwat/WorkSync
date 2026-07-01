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
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; first_name: string; role: string; formattedName: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [canEdit, setCanEdit] = useState(false);

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
        // Redirect Admin to User Management Page
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
        });
      })
      .catch(() => {
        router.push('/login');
      });
  }, []);

  useEffect(() => {
    if (task && currentUser) {
      const ADMIN_ROLE_ID = 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0';
      const isAdmin = currentUser.role === ADMIN_ROLE_ID || currentUser.role === 'admin';
      const isCreator = currentUser.id === task.creator_id;
      setCanEdit(isAdmin || isCreator);
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
      try {
        const reads = JSON.parse(localStorage.getItem('worksync_read_tasks') || '{}');
        reads[task.id] = new Date().toISOString();
        localStorage.setItem('worksync_read_tasks', JSON.stringify(reads));
      } catch (e) {
        console.error(e);
      }
    }
  }, [task]);

  const handleUpdate = async (updated: Task) => {
    if (!canEdit) return;
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">กำลังโหลด...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">ไม่พบงาน</p>
          <button
            onClick={() => router.push('/tasks')}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600"
          >
            กลับไปรายการงาน
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← กลับ
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              รายละเอียดงาน
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">

        <TaskDetail task={task} onUpdate={handleUpdate} canEdit={canEdit} isCreator={currentUser?.id === task.creator_id} currentUserName={currentUser?.formattedName || 'Anonymous'} onDelete={handleDelete} onArchive={handleArchive} users={users} />
      </main>
    </div>
  );
}
