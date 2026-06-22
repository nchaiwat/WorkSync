'use client';

import type { Task, User } from '@/types';
import TaskCard from './TaskCard';

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  title?: string;
  currentUserName?: string;
  users?: User[];
}

export default function TaskList({ tasks, loading, title = 'All Tasks', currentUserName, users }: TaskListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 p-5 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
                <div className="h-3 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
          No tasks found
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          There are no tasks to display right now.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{title}</h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} currentUserName={currentUserName} users={users} />
        ))}
      </div>
    </div>
  );
}
