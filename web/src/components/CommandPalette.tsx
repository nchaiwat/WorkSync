'use client';

import { useState, useEffect, useRef } from 'react';
import type { Task, User } from '@/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  users: User[];
  onSelectTask: (task: Task) => void;
  onCreateTask: () => void;
  onToggleTheme: () => void;
  onSwitchView: (view: 'overview' | 'my' | 'assigned' | 'involved') => void;
  onOpenProfile: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  tasks,
  users,
  onSelectTask,
  onCreateTask,
  onToggleTheme,
  onSwitchView,
  onOpenProfile,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or state
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  // 1. Actions
  const actions = [
    {
      id: 'action-create',
      type: 'action' as const,
      title: '➕ สร้างงานใหม่ (Create New Task)',
      subtitle: 'เพิ่มภารกิจใหม่ในระบบพร้อมมอบหมายงาน',
      action: () => {
        onClose();
        onCreateTask();
      },
    },
    {
      id: 'action-overview',
      type: 'action' as const,
      title: '🏢 ดูหน้าภาพรวม & Dashboard แผนก',
      subtitle: 'Executive Dashboard, สรุปภาระงาน, กำหนดส่ง',
      action: () => {
        onClose();
        onSwitchView('overview');
      },
    },
    {
      id: 'action-my-tasks',
      type: 'action' as const,
      title: '👤 ดูงานของฉัน (My Tasks)',
      subtitle: 'งานที่คุณเป็นผู้รับผิดชอบโดยตรง',
      action: () => {
        onClose();
        onSwitchView('my');
      },
    },
    {
      id: 'action-theme',
      type: 'action' as const,
      title: '🌗 สลับโหมดสี (Dark / Light Theme)',
      subtitle: 'เปลี่ยนธีมแสดงผลของระบบ',
      action: () => {
        onClose();
        onToggleTheme();
      },
    },
    {
      id: 'action-profile',
      type: 'action' as const,
      title: '✉️ ตั้งค่าโปรไฟล์ & อีเมลสรุปงาน (Email Digest)',
      subtitle: 'กำหนดเวลาส่งรายงานและหมวดหมู่งาน',
      action: () => {
        onClose();
        onOpenProfile();
      },
    },
  ].filter(
    (a) => !q || a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
  );

  // 2. Filtered Tasks
  const matchedTasks = tasks
    .filter((t) => {
      if (!q) return false;
      const title = (t.title || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const assignee = (t.assignee || '').toLowerCase();
      const status = (t.status || '').toLowerCase();
      return title.includes(q) || desc.includes(q) || assignee.includes(q) || status.includes(q);
    })
    .slice(0, 8)
    .map((t) => ({
      id: `task-${t.id}`,
      type: 'task' as const,
      title: t.title,
      subtitle: `${t.assignee} · ${t.status.toUpperCase()} (${t.progress}%)`,
      task: t,
      action: () => {
        onClose();
        onSelectTask(t);
      },
    }));

  const allItems = [...actions, ...matchedTasks];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
          <span className="text-slate-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="ค้นหาภารกิจ, คำสั่งลัด, สมาชิก, แผนก... (พิมพ์เพื่อค้นหา)"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          <kbd className="px-2 py-0.5 text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              ไม่พบผลลัพธ์ที่ตรงกับ &quot;{query}&quot;
            </div>
          ) : (
            allItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3.5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base shrink-0">
                      {item.type === 'action' ? '⚡' : '📌'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium shrink-0">
                      กด Enter ↵
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>↑↓ เพื่อเลือก</span>
            <span>↵ เพื่อเปิด</span>
            <span>ESC เพื่อปิด</span>
          </div>
          <div>WorkSync Quick Command</div>
        </div>
      </div>
    </div>
  );
}
