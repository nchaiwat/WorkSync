'use client';

import type { Task, User } from '@/types';
import { STATUS_CONFIG, PROGRESS_COLORS } from '@/types';
import Link from 'next/link';
import UserDisplay from './UserDisplay';
import { formatUserDisplayName } from '@/lib/auth';
import { isSamePerson } from '@/lib/userMatch';

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
  const isUnread = task.is_unread ?? false;

  const getTelegramId = (targetName?: string) => {
    if (!users) return undefined;
    const nameOrId = targetName || task.assignee || task.created_by_name;
    const user = users.find(u => {
      if (u.id === nameOrId || u.username === nameOrId || u.first_name === nameOrId) return true;
      if (formatUserDisplayName(u) === nameOrId) return true;
      if (u.first_name && nameOrId.includes(`(${u.first_name})`)) return true;
      if (u.username && nameOrId.includes(`(${u.username})`)) return true;
      return false;
    });
    return user?.telegram_id || undefined;
  };

  const getAvatarUrl = (targetName?: string) => {
    if (!users) return task.avatar_url || undefined;
    const nameOrId = targetName || task.assignee || task.created_by_name;
    const user = users.find(u => {
      if (u.id === nameOrId || u.username === nameOrId || u.first_name === nameOrId) return true;
      if (formatUserDisplayName(u) === nameOrId) return true;
      if (u.first_name && nameOrId.includes(`(${u.first_name})`)) return true;
      if (u.username && nameOrId.includes(`(${u.username})`)) return true;
      return false;
    });
    return user?.avatar_url || task.avatar_url || undefined;
  };

  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
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
      return { text: `อีก ${diffDays} วัน`, colorClass: 'text-slate-500 dark:text-slate-400' };
    } else if (diffDays === 0) {
      return { text: 'วันนี้', colorClass: 'text-amber-600 dark:text-amber-400 font-bold' };
    } else {
      return { text: `เกินกำหนด ${Math.abs(diffDays)} วัน`, colorClass: 'text-rose-500 dark:text-rose-400 font-bold' };
    }
  })();

  const isManager = Boolean(currentUserName && isSamePerson(task.manager, currentUserName));

  // Check if this task was delegated to someone else
  const isDelegatedToOther = Boolean(
    task.created_by_name &&
    task.assignee &&
    !isSamePerson(task.created_by_name, task.assignee)
  );

  const isMyAssignedTask = Boolean(
    isDelegatedToOther &&
    currentUserName &&
    isSamePerson(task.created_by_name, currentUserName)
  );

  const isAssignedToMe = Boolean(
    isDelegatedToOther &&
    currentUserName &&
    isSamePerson(task.assignee, currentUserName)
  );

  if (compact) {
    return (
      <Link href={`/tasks/${task.id}`} className="block group">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#151E2E] p-3.5 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:border-blue-400/50 dark:hover:border-blue-500/40 transition-all duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5 group-hover:text-[#007AFF] transition-colors">
                {isUnread && (
                  <span className="relative flex h-2 w-2 flex-shrink-0" title="มีอัปเดตใหม่">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
                {task.title}
              </h4>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {task.project_owner && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    📂 {task.project_owner}
                  </span>
                )}
                {isMyAssignedTask && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#007AFF] font-bold border border-blue-200/60 dark:border-blue-800/40">
                    🎯 มอบหมายให้: {task.assignee}
                  </span>
                )}
                {isAssignedToMe && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200/60 dark:border-emerald-800/40">
                    👔 ได้รับมอบหมาย
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isManager && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-200/60 dark:border-indigo-800">
                  👑 Manager
                </span>
              )}
              <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold ${statusConfig.bgColor} ${statusConfig.color} border border-current/20`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
          <div className="mt-2.5">
            <div className="w-full bg-slate-100 dark:bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
              <div
                className={`progress-bar-fill h-1.5 rounded-full ${progressColor} transition-all duration-300`}
                style={{ width: `${task.progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1 text-[11px]">
              <span className="font-semibold text-slate-500 dark:text-slate-400 font-mono">{task.progress}%</span>
              {deadlineDiff && (
                <span className={deadlineDiff.colorClass}>
                  {deadlineDiff.text}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/tasks/${task.id}`} className="block h-full group">
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#151E2E] p-5 cursor-pointer h-full flex flex-col shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] hover:border-blue-400/50 dark:hover:border-blue-500/40 transition-all duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug flex items-center gap-1.5 group-hover:text-[#007AFF] transition-colors">
              {isUnread && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0" title="มีอัปเดตใหม่">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              )}
              {task.title}
            </h3>
            
            {/* Tags & Delegation indicators */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {task.project_owner && (
                <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/50 inline-flex items-center gap-1">
                  <span>📂</span> {task.project_owner}
                </span>
              )}
              {isMyAssignedTask && (
                <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200/70 dark:border-blue-800/50 inline-flex items-center gap-1">
                  <span>🎯</span> มอบหมายให้: {task.assignee}
                </span>
              )}
              {isAssignedToMe && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/70 dark:border-emerald-800/50 inline-flex items-center gap-1">
                  <span>👔</span> ได้รับมอบหมายจาก: {task.created_by_name || 'หัวหน้างาน'}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {isManager && (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-200/60 dark:border-indigo-800 shadow-sm whitespace-nowrap">
                👑 Manager
              </span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${statusConfig.bgColor} ${statusConfig.color} border border-current/20 whitespace-nowrap shadow-sm`}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {task.description && (
          <p className="mt-2.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">ความคืบหน้า</span>
            <div className="flex items-center gap-1.5">
              {task.previous_progress !== undefined && task.progress !== task.previous_progress && (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  task.progress > task.previous_progress
                    ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30'
                    : 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30'
                }`}>
                  {task.progress > task.previous_progress ? '+' : ''}{task.progress - task.previous_progress}%
                </span>
              )}
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">{task.progress}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700/60 rounded-full h-2 overflow-hidden">
            <div
              className={`progress-bar-fill h-2 rounded-full ${progressColor} transition-all duration-300`}
              style={{ width: `${task.progress}%` }}
            />
          </div>

          {task.latest_update && (
            <div className="mt-3 p-2.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <p className="text-xs text-blue-900 dark:text-blue-300 line-clamp-2 leading-relaxed">
                <span className="font-bold">อัปเดตล่าสุด: </span>
                {getLatestUpdateSnippet(task.latest_update)}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {getAvatarUrl(task.assignee) ? (
                <img
                  src={getAvatarUrl(task.assignee)}
                  alt={task.assignee}
                  className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-[10px] font-bold shadow-sm flex-shrink-0">
                  {task.assignee.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="truncate text-xs text-slate-700 dark:text-slate-300">
                <UserDisplay name={task.assignee} size="sm" telegramId={getTelegramId(task.assignee)} />
              </div>
            </div>
            {task.created_at && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                {(() => {
                  const d = new Date(task.created_at);
                  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                })()}
              </span>
            )}
          </div>

          {deadlineDate && (
            <div className={`flex items-center justify-end gap-1.5 text-xs px-2.5 py-1 rounded-xl border ${
              isDone
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400'
                : deadlineDiff && deadlineDiff.text.startsWith('เกิน')
                  ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400'
                  : deadlineDiff && deadlineDiff.text === 'วันนี้'
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400'
            }`}>
              <span>📅</span>
              <span className="font-semibold font-mono">
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
