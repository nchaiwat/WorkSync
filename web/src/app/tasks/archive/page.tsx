'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Task } from '@/types';
import Link from 'next/link';
import { getAuthToken, getMe, formatUserDisplayName } from '@/lib/auth';

export default function ArchivePage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }
    getMe(token)
      .then((user) => {
        setCurrentUser({
          id: user.id,
          name: formatUserDisplayName(user),
        });
      })
      .catch(() => {
        router.push('/login');
      });
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadArchivedTasks();
    }
  }, [currentUser]);

  const loadArchivedTasks = async () => {
    try {
      setIsLoading(true);
      // Fetch only archived tasks
      const result = await api.getTasks({ is_archived: true });
      
      // Filter: only show tasks created by the current user (owner only)
      const ownedArchived = result.data.filter(t => t.creator_id === currentUser?.id);
      setTasks(ownedArchived);
    } catch (err) {
      console.error(err);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-gray-650 dark:text-gray-300 hover:text-gray-905 dark:hover:text-gray-100 font-semibold text-sm">
              ← กลับหน้าหลัก
            </Link>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              📦 คลังเอกสารเก็บถาวร (Archive)
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            💡 <b>คำแนะนำ:</b> หน้านี้จะรวบรวมภารกิจที่เสร็จสมบูรณ์แล้วที่คุณเป็นเจ้าของและทำรายการเก็บถาวร (Archive) ไว้ 
            โดยงานเหล่านี้จะไม่แสดงให้ผู้อื่นที่เกี่ยวข้องเห็นอีก และถูกเก็บรักษาไว้เป็นประวัติส่วนตัวของคุณ
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">กำลังโหลดเอกสารเก็บถาวร...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 shadow-sm">
            <span className="text-5xl block mb-4 select-none">📦</span>
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-300 mb-1">ไม่มีงานในคลังเอกสารเก็บถาวร</h3>
            <p className="text-xs text-gray-450 dark:text-gray-400">งานที่ถูกจัดเก็บในคลังส่วนตัวของคุณจะปรากฏที่นี่</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="block group">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-205 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg p-5 transition-all duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {task.title}
                    </h3>
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 self-start sm:self-auto border border-slate-200 dark:border-slate-650">
                      เสร็จสิ้น (Archive)
                    </span>
                  </div>

                  {task.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-450 line-clamp-2 mb-4 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {task.archive_reason && (
                    <div className="p-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/40 rounded-xl mb-4">
                      <p className="text-xs text-amber-850 dark:text-amber-350">
                        💬 <b>เหตุผลการเก็บถาวร:</b> {task.archive_reason}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 dark:text-gray-500 pt-3 border-t border-slate-100 dark:border-slate-700/60 font-medium">
                    <div>
                      👤 ผู้รับผิดชอบ: <span className="font-bold text-gray-600 dark:text-gray-300">{task.assignee}</span>
                    </div>
                    <div>
                      🕒 จัดเก็บเมื่อ: {new Date(task.updated_at).toLocaleDateString('th-TH', {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })} น.
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
