'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Task, TeamMember } from '@/types';
import TaskCard from './TaskCard';
import UserDisplay from './UserDisplay';

interface TeamDashboardProps {
  members: TeamMember[];
  loading: boolean;
  isMyTasks?: boolean;
}

function getInitials(name: string): string {
  if (!name) return '?';
  // Try to match Nickname from "Nickname (FirstName)/Department"
  const nickMatch = name.match(/^([^\s(]+)/);
  if (nickMatch && nickMatch[1]) return nickMatch[1];
  
  // Try to match FirstName inside parentheses: " (FirstName)"
  const firstMatch = name.match(/\(([^)]+)\)/);
  if (firstMatch && firstMatch[1]) return firstMatch[1];
  
  // Fallback to name split by slash
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
    // Blue/Sky color for My Tasks page
    return {
      bg: 'bg-sky-50 dark:bg-sky-950/45',
      text: 'text-sky-800 dark:text-sky-300',
      border: 'border-sky-200 dark:border-sky-900/40',
    };
  }

  // Hash function to make color assignment deterministic per member name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Beautiful random color presets excluding sky blue (so it remains distinct)
  const colors = [
    { bg: 'bg-emerald-50 dark:bg-emerald-950/45', text: 'text-emerald-800 dark:text-emerald-300', border: 'border-emerald-200/80 dark:border-emerald-900/40' },
    { bg: 'bg-indigo-50 dark:bg-indigo-950/45', text: 'text-indigo-800 dark:text-indigo-300', border: 'border-indigo-200/80 dark:border-indigo-900/40' },
    { bg: 'bg-amber-50 dark:bg-amber-950/45', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-200/85 dark:border-amber-900/40' },
    { bg: 'bg-rose-50 dark:bg-rose-950/45', text: 'text-rose-800 dark:text-rose-300', border: 'border-rose-200/80 dark:border-rose-900/40' },
    { bg: 'bg-violet-50 dark:bg-violet-950/45', text: 'text-violet-800 dark:text-violet-300', border: 'border-violet-200/80 dark:border-violet-900/40' },
    { bg: 'bg-cyan-50 dark:bg-cyan-950/45', text: 'text-cyan-800 dark:text-cyan-300', border: 'border-cyan-200/80 dark:border-cyan-900/40' },
    { bg: 'bg-orange-55/70 dark:bg-orange-950/45', text: 'text-orange-850 dark:text-orange-350', border: 'border-orange-200/80 dark:border-orange-900/40' },
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 p-6 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-slate-700" />
              <div>
                <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
                <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-3 w-full bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
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
        return (
          <div
            key={member.name}
            onClick={() => router.push(`/tasks?creator=${encodeURIComponent(member.name)}`)}
            className={`rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-200 flex flex-col ${
              isMyTasks
                ? 'bg-white dark:bg-slate-850 border-purple-400 dark:border-purple-600 hover:shadow-xl hover:border-purple-500 dark:hover:border-purple-400'
                : 'bg-white dark:bg-slate-850 border-slate-300 dark:border-slate-700 hover:shadow-xl hover:border-blue-500 dark:hover:border-blue-400'
            }`}
          >
             {/* Member Header */}
            <div className="border-b-2 flex items-stretch bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60 min-w-0">
              {/* Avatar Column (Left Column) */}
              <div className="p-3 flex items-center justify-center flex-shrink-0 border-r-2 border-slate-200 dark:border-slate-700/60 bg-slate-100/30 dark:bg-slate-900/10">
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0">
                    {getInitials(member.name)}
                  </div>
                )}
              </div>

              {/* Info Column (Right Column) */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                {/* Row 1: Name Band (Stripe) */}
                <div className={`px-3 py-1.5 border-b-2 flex items-center justify-center min-w-0 ${memberColor.bg} ${memberColor.text} ${memberColor.border}`}>
                  <h3 className="font-bold truncate leading-tight w-full text-center">
                    <UserDisplay name={member.name} noDeptBadge={true} />
                  </h3>
                </div>

                {/* Rows 2 & 3: Other info */}
                <div className="p-2 px-3 flex flex-col gap-0.5 justify-center flex-1">
                  {/* Row 2: Tasks Count & Overdue Badge */}
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0 leading-none">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">
                      {member.completedTasks}/{member.totalTasks} tasks
                    </span>
                    {member.tasks.some(t => t.status !== 'done' && !t.is_archived && t.deadline && new Date(t.deadline).getTime() < Date.now()) && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-md animate-pulse whitespace-nowrap">
                        ⚠️ เกินกำหนด
                      </span>
                    )}
                    {unreadMembers[member.name] && (
                      <span className="relative flex h-2 w-2 ml-0.5 flex-shrink-0" title="มีการอัปเดตงานเมื่อเร็วๆ นี้">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}
                  </div>

                  {/* Row 3: Last Update Date */}
                  {member.last_update && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-none mt-0.5">
                      อัปเดตล่าสุด: {formatThaiDate(member.last_update)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Task Stats (Body) */}
            <div className="p-3 bg-white dark:bg-slate-800 flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-4 gap-1.5">
              <div className="text-center p-1.5 bg-gray-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {member.tasks.filter((t) => t.status === 'todo').length}
                </p>
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">To Do</p>
              </div>
              <div className="text-center p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-base font-bold text-blue-700 dark:text-blue-300">
                  {member.tasks.filter((t) => t.status === 'in_progress').length}
                </p>
                <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Doing</p>
              </div>
              <div className="text-center p-1.5 bg-yellow-50 dark:bg-yellow-950/40 rounded-lg border border-yellow-250 dark:border-yellow-800">
                <p className="text-base font-bold text-yellow-700 dark:text-yellow-300">
                  {member.tasks.filter((t) => t.status === 'review').length}
                </p>
                <p className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400">Review</p>
              </div>
              <div className="text-center p-1.5 bg-green-50 dark:bg-green-950/40 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-base font-bold text-green-700 dark:text-green-300">
                  {member.tasks.filter((t) => t.status === 'done').length}
                </p>
                <p className="text-[10px] font-bold text-green-600 dark:text-green-400">Done</p>
              </div>
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
