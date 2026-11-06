'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { TeamMember } from '@/types';
import UserDisplay from './UserDisplay';

interface TeamDashboardProps {
  members: TeamMember[];
  loading: boolean;
  filterMode?: 'dash' | 'my_tasks' | 'assigned_by_me' | 'involved_tasks';
  isMyTasks?: boolean;
}

function getInitials(name: string): string {
  if (!name) return '?';
  const nickMatch = name.match(/^([^\s(]+)/);
  if (nickMatch && nickMatch[1]) return nickMatch[1].slice(0, 2);

  const firstMatch = name.match(/\(([^)]+)\)/);
  if (firstMatch && firstMatch[1]) return firstMatch[1].slice(0, 2);

  return name.slice(0, 2);
}

const formatThaiDate = (dateStr?: string) => {
  if (!dateStr) return 'ยังไม่มีการอัปเดต';
  const date = new Date(dateStr);
  return (
    date.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok',
    }) + ' น.'
  );
};

export default function TeamDashboard({
  members,
  loading,
  filterMode = 'dash',
  isMyTasks = false,
}: TeamDashboardProps) {
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

  const handleMemberClick = (memberName: string) => {
    const targetMode = filterMode === 'dash' && isMyTasks ? 'my_tasks' : filterMode;
    router.push(`/tasks?member=${encodeURIComponent(memberName)}&view=${targetMode}`);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#151E2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 animate-pulse shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1">
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded mb-4" />
            <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-[#151E2E] border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] flex items-center justify-center text-2xl shadow-inner">
          {filterMode === 'assigned_by_me' ? '🎯' : filterMode === 'involved_tasks' ? '👥' : '📋'}
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1.5">
          {filterMode === 'assigned_by_me'
            ? 'ไม่มีงานที่คุณมอบหมายให้ทีมงาน'
            : filterMode === 'involved_tasks'
            ? 'ไม่มีงานที่เกี่ยวข้องหรือรายงานถึงคุณ'
            : 'ไม่พบข้อมูลงาน'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {filterMode === 'assigned_by_me'
            ? 'เมื่อคุณสร้างงานและเลือกมอบหมายให้ลูกน้องหรือทีมงาน งานและรายชื่อผู้รับผิดชอบจะปรากฏที่นี่'
            : filterMode === 'involved_tasks'
            ? 'งานที่สมาชิกทีมสร้างขึ้นและระบุให้คุณเป็นผู้จัดการ หรือผู้ร่วมงาน จะแสดงที่นี่'
            : 'ยังไม่มีภารกิจในหมวดหมู่นี้'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {members.map((member) => {
        const hasOverdue = member.tasks.some(
          (t) =>
            t.status !== 'done' &&
            !t.is_archived &&
            t.deadline &&
            new Date(t.deadline).getTime() < Date.now()
        );

        const todoCount = member.tasks.filter((t) => t.status === 'todo').length;
        const doingCount = member.tasks.filter((t) => t.status === 'in_progress').length;
        const reviewCount = member.tasks.filter((t) => t.status === 'review').length;
        const doneCount = member.tasks.filter((t) => t.status === 'done').length;

        // Parse clean name parts
        const match = member.name.match(/^([^\s(]+)\s*(?:\(([^)]+)\))?\s*(?:\/([^\s]+))?$/);
        const nickname = match ? match[1] : member.name;
        const firstName = match ? match[2] : null;
        const department = match ? match[3] : 'IT';

        return (
          <div
            key={member.name}
            onClick={() => handleMemberClick(member.name)}
            className="group relative rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#151E2E] p-4 sm:p-5 cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:shadow-[0_10px_28px_rgba(0,122,255,0.08)] dark:hover:shadow-[0_10px_28px_rgba(0,122,255,0.15)] hover:border-blue-400/60 dark:hover:border-blue-500/50 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 flex flex-col"
          >
            {/* Top Row: Avatar + Name + Dept + Action Arrow */}
            <div className="flex items-start justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex-shrink-0">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-100 dark:ring-slate-700 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-slate-100 dark:ring-slate-700">
                      {getInitials(member.name)}
                    </div>
                  )}
                  {unreadMembers[member.name] && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 ring-2 ring-white dark:ring-slate-900"></span>
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate group-hover:text-[#007AFF] transition-colors">
                      {nickname}
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                      {department}
                    </span>
                  </div>
                  {firstName && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {firstName}
                    </p>
                  )}
                </div>
              </div>

              {/* iOS Chevron Right */}
              <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-[#007AFF] group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 transition-colors flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Context Badge (if Assigned by Me) */}
            {filterMode === 'assigned_by_me' && (
              <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] text-[11px] font-semibold border border-blue-200/50 dark:border-blue-900/50">
                <span>🎯</span>
                <span>งานที่คุณมอบหมายให้ ({member.totalTasks} ภารกิจ)</span>
              </div>
            )}

            {/* Progress Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-slate-600 dark:text-slate-400">
                  {member.completedTasks}/{member.totalTasks} ภารกิจเสร็จสิ้น
                </span>
                <span className="font-mono text-slate-900 dark:text-white font-bold">
                  {member.overallProgress}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-[#007AFF] to-[#34C759] transition-all duration-300"
                  style={{ width: `${member.overallProgress}%` }}
                />
              </div>

              {hasOverdue && (
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/60 rounded-full animate-pulse">
                  <span>⚠️</span> มีงานเกินกำหนด
                </div>
              )}
            </div>

            {/* Unified Sleek Status Strip */}
            <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="grid grid-cols-4 gap-1.5 bg-slate-50/90 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                <div className="py-1">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    <span>{todoCount}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">To Do</span>
                </div>
                <div className="py-1">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#007AFF] dark:text-blue-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF]" />
                    <span>{doingCount}</span>
                  </div>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Doing</span>
                </div>
                <div className="py-1">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>{reviewCount}</span>
                  </div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Review</span>
                </div>
                <div className="py-1">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{doneCount}</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Done</span>
                </div>
              </div>

              {/* Last Update */}
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-0.5">
                <span className="truncate">อัปเดต: {formatThaiDate(member.last_update)}</span>
                <span className="text-[#007AFF] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  ดูงาน ›
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
