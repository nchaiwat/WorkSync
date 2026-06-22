'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TeamDashboard from '@/components/TeamDashboard';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getAuthToken, getAuthUsername, logout as authLogout, getMe, formatUserDisplayName, admin } from '@/lib/auth';
import type { Task, TeamMember, User } from '@/types';
import UserDisplay from '@/components/UserDisplay';

export default function Home() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Default tab is 'my_tasks', restored from sessionStorage on mount to avoid hydration issues
  const [filter, setFilter] = useState<'my_tasks' | 'involved_tasks'>('my_tasks');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('worksync_tab_filter');
      if (saved === 'involved_tasks') {
        setFilter('involved_tasks');
      }
    }
  }, []);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  
  // UI States
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  
  // PIN Setup States
  const [setupPin, setSetupPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  useEffect(() => {
    const token = getAuthToken();
    const username = getAuthUsername();
    if (!token || !username) {
      router.push('/login');
      return;
    }
    setIsLoggedIn(true);
    getMe(token)
      .then((user) => {
        setCurrentUser(user);
        setUserName(formatUserDisplayName(user));
        
        // Redirect Admin to User Management Page
        const ADMIN_ROLE_ID = 'f9826f7f-a8b9-4fe0-9d61-3047fbc101f0';
        const roleId = typeof user.role === 'object' ? user.role?.id : user.role;
        if (roleId === ADMIN_ROLE_ID) {
          router.push('/admin/users');
        }
      })
      .catch(() => {
        document.cookie = 'directus_token=; path=/; max-age=0';
        document.cookie = 'directus_refresh=; path=/; max-age=0';
        document.cookie = 'directus_username=; path=/; max-age=0';
        router.push('/login');
      });

    api.getUsers().then(setUsers).catch(console.error);
  }, []);

  useEffect(() => {
    const closeDropdown = () => setShowUserDropdown(false);
    if (showUserDropdown) {
      window.addEventListener('click', closeDropdown);
    }
    return () => window.removeEventListener('click', closeDropdown);
  }, [showUserDropdown]);

  useEffect(() => {
    // Wait until currentUser is resolved before loading tasks
    // This prevents showing empty results while getMe() is still in-flight
    if (!currentUser) return;
    loadTasks();
  }, [currentUser, filter]);

  const loadTasks = useCallback(async () => {
    if (!currentUser) return; // safety guard
    setIsLoading(true);       // reset spinner on every reload
    try {
      const result = await api.getTasks();
      
      const formattedName = formatUserDisplayName(currentUser);
      const isUserMatch = (taskField: string | null | undefined) => {
        if (!taskField) return false;
        if (taskField === formattedName) return true;
        if (currentUser.first_name && taskField.includes(`(${currentUser.first_name})`)) return true;
        if (currentUser.username && taskField.includes(`(${currentUser.username})`)) return true;
        if (taskField === currentUser.first_name || taskField === currentUser.username) return true;
        return false;
      };

      // SECURITY: Users should only ever see tasks they created OR are related to.
      const allRelatedTasks = result.data.filter(
        (t) =>
          t.creator_id === currentUser?.id ||
          isUserMatch(t.assignee) ||
          isUserMatch(t.manager) ||
          (t.collaborators && t.collaborators.some(col => isUserMatch(col)))
      );

      // Auto-archive Done tasks (hide if status is 'done' and updated_at/created_at is older than 7 days)
      const activeTasks = allRelatedTasks.filter((t) => {
        if (t.status !== 'done') return true;
        const lastUpdate = new Date(t.updated_at || t.created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return lastUpdate >= sevenDaysAgo;
      });

      if (filter === 'my_tasks') {
        // "งานของฉัน" (My Tasks) shows tasks where I am the assignee
        const filtered = activeTasks.filter((t) => isUserMatch(t.assignee));
        setTasks(filtered);
      } else {
        // "งานที่เกี่ยวข้อง" (Related Tasks) shows other tasks where I am involved (manager, collaborator, or creator but not assignee)
        const filtered = activeTasks.filter(
          (t) =>
            !isUserMatch(t.assignee) &&
            (t.creator_id === currentUser?.id ||
              isUserMatch(t.manager) ||
              (t.collaborators && t.collaborators.some(col => isUserMatch(col))))
        );
        setTasks(filtered);
      }
    } catch {
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn, currentUser, filter]);

  const getUserTelegramId = (nameOrId: string) => {
    if (!nameOrId || !users) return undefined;
    const user = users.find(u => {
      if (u.id === nameOrId || u.username === nameOrId || u.first_name === nameOrId) return true;
      if (formatUserDisplayName(u) === nameOrId) return true;
      if (u.first_name && nameOrId.includes(`(${u.first_name})`)) return true;
      if (u.username && nameOrId.includes(`(${u.username})`)) return true;
      return false;
    });
    return user?.telegram_id || undefined;
  };

  const handleLogout = () => {
    authLogout();
  };

  const handlePinPress = (num: string) => {
    if (isSavingPin) return;
    setPinError('');
    setPinSuccess('');

    if (num === 'back') {
      setSetupPin((prev) => prev.slice(0, -1));
      return;
    }

    if (setupPin.length >= 6) return;
    setSetupPin((prev) => prev + num);
  };

  const handleSavePin = async () => {
    if (setupPin.length !== 6) {
      setPinError('กรุณากรอก PIN ให้ครบ 6 หลัก');
      return;
    }

    setIsSavingPin(true);
    setPinError('');
    setPinSuccess('');

    try {
      const token = getAuthToken();
      if (!token || !currentUser) throw new Error('Session Expired');

      await admin.updateUser(token, currentUser.id, {
        pin_code: setupPin,
      });

      setPinSuccess('ตั้งค่า PIN Code สำเร็จแล้ว!');
      setTimeout(() => {
        setIsPinModalOpen(false);
        setSetupPin('');
        setPinSuccess('');
      }, 1500);
    } catch (err: any) {
      setPinError(err.message || 'บันทึก PIN ไม่สำเร็จ');
    } finally {
      setIsSavingPin(false);
    }
  };

  const members = useMemo((): TeamMember[] => {
    const memberMap = new Map<string, Task[]>();
    for (const task of tasks) {
      const creatorName = task.created_by_name || 'System';
      const list = memberMap.get(creatorName) || [];
      list.push(task);
      memberMap.set(creatorName, list);
    }
    
    return Array.from(memberMap.entries()).map(([name, memberTasks]) => {
      const nicknameMatch = name.match(/^([^\s(]+)/);
      const nickname = nicknameMatch ? nicknameMatch[1] : name.charAt(0);
      
      return {
        name,
        avatar_url: '',
        tasks: memberTasks,
        totalTasks: memberTasks.length,
        completedTasks: memberTasks.filter((t) => t.status === 'done').length,
        overallProgress: Math.round(
          memberTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / (memberTasks.length || 1)
        ),
        telegram_id: getUserTelegramId(name),
      };
    });
  }, [tasks, users]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Logo and Mobile Avatar Toggle */}
            <div className="flex items-center justify-between w-full sm:w-auto">
              <Link href="/">
                <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  🔄 WorkSync
                </h1>
              </Link>

              {/* Mobile Actions */}
              {isLoggedIn && (
                <div className="flex items-center gap-3 sm:hidden">
                  <Link
                    href="/tasks/new"
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                    title="เพิ่มงาน"
                  >
                    ➕
                  </Link>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUserDropdown(!showUserDropdown);
                      }}
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md active:scale-95 transition-transform"
                    >
                      {currentUser?.nickname?.charAt(0).toUpperCase() || currentUser?.first_name?.charAt(0).toUpperCase() || 'U'}
                    </button>

                    {showUserDropdown && (
                      <div className="absolute right-0 mt-2.5 w-60 bg-white dark:bg-slate-800 rounded-xl border border-slate-250 dark:border-slate-700 shadow-xl py-3 px-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="border-b border-slate-100 dark:border-slate-700 pb-2 mb-2">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">ผู้เข้าใช้งาน</p>
                          <UserDisplay name={userName} size="sm" telegramId={getUserTelegramId(userName)} />
                        </div>
                        <div className="space-y-1">
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              setIsPinModalOpen(true);
                            }}
                            className="w-full text-left py-2 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                          >
                            🔑 ตั้งค่า PIN Code
                          </button>
                          <button
                            onClick={handleLogout}
                            className="w-full text-left py-2 px-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors flex items-center gap-2"
                          >
                            🚪 ออกจากระบบ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Navigation & Filters */}
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto scrollbar-none pb-1 sm:pb-0">
                <button
                  onClick={() => {
                    setFilter('my_tasks');
                    sessionStorage.setItem('worksync_tab_filter', 'my_tasks');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    filter === 'my_tasks'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  งานของฉัน
                </button>
                <button
                  onClick={() => {
                    setFilter('involved_tasks');
                    sessionStorage.setItem('worksync_tab_filter', 'involved_tasks');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                    filter === 'involved_tasks'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  งานที่เกี่ยวข้อง
                </button>
              </div>

              {/* Desktop-only elements */}
              {isLoggedIn ? (
                <div className="hidden sm:flex items-center gap-3 ml-2">
                  <Link
                    href="/tasks/new"
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shadow-sm"
                  >
                    ➕ เพิ่มงาน
                  </Link>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUserDropdown(!showUserDropdown);
                      }}
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md hover:brightness-105 active:scale-95 transition-transform"
                    >
                      {currentUser?.nickname?.charAt(0).toUpperCase() || currentUser?.first_name?.charAt(0).toUpperCase() || 'U'}
                    </button>

                    {showUserDropdown && (
                      <div className="absolute right-0 mt-2.5 w-60 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-3 px-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="border-b border-slate-100 dark:border-slate-700 pb-2 mb-2">
                          <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">ผู้เข้าใช้งาน</p>
                          <UserDisplay name={userName} size="sm" telegramId={getUserTelegramId(userName)} />
                        </div>
                        <div className="space-y-1">
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              setIsPinModalOpen(true);
                            }}
                            className="w-full text-left py-2 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
                          >
                            🔑 ตั้งค่า PIN Code
                          </button>
                          <button
                            onClick={handleLogout}
                            className="w-full text-left py-2 px-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors flex items-center gap-2"
                          >
                            🚪 ออกจากระบบ
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  🔐 เข้าสู่ระบบ
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <TeamDashboard members={members} loading={isLoading} isMyTasks={filter === 'my_tasks'} />
      </main>

      {/* PIN Setup Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-700/60 overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>🔑</span> ตั้งค่า PIN Code ของคุณ
              </h2>
              <button
                disabled={isSavingPin}
                onClick={() => {
                  setIsPinModalOpen(false);
                  setSetupPin('');
                  setPinError('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-5">
              {pinError && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs py-2 px-3 rounded-lg border border-red-100 dark:border-red-800 text-center font-medium">
                  {pinError}
                </div>
              )}
              {pinSuccess && (
                <div className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs py-2 px-3 rounded-lg border border-green-100 dark:border-green-800 text-center font-medium">
                  {pinSuccess}
                </div>
              )}

              {/* Dots */}
              <div className="flex justify-center gap-4 py-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                      i < setupPin.length
                        ? 'bg-blue-600 border-blue-600 scale-110 shadow-sm'
                        : 'border-gray-300 dark:border-slate-600 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto pt-2 justify-items-center">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={isSavingPin}
                    onClick={() => handlePinPress(num)}
                    className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-slate-800 dark:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-150 dark:border-slate-650 active:scale-95 shadow-sm transition-all"
                  >
                    {num}
                  </button>
                ))}
                <div className="w-14 h-14" /> {/* Empty spacing */}
                <button
                  type="button"
                  disabled={isSavingPin}
                  onClick={() => handlePinPress('0')}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-slate-800 dark:text-slate-100 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-150 dark:border-slate-650 active:scale-95 shadow-sm transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={isSavingPin}
                  onClick={() => handlePinPress('back')}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-700 border border-slate-150 dark:border-slate-650 active:scale-95 shadow-sm transition-all"
                >
                  ⌫
                </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-4 border-t border-slate-100 dark:border-slate-700 flex gap-2">
              <button
                disabled={isSavingPin || setupPin.length !== 6}
                onClick={handleSavePin}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                {isSavingPin ? 'กำลังบันทึก...' : 'บันทึก PIN Code'}
              </button>
              <button
                disabled={isSavingPin}
                onClick={() => {
                  setIsPinModalOpen(false);
                  setSetupPin('');
                  setPinError('');
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
