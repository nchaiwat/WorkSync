'use client';

import { useState, useMemo } from 'react';
import type { Task } from '@/types';

interface GanttViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export default function GanttView({ tasks, onSelectTask }: GanttViewProps) {
  const [daysWindow, setDaysWindow] = useState<14 | 30>(14);

  // Filter tasks with deadlines
  const validTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.is_archived)
      .map((t) => {
        const created = new Date(t.created_at);
        const deadline = t.deadline ? new Date(t.deadline) : new Date(created.getTime() + 7 * 86400000);
        return {
          ...t,
          startDate: created,
          endDate: deadline,
          isOverdue: t.status !== 'done' && deadline.getTime() < Date.now(),
        };
      })
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  }, [tasks]);

  // Compute timeline bounds
  const { startDate, endDate, totalDays, dateHeaders } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(today.getDate() - 2); // 2 days before today

    const count = daysWindow;
    const end = new Date(start);
    end.setDate(start.getDate() + count);

    const headers: { date: Date; isToday: boolean; label: string; subLabel: string }[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const isToday = d.toDateString() === today.toDateString();
      headers.push({
        date: d,
        isToday,
        label: d.toLocaleDateString('th-TH', { weekday: 'short' }),
        subLabel: `${d.getDate()}/${d.getMonth() + 1}`,
      });
    }

    return {
      startDate: start,
      endDate: end,
      totalDays: count,
      dateHeaders: headers,
    };
  }, [daysWindow]);

  const getStatusColor = (task: typeof validTasks[0]) => {
    if (task.status === 'done') return 'bg-emerald-500 hover:bg-emerald-600';
    if (task.isOverdue) return 'bg-rose-500 hover:bg-rose-600';
    if (task.status === 'review') return 'bg-amber-500 hover:bg-amber-600';
    if (task.status === 'in_progress') return 'bg-blue-500 hover:bg-blue-600';
    return 'bg-slate-400 hover:bg-slate-500';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* View Toolbar */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📊</span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Roadmap & Gantt Timeline
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กำหนดการส่งและช่วงเวลาดำเนินงานของภารกิจทั้งหมด ({validTasks.length} งาน)
            </p>
          </div>
        </div>

        {/* Window Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setDaysWindow(14)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              daysWindow === 14
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            14 วัน
          </button>
          <button
            type="button"
            onClick={() => setDaysWindow(30)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              daysWindow === 30
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            30 วัน (1 เดือน)
          </button>
        </div>
      </div>

      {/* Gantt Timeline Container */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Timeline Header */}
          <div className="grid grid-cols-[260px_1fr] border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ภารกิจ / ผู้รับผิดชอบ
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
            >
              {dateHeaders.map((h, i) => (
                <div
                  key={i}
                  className={`py-2 text-center border-l border-slate-100 dark:border-slate-800 text-[10px] ${
                    h.isToday
                      ? 'bg-blue-100/60 dark:bg-blue-950/40 font-bold text-blue-600 dark:text-blue-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <div>{h.label}</div>
                  <div>{h.subLabel}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Task Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {validTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                ยังไม่มีข้อมูลภารกิจในมุมมอง Roadmap
              </div>
            ) : (
              validTasks.map((t) => {
                // Calculate position percentage
                const tStart = Math.max(startDate.getTime(), t.startDate.getTime());
                const tEnd = Math.min(endDate.getTime(), t.endDate.getTime());
                const totalSpan = endDate.getTime() - startDate.getTime();

                let leftPct = ((tStart - startDate.getTime()) / totalSpan) * 100;
                let widthPct = ((tEnd - tStart) / totalSpan) * 100;

                // Clamping
                leftPct = Math.max(0, Math.min(100, leftPct));
                widthPct = Math.max(2.5, Math.min(100 - leftPct, widthPct));

                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTask(t)}
                    className="grid grid-cols-[260px_1fr] hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Left Column: Task Name & Assignee */}
                    <div className="p-3 pr-4 flex flex-col justify-center min-w-0">
                      <div className="flex items-center gap-2">
                        {t.isOverdue && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 font-bold">
                            เกิน
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                          {t.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {t.assignee} · {t.progress}%
                      </div>
                    </div>

                    {/* Right Column: Timeline Bar */}
                    <div className="relative flex items-center p-2 border-l border-slate-100 dark:border-slate-800">
                      {/* Grid background lines */}
                      <div
                        className="absolute inset-0 grid pointer-events-none"
                        style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
                      >
                        {dateHeaders.map((h, i) => (
                          <div
                            key={i}
                            className={`border-r border-slate-100/50 dark:border-slate-800/40 h-full ${
                              h.isToday ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''
                            }`}
                          />
                        ))}
                      </div>

                      {/* Horizontal Gantt Bar */}
                      <div
                        className={`relative h-6 rounded-lg shadow-xs text-white text-[10px] font-semibold flex items-center px-2 transition-all overflow-hidden ${getStatusColor(
                          t
                        )}`}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                        }}
                      >
                        {/* Progress Fill Underlay */}
                        <div
                          className="absolute inset-y-0 left-0 bg-black/15 pointer-events-none"
                          style={{ width: `${t.progress}%` }}
                        />
                        <span className="relative z-10 truncate">{t.progress}%</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
