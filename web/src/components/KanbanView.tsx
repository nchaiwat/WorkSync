'use client';

import { useState } from 'react';
import type { Task, User } from '@/types';
import Link from 'next/link';
import UserDisplay from './UserDisplay';
import { formatUserDisplayName } from '@/lib/auth';

interface KanbanViewProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: 'todo' | 'in_progress' | 'review' | 'done') => Promise<void>;
  currentUserName?: string;
  users?: User[];
}

const COLUMNS: Array<{
  id: 'todo' | 'in_progress' | 'review' | 'done';
  title: string;
  dotColor: string;
  bgLight: string;
  borderLight: string;
  textLight: string;
}> = [
  {
    id: 'todo',
    title: 'To Do',
    dotColor: 'bg-slate-400 dark:bg-slate-500',
    bgLight: 'bg-slate-100/70 dark:bg-slate-800/40',
    borderLight: 'border-slate-200/80 dark:border-slate-800',
    textLight: 'text-slate-700 dark:text-slate-300',
  },
  {
    id: 'in_progress',
    title: 'Doing',
    dotColor: 'bg-[#007AFF]',
    bgLight: 'bg-blue-50/60 dark:bg-blue-950/20',
    borderLight: 'border-blue-200/60 dark:border-blue-900/40',
    textLight: 'text-[#007AFF] dark:text-blue-400',
  },
  {
    id: 'review',
    title: 'Review',
    dotColor: 'bg-amber-500',
    bgLight: 'bg-amber-50/60 dark:bg-amber-950/20',
    borderLight: 'border-amber-200/60 dark:border-amber-900/40',
    textLight: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'done',
    title: 'Done',
    dotColor: 'bg-emerald-500',
    bgLight: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    borderLight: 'border-emerald-200/60 dark:border-emerald-900/40',
    textLight: 'text-emerald-600 dark:text-emerald-400',
  },
];

export default function KanbanView({ tasks, onStatusChange, currentUserName, users }: KanbanViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);

  const getAvatarUrl = (targetName?: string) => {
    if (!users || !targetName) return undefined;
    const user = users.find((u) => {
      if (u.id === targetName || u.username === targetName || u.first_name === targetName) return true;
      if (formatUserDisplayName(u) === targetName) return true;
      if (u.first_name && targetName.includes(`(${u.first_name})`)) return true;
      if (u.username && targetName.includes(`(${u.username})`)) return true;
      return false;
    });
    return user?.avatar_url || undefined;
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCol: 'todo' | 'in_progress' | 'review' | 'done') => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetCol) return;

    try {
      setMovingTaskId(taskId);
      await onStatusChange(taskId, targetCol);
    } finally {
      setMovingTaskId(null);
    }
  };

  const handleQuickMove = async (taskId: string, targetCol: 'todo' | 'in_progress' | 'review' | 'done') => {
    try {
      setMovingTaskId(taskId);
      await onStatusChange(taskId, targetCol);
    } finally {
      setMovingTaskId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => !t.is_archived && t.status === col.id);
        const isTarget = dragOverCol === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`rounded-3xl border ${col.borderLight} bg-slate-50/50 dark:bg-[#151E2E]/60 p-3.5 sm:p-4 min-h-[500px] flex flex-col transition-all duration-200 ${
              isTarget ? 'ring-2 ring-blue-500/60 bg-blue-50/40 dark:bg-blue-950/30' : ''
            }`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                  {col.title}
                </h3>
              </div>
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-sm">
                {colTasks.length}
              </span>
            </div>

            {/* Tasks Container */}
            <div className="space-y-3 flex-1">
              {colTasks.map((task) => {
                const isMoving = movingTaskId === task.id;
                const completedSubtasks = (task.subtasks || []).filter((s) => s.completed).length;
                const totalSubtasks = (task.subtasks || []).length;
                const hasSubtasks = totalSubtasks > 0;

                const isOverdue =
                  task.status !== 'done' &&
                  task.deadline &&
                  new Date(task.deadline).getTime() < Date.now();

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    className={`group relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#151E2E] p-4 cursor-grab active:cursor-grabbing shadow-[0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:shadow-md hover:border-blue-400/60 transition-all duration-150 ${
                      isMoving ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    {/* Top: Project & Recurrence Badge */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {task.project_owner && (
                          <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/50">
                            📂 {task.project_owner}
                          </span>
                        )}
                        {task.recurrence && task.recurrence !== 'none' && (
                          <span className="text-[9px] font-bold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded-md border border-purple-200/60 dark:border-purple-800/40">
                            🔁 {task.recurrence}
                          </span>
                        )}
                      </div>

                      {/* Quick Move Dropdown (Accessible for Mobile & Desktop) */}
                      <div className="relative">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleQuickMove(task.id, e.target.value as any)
                          }
                          aria-label="ย้ายสถานะ"
                          className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-1.5 py-1 border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">Doing</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    </div>

                    {/* Title */}
                    <Link href={`/tasks/${task.id}`}>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-[#007AFF] transition-colors leading-snug">
                        {task.title}
                      </h4>
                    </Link>

                    {/* Subtasks Progress */}
                    {hasSubtasks && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <span>☑️</span>
                        <span>
                          งานย่อย {completedSubtasks}/{totalSubtasks}
                        </span>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        <span>ความคืบหน้า</span>
                        <span className="font-mono">{task.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-[#007AFF] to-[#34C759] transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer: Assignee & Deadline */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {getAvatarUrl(task.assignee) ? (
                          <img
                            src={getAvatarUrl(task.assignee)}
                            alt={task.assignee}
                            className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                            {task.assignee.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[90px]">
                          <UserDisplay name={task.assignee} size="sm" noDeptBadge={true} />
                        </span>
                      </div>

                      {task.deadline && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                            isOverdue
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          📅 {new Date(task.deadline).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div className="h-32 border-2 border-dashed border-slate-200/70 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-medium">
                  <span>ว่างเปล่า</span>
                  <span className="text-[10px] mt-0.5">ลากงานมาวางที่นี่</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
