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

export default function TaskList({ tasks, loading, title, currentUserName, users }: TaskListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#151E2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 animate-pulse shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl bg-white dark:bg-[#151E2E] border border-slate-200/80 dark:border-slate-800 p-8 shadow-sm">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
          ไม่พบภารกิจ
        </h3>
        <p className="text-xs text-slate-400">
          ยังไม่มีรายการงานที่จะแสดงผลในขณะนี้
        </p>
      </div>
    );
  }

  return (
    <div>
      {title && (
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">
          {title}
        </h2>
      )}
      <div className="space-y-3.5">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} currentUserName={currentUserName} users={users} />
        ))}
      </div>
    </div>
  );
}
