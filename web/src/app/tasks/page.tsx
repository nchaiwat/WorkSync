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
  }, []);

  useEffect(() => {
    // Read creator from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const creator = urlParams.get('creator');
    if (creator) {
      setCreatorFilter(creator);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadTasks();
    }
  }, [creatorFilter, currentUser]);

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
      
      // SECURITY: Users should only ever see tasks they created OR are related to.
      let filtered = result.data.filter(
        (t) =>
          t.creator_id === currentUser?.id ||
          isUserMatch(t.assignee) ||
          isUserMatch(t.manager) ||
          (t.collaborators && t.collaborators.some((col) => isUserMatch(col)))
      );
      
      // Filter by creator if specified in URL
      if (creatorFilter) {
        filtered = filtered.filter(t => t.created_by_name === creatorFilter);
      }

      // Sort tasks:
      // 1. Manager first
      // 2. Assignee second
      // 3. Collaborator/Creator third
      // Secondary: updated_at (most recent first)
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

  const filteredTasks = statusFilter === 'all'
    ? tasks
    : tasks.filter(t => t.status === statusFilter);

  return (
    <div className="min-h-screen">
      <header className="bg-white dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-semibold text-sm">
              ← กลับ
            </Link>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
              {creatorFilter ? `📋 งานของ ${creatorFilter.match(/^([^\s(]+)/)?.[1] || creatorFilter}` : '📋 งานทั้งหมด'}
            </h1>
            <Link
              href="/tasks/new"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              ➕ เพิ่มงาน
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
          {['all', 'todo', 'in_progress', 'review', 'done'].map((status) => {
            const labels: Record<string, string> = {
              all: 'ทั้งหมด',
              todo: 'To Do',
              in_progress: 'Doing',
              review: 'Review',
              done: 'Done',
            };
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-colors border ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-650 dark:text-slate-350 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {labels[status]}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">กำลังโหลด...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-450 dark:text-gray-500">ไม่มีงาน</p>
          </div>
        ) : (
          <TaskList tasks={filteredTasks} loading={false} currentUserName={currentUser?.name} users={users} />
        )}
      </main>
    </div>
  );
}
