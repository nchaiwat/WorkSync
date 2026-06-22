'use client';

import { useState, useEffect } from 'react';
import type { Task, User } from '@/types';
import { STATUS_CONFIG, PROGRESS_COLORS } from '@/types';
import Link from 'next/link';
import UserDisplay from './UserDisplay';
import { formatUserDisplayName } from '@/lib/auth';

interface TaskCardProps {
  task: Task;
  compact?: boolean;
  currentUserName?: string;
  users?: User[];
}

function getLatestUpdateSnippet(latestUpdateText: string | null | undefined): string {
  if (!latestUpdateText) return '';
  const sections = latestUpdateText.split(/---\r?\n|---/g);
  return sections[0]?.trim() || '';
}

export default function TaskCard({ task, compact = false, currentUserName, users }: TaskCardProps) {
  const [isUnread, setIsUnread] = useState(false);

  useEffect(() => {
    try {
      const reads = JSON.parse(localStorage.getItem('worksync_read_tasks') || '{}');
      const lastRead = reads[task.id];
      if (!lastRead) {
        setIsUnread(true);
      } else {
        const time = new Date(task.updated_at || task.created_at).getTime();
        setIsUnread(time > new Date(lastRead).getTime());
      }
    } catch {
      setIsUnread(true);
    }
  }, [task.id, task.updated_at, task.created_at]);

  const getTelegramId = () => {
    if (!users) return undefined;
    const nameOrId = task.created_by_name || task.assignee;
    const user = users.find(u => {
      if (u.id === nameOrId || u.username === nameOrId || u.first_name === nameOrId) return true;
      if (formatUserDisplayName(u) === nameOrId) return true;
      if (u.first_name && nameOrId.includes(`(${u.first_name})`)) return true;
      if (u.username && nameOrId.includes(`(${u.username})`)) return true;
      return false;
    });
    return user?.telegram_id || undefined;
  };

  const statusConfig = STATUS_CONFIG[task.status];
  const progressColor =
    task.progress === 100
      ? PROGRESS_COLORS.complete
      : task.progress >= 70
        ? PROGRESS_COLORS.high
        : task.progress >= 30
          ? PROGRESS_COLORS.medium
          : PROGRESS_COLORS.low;

  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const isDone = task.status === 'done';
  const deadlineDiff = (() => {
    if (!deadlineDate) return null;
    const now = new Date();
    const d1 = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
    
    if (isDone) {
      return { text: 'เสร็จสิ้น', colorClass: 'text-emerald-600 dark:text-emerald-400 font-semibold' };
    }
    
    if (diffDays > 0) {
      return { text: `อีก ${diffDays} วัน`, colorClass: 'text-gray-500 dark:text-gray-400' };
    } else if (diffDays === 0) {
      return { text: 'วันนี้', colorClass: 'text-amber-600 dark:text-amber-400 font-bold' };
    } else {
      return { text: `เกินกำหนด ${Math.abs(diffDays)} วัน`, colorClass: 'text-red-500 dark:text-red-400 font-bold' };
    }
  })();

  const statusBorders = {
    todo: 'border-l-slate-400 dark:border-l-slate-500',
    in_progress: 'border-l-blue-500 dark:border-l-blue-400',
    review: 'border-l-amber-500 dark:border-l-amber-400',
    done: 'border-l-emerald-500 dark:border-l-emerald-400',
  };
  const statusBorder = statusBorders[task.status] || 'border-l-slate-400';

  const isManager = currentUserName && (
    task.manager === currentUserName ||
    (task.manager && task.manager.includes(`(${currentUserName})`))
  );

  if (compact) {
    return (
      <Link href={`/tasks/${task.id}`} className="block">
        <div className={`task-card ${
          isManager 
            ? 'bg-indigo-50/15 dark:bg-slate-800/40 border-indigo-300/80 dark:border-indigo-900/60' 
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
        } rounded-lg border-2 border-l-4 ${statusBorder} p-3 cursor-pointer shadow-sm`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-1.5">
                {isUnread && (
                  <span className="relative flex h-2 w-2 flex-shrink-0" title="มีอัปเดตใหม่">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
                {task.title}
              </h4>
              {task.project_owner && (
                <div className="text-[10px] text-indigo-650 dark:text-indigo-400 font-semibold mt-0.5">
                  📂 {task.project_owner}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {isManager && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-750 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 shadow-sm whitespace-nowrap">
                  👑 Manager
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bgColor} ${statusConfig.color} whitespace-nowrap`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
              <div
                className={`progress-bar-fill h-1.5 rounded-full ${progressColor}`}
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">{task.progress}%</span>
                {task.previous_progress !== undefined && task.progress !== task.previous_progress && (
                  <span className={`text-[9px] font-bold ${
                    task.progress > task.previous_progress ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    ({task.progress > task.previous_progress ? '+' : ''}{task.progress - task.previous_progress}%)
                  </span>
                )}
              </div>
              {deadlineDiff && (
                <span className={`text-xs ${deadlineDiff.colorClass}`}>
                  {deadlineDiff.text}
                </span>
              )}
            </div>
            {task.latest_update && (
              <div className="mt-2 p-2 bg-blue-50/60 dark:bg-blue-900/30 rounded border border-blue-150 dark:border-blue-800">
                <p className="text-xs text-blue-800 dark:text-blue-300 line-clamp-2">
                  <span className="font-semibold">Update: </span>
                  {getLatestUpdateSnippet(task.latest_update)}
                </p>
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/tasks/${task.id}`} className="block">
      <div className={`task-card ${
        isManager 
          ? 'bg-indigo-50/15 dark:bg-slate-800/40 border-indigo-300/80 dark:border-indigo-900/60' 
          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700'
      } rounded-xl border-2 border-l-4 ${statusBorder} p-5 cursor-pointer h-full flex flex-col hover:shadow-md transition-shadow shadow-sm`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight flex items-center gap-1.5">
              {isUnread && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0" title="มีอัปเดตใหม่">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
              )}
              {task.title}
            </h3>
            {task.project_owner && (
              <div className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 mt-1.5 inline-flex items-center gap-1">
                <span className="text-indigo-400 dark:text-indigo-500 font-semibold">Owner:</span>
                <span>📂 {task.project_owner}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              {isManager && (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-750 dark:text-indigo-300 font-extrabold border border-indigo-200 dark:border-indigo-800 shadow-sm whitespace-nowrap">
                  👑 Manager
                </span>
              )}
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide leading-none mb-0.5">Status</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${statusConfig.bgColor} ${statusConfig.color} whitespace-nowrap`}>
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {task.description && (
          <p className="mt-2 text-sm text-gray-505 dark:text-gray-400 line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Progress</span>
            <div className="flex items-center gap-1.5">
              {task.previous_progress !== undefined && task.progress !== task.previous_progress && (
                <span className={`text-[10px] font-bold px-1 py-0.2 rounded ${
                  task.progress > task.previous_progress
                    ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/20'
                    : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/20'
                }`}>
                  {task.progress > task.previous_progress ? '+' : ''}{task.progress - task.previous_progress}%
                </span>
              )}
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{task.progress}%</span>
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className={`progress-bar-fill h-2 rounded-full ${progressColor}`}
              style={{ width: `${task.progress}%` }}
            />
          </div>
          {task.latest_update && (
            <div className="mt-3 p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-850">
              <p className="text-xs text-blue-800 dark:text-blue-300 line-clamp-2">
                <span className="font-semibold">Update: </span>
                {getLatestUpdateSnippet(task.latest_update)}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-slate-700/50">
          {/* Row 1: Assignee + Created date */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {task.avatar_url ? (
                <img
                  src={task.avatar_url}
                  alt={task.created_by_name || task.assignee}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {(task.created_by_name || task.assignee).charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                <UserDisplay name={task.created_by_name || task.assignee} size="sm" telegramId={getTelegramId()} />
              </span>
            </div>
            {task.created_at && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                เพิ่มเมื่อ {(() => {
                  const d = new Date(task.created_at);
                  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                })()}
              </span>
            )}
          </div>
          {/* Row 2: Deadline */}
          {deadlineDate && (
            <div className={`flex items-center justify-end gap-2 text-xs px-2.5 py-1.5 rounded-lg border ${
              isDone
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400'
                : deadlineDiff && deadlineDiff.text.startsWith('เกิน')
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400'
                  : deadlineDiff && deadlineDiff.text === 'วันนี้'
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400'
                    : 'bg-gray-50 dark:bg-slate-700/40 border-gray-200 dark:border-slate-600/40 text-gray-500 dark:text-gray-400'
            }`}>
              <span>📅</span>
              <span className="font-medium">
                {(() => {
                  const d = deadlineDate;
                  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                })()}
              </span>
              {deadlineDiff && (
                <span className="font-bold">· {deadlineDiff.text}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
