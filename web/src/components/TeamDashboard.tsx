'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { TeamMember } from '@/types';
import UserDisplay from './UserDisplay';

interface TeamDashboardProps {
  members: TeamMember[];
  loading: boolean;
  isMyTasks?: boolean;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const nickMatch = name.match(/^([^\s(]+)/);
  if (nickMatch && nickMatch[1]) return nickMatch[1];
  
  const firstMatch = name.match(/\(([^)]+)\)/);
  if (firstMatch && firstMatch[1]) return firstMatch[1];
  
  const slashParts = name.split('/');
  if (slashParts[0]) return slashParts[0].trim();
  
  return name.charAt(0);
}

const formatThaiDate = (dateStr?: string) => {
  if (!dateStr) return 'ไม่มีการอัปเดต';
  const date = new Date(dateStr);
  return date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }) + ' น.';
};

function getMemberColor(name: string, isMyTasks: boolean) {
  if (isMyTasks) {
    return {
      bg: 'bg-blue-50/70 dark:bg-blue-950/40',
      text: 'text-[#007AFF] dark:text-blue-300',
      border: 'border-blue-200/70 dark:border-blue-900/40',
    };
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    { bg: 'bg-emerald-50/70 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200/70 dark:border-emerald-900/40' },
    { bg: 'bg-indigo-50/70 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200/70 dark:border-indigo-900/40' },
    { bg: 'bg-amber-50/70 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200/70 dark:border-amber-900/40' },
    { bg: 'bg-rose-50/70 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200/70 dark:border-rose-900/40' },
    { bg: 'bg-purple-50/70 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200/70 dark:border-purple-900/40' },
    { bg: 'bg-cyan-50/70 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200/70 dark:border-cyan-900/40' },
    { bg: 'bg-orange-50/70 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200/70 dark:border-orange-900/40' },
  ];

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function TeamDashboard({ members, loading, isMyTasks = false }: TeamDashboardProps) {
  const router = useRouter();
  const [unreadMembers, setUnreadMembers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const unreadMap: Record<string, boolean> = {};
    
    for (const member of members) {
      unreadMap[member.name] = member.tasks.some((t) => {
        const time = new Date(t.updated_at || t.created_at).getTime();
        if (time <= oneDayAgo) return false;
        return t.is_unread ?? false;
      });
    }
    setUnreadMembers(unreadMap);
  }, [members]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#151D2A] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 animate-pulse shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div>
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {members.map((member) => {
        const memberColor = getMemberColor(member.name, isMyTasks);
        const hasOverdue = member.tasks.some(
          t => t.status !== 'done' && !t.is_archived && t.deadline && new Date(t.deadline).getTime() < Date.now()
        );

        return (
          <div
            key={member.name}
            onClick={() => router.push(`/tasks?creator=${encodeURIComponent(member.name)}`)}
            className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#151D2A] overflow-hidden cursor-pointer shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] hover:border-blue-400/50 dark:hover:border-blue-500/40 transition-all duration-200 flex flex-col group"
          >
            {/* Member Header */}
            <div className="flex items-stretch bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 min-w-0">
              {/* Avatar Column */}
              <div className="p-3.5 flex items-center justify-center flex-shrink-0 border-r border-slate-200/80 dark:border-slate-800">
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#007AFF] to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                    {getInitials(member.name)}
                  </div>
                )}
              </div>

              {/* Info Column */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div className={`px-3 py-1.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-center min-w-0 ${memberColor.bg} ${memberColor.text}`}>
                  <h3 className="font-bold text-xs sm:text-sm truncate leading-tight w-full text-center">
                    <UserDisplay name={member.name} noDeptBadge={true} />
                  </h3>
                </div>

                <div className="p-2.5 px-3 flex flex-col gap-1 justify-center flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0 leading-none">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                      {member.completedTasks}/{member.totalTasks} ภารกิจ
                    </span>
                    {hasOverdue && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 rounded-full animate-pulse whitespace-nowrap">
                        ⚠️ เกินกำหนด
                      </span>
                    )}
                    {unreadMembers[member.name] && (
                      <span className="relative flex h-2 w-2 ml-0.5 flex-shrink-0" title="มีการอัปเดตงานเมื่อเร็วๆ นี้">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    )}
                  </div>

                  {member.last_update && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-none">
                      อัปเดต: {formatThaiDate(member.last_update)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Task Stats (Body) */}
            <div className="p-3 bg-white dark:bg-[#151D2A] flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-4 gap-1.5">
                <div className="text-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {member.tasks.filter((t) => t.status === 'todo').length}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">To Do</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                  <p className="text-sm sm:text-base font-bold text-[#007AFF] dark:text-blue-400 font-mono">
                    {member.tasks.filter((t) => t.status === 'in_progress').length}
                  </p>
                  <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Doing</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40">
                  <p className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {member.tasks.filter((t) => t.status === 'review').length}
                  </p>
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Review</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {member.tasks.filter((t) => t.status === 'done').length}
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Done</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
