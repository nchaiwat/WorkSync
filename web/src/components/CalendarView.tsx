'use client';

import { useState, useMemo } from 'react';
import type { Task } from '@/types';
import Link from 'next/link';

interface CalendarViewProps {
  tasks: Task[];
}

export default function CalendarView({ tasks }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayTasks, setSelectedDayTasks] = useState<Task[] | null>(null);
  const [selectedDateLabel, setSelectedDateLabel] = useState<string>('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Adjust so Monday is 0, Sunday is 6
  const startDay = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();

  // Map tasks by date string "YYYY-MM-DD"
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      if (!task.deadline || task.is_archived) return;
      const d = new Date(task.deadline);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = map.get(key) || [];
      list.push(task);
      map.set(key, list);
    });
    return map;
  }, [tasks]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const renderCells = () => {
    const cells = [];

    // Prev month padding
    for (let i = startDay - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      cells.push(
        <div
          key={`prev-${dayNum}`}
          className="min-h-[90px] sm:min-h-[110px] p-2 bg-slate-50/30 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/50 opacity-40 rounded-xl"
        >
          <span className="text-xs font-semibold text-slate-400">{dayNum}</span>
        </div>
      );
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTasks = tasksByDate.get(dateKey) || [];
      const isToday = dateKey === todayKey;

      cells.push(
        <div
          key={`curr-${d}`}
          onClick={() => {
            if (dayTasks.length > 0) {
              setSelectedDayTasks(dayTasks);
              setSelectedDateLabel(`${d} ${monthNames[month]} ${year + 543}`);
            }
          }}
          className={`min-h-[90px] sm:min-h-[110px] p-2 rounded-2xl border transition-all duration-150 flex flex-col justify-between cursor-pointer ${
            isToday
              ? 'bg-blue-50/50 dark:bg-blue-950/20 border-[#007AFF] ring-1 ring-[#007AFF]'
              : 'bg-white dark:bg-[#151E2E] border-slate-200/80 dark:border-slate-800 hover:border-blue-400/60 dark:hover:border-blue-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                isToday
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'text-slate-800 dark:text-slate-200'
              }`}
            >
              {d}
            </span>
            {dayTasks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {dayTasks.length}
              </span>
            )}
          </div>

          <div className="space-y-1 mt-1 flex-1 overflow-hidden">
            {dayTasks.slice(0, 2).map((t) => {
              const statusColor =
                t.status === 'done'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60'
                  : t.status === 'in_progress'
                  ? 'bg-blue-50 text-[#007AFF] dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/60'
                  : t.status === 'review'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200';

              return (
                <div
                  key={t.id}
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium truncate border ${statusColor}`}
                  title={t.title}
                >
                  {t.title}
                </div>
              );
            })}
            {dayTasks.length > 2 && (
              <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold px-1">
                + อีก {dayTasks.length - 2} งาน
              </div>
            )}
          </div>
        </div>
      );
    }

    return cells;
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="bg-white dark:bg-[#151E2E] rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
            📅 {monthNames[month]} {year + 543}
          </h2>
          <button
            onClick={handleToday}
            className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            วันนี้
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevMonth}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm active:scale-95"
            aria-label="เดือนก่อนหน้า"
          >
            ◀
          </button>
          <button
            onClick={handleNextMonth}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm active:scale-95"
            aria-label="เดือนถัดไป"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-1">
        <span>จันทร์</span>
        <span>อังคาร</span>
        <span>พุธ</span>
        <span>พฤหัสบดี</span>
        <span>ศุกร์</span>
        <span>เสาร์</span>
        <span>อาทิตย์</span>
      </div>

      {/* Month Grid */}
      <div className="grid grid-cols-7 gap-2">{renderCells()}</div>

      {/* Day Tasks Modal */}
      {selectedDayTasks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#151E2E] rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <p className="text-xs text-slate-400 font-medium">ภารกิจที่ครบกำหนดส่ง</p>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  📅 {selectedDateLabel}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayTasks(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {selectedDayTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="block p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-blue-400/60 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#007AFF] transition-colors leading-snug">
                      {task.title}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      {task.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>👤 {task.assignee}</span>
                    <span>ความคืบหน้า {task.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
