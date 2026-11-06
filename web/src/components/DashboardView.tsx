'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type { Task, User } from '@/types';
import TaskCard from './TaskCard';
import UserDisplay from './UserDisplay';

interface DashboardViewProps {
  tasks: Task[];
  users: User[];
  currentUserName?: string;
}

// สีตาม Apple iOS System Palette
const COLORS = {
  todo: '#8E8E93',        // iOS Gray
  in_progress: '#007AFF', // iOS Blue
  review: '#FF9500',      // iOS Orange
  done: '#34C759',        // iOS Green
};

const CHART_PALETTE = [
  '#007AFF', '#34C759', '#FF9500', '#5856D6', 
  '#FF2D55', '#5AC8FA', '#AF52DE', '#FFCC00'
];

export default function DashboardView({ tasks, users, currentUserName }: DashboardViewProps) {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const getDepartment = (assigneeName: string): string => {
    if (!assigneeName) return 'OTHER';
    
    const match = assigneeName.match(/\/([^\s/]+)$/);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }

    const matchedUser = users.find((u) => {
      const nickname = u.nickname || '';
      const firstName = u.first_name || '';
      const username = u.username || '';
      
      return assigneeName === username || 
             assigneeName === firstName ||
             assigneeName.includes(`(${firstName})`) ||
             assigneeName.includes(`(${username})`);
    });

    if (matchedUser && matchedUser.department) {
      return matchedUser.department.toUpperCase();
    }

    return 'OTHER';
  };

  const departmentData = useMemo(() => {
    const deptMap: Record<string, { todo: number; in_progress: number; review: number; done: number; total: number }> = {};
    const departmentsList = ['IT', 'SALES', 'MARKETING', 'PRODUCTION', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'OTHER'];
    departmentsList.forEach(dept => {
      deptMap[dept] = { todo: 0, in_progress: 0, review: 0, done: 0, total: 0 };
    });

    tasks.forEach(task => {
      if (task.is_archived) return;
      const dept = getDepartment(task.assignee);
      
      if (!deptMap[dept]) {
        deptMap[dept] = { todo: 0, in_progress: 0, review: 0, done: 0, total: 0 };
      }
      
      const status = task.status as 'todo' | 'in_progress' | 'review' | 'done';
      if (deptMap[dept][status] !== undefined) {
        deptMap[dept][status]++;
        deptMap[dept].total++;
      }
    });

    return Object.entries(deptMap)
      .filter(([_, stats]) => stats.total > 0)
      .map(([name, stats]) => ({
        name,
        ...stats,
        completionRate: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [tasks, users]);

  const memberData = useMemo(() => {
    if (!selectedDept) return [];

    const memberMap: Record<string, { todo: number; in_progress: number; review: number; done: number; total: number; progressSum: number; tasks: Task[]; avatar_url?: string; telegram_id?: string }> = {};

    tasks.forEach(task => {
      if (task.is_archived) return;
      const dept = getDepartment(task.assignee);
      if (dept !== selectedDept) return;

      const memberName = task.assignee || 'Unassigned';
      if (!memberMap[memberName]) {
        const u = users.find(user => 
          memberName.includes(`(${user.first_name})`) ||
          memberName.includes(`(${user.username})`) ||
          memberName === user.first_name ||
          memberName === user.username
        );
        memberMap[memberName] = {
          todo: 0,
          in_progress: 0,
          review: 0,
          done: 0,
          total: 0,
          progressSum: 0,
          tasks: [],
          avatar_url: u?.avatar_url || undefined,
          telegram_id: u?.telegram_id || undefined,
        };
      }

      const status = task.status as 'todo' | 'in_progress' | 'review' | 'done';
      if (memberMap[memberName][status] !== undefined) {
        memberMap[memberName][status]++;
        memberMap[memberName].total++;
        memberMap[memberName].progressSum += task.progress || 0;
        memberMap[memberName].tasks.push(task);
      }
    });

    return Object.entries(memberMap)
      .map(([name, data]) => ({
        name,
        ...data,
        avgProgress: data.total > 0 ? Math.round(data.progressSum / data.total) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [tasks, selectedDept, users]);

  const memberTasks = useMemo(() => {
    if (!selectedMember) return [];
    return tasks.filter(t => !t.is_archived && t.assignee === selectedMember);
  }, [tasks, selectedMember]);

  const statsSummary = useMemo(() => {
    let total = 0;
    let completed = 0;
    let doing = 0;
    let overdue = 0;
    const now = Date.now();

    tasks.forEach(t => {
      if (t.is_archived) return;
      total++;
      if (t.status === 'done') completed++;
      if (t.status === 'in_progress' || t.status === 'review') doing++;
      if (t.status !== 'done' && t.deadline && new Date(t.deadline).getTime() < now) {
        overdue++;
      }
    });

    return { total, completed, doing, overdue };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* 1. iOS Stat Capsule Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#151D2A] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="text-2xl sm:text-3xl font-extrabold text-[#007AFF] font-mono">{statsSummary.total}</div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span>📋</span> ภารกิจทั้งหมด
          </div>
        </div>
        <div className="bg-white dark:bg-[#151D2A] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="text-2xl sm:text-3xl font-extrabold text-[#34C759] font-mono">{statsSummary.completed}</div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span>✅</span> เสร็จสิ้นแล้ว
          </div>
        </div>
        <div className="bg-white dark:bg-[#151D2A] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="text-2xl sm:text-3xl font-extrabold text-[#FF9500] font-mono">{statsSummary.doing}</div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span>🔄</span> ดำเนินการ & ตรวจสอบ
          </div>
        </div>
        <div className="bg-white dark:bg-[#151D2A] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${statsSummary.overdue > 0 ? 'text-[#FF3B30] animate-pulse' : 'text-slate-400'}`}>
            {statsSummary.overdue}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span>⚠️</span> เกินกำหนดส่ง
          </div>
        </div>
      </div>

      {/* 2. Drill-Down Levels */}
      {!selectedDept ? (
        /* LEVEL 1: Department Overview */
        <div className="bg-white dark:bg-[#151D2A] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>🏢</span> สรุปภาระงานแบ่งตามแผนก
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">คลิกที่แท่งกราฟหรือการ์ดแผนกเพื่อเจาะลึกรายชื่อพนักงาน</p>
            </div>
          </div>

          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departmentData}
                layout="vertical"
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                onClick={(state) => {
                  if (state && state.activeLabel) {
                    setSelectedDept(state.activeLabel);
                  }
                }}
              >
                <XAxis type="number" stroke="#888888" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#888888" fontSize={11} width={85} />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 122, 255, 0.05)' }}
                  contentStyle={{
                    backgroundColor: 'rgba(21, 29, 42, 0.95)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="todo" name="To Do" stackId="a" fill={COLORS.todo} radius={[0, 0, 0, 0]} />
                <Bar dataKey="in_progress" name="Doing" stackId="a" fill={COLORS.in_progress} radius={[0, 0, 0, 0]} />
                <Bar dataKey="review" name="Review" stackId="a" fill={COLORS.review} radius={[0, 0, 0, 0]} />
                <Bar dataKey="done" name="Done" stackId="a" fill={COLORS.done} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {departmentData.map((dept) => (
              <div
                key={dept.name}
                onClick={() => setSelectedDept(dept.name)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 hover:border-[#007AFF] dark:hover:border-blue-400 cursor-pointer transition-all duration-200"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{dept.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
                    สำเร็จ {dept.completionRate}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-3 overflow-hidden">
                  <div
                    className="bg-[#34C759] h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${dept.completionRate}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                  <div className="bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-100 dark:border-slate-700/60">
                    <div>{dept.todo}</div>
                    <div className="text-[8px] font-sans font-normal text-slate-400">To Do</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-1 rounded-lg text-[#007AFF] border border-blue-100 dark:border-blue-900/40">
                    <div>{dept.in_progress}</div>
                    <div className="text-[8px] font-sans font-normal">Doing</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 p-1 rounded-lg text-[#FF9500] border border-amber-100 dark:border-amber-900/40">
                    <div>{dept.review}</div>
                    <div className="text-[8px] font-sans font-normal">Review</div>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-1 rounded-lg text-[#34C759] border border-emerald-100 dark:border-emerald-900/40">
                    <div>{dept.done}</div>
                    <div className="text-[8px] font-sans font-normal">Done</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !selectedMember ? (
        /* LEVEL 2: Department Members */
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDept(null)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151D2A] text-xs font-semibold text-[#007AFF] hover:bg-slate-50 transition-colors shadow-sm"
            >
              <span>← แผนกทั้งหมด</span>
            </button>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
              แผนก: <span className="text-[#007AFF]">{selectedDept}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-1 bg-white dark:bg-[#151D2A] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-center items-center">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 text-center uppercase tracking-wider">
                สัดส่วนงานของคนในแผนก
              </h3>
              <div className="h-44 w-full flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={memberData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                    >
                      {memberData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(21, 29, 42, 0.95)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontSize: '11px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="w-full mt-3 space-y-1 max-h-32 overflow-y-auto scrollbar-none">
                {memberData.map((member, index) => (
                  <div key={member.name} className="flex items-center justify-between text-[10px] font-semibold">
                    <div className="flex items-center gap-1.5 truncate mr-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length] }} />
                      <span className="text-slate-700 dark:text-slate-300 truncate">{member.name.split('/')[0]}</span>
                    </div>
                    <span className="text-slate-400 font-mono">{member.total} งาน</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {memberData.map((member) => (
                <div
                  key={member.name}
                  onClick={() => setSelectedMember(member.name)}
                  className="bg-white dark:bg-[#151D2A] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden cursor-pointer hover:border-[#007AFF] hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="p-4 flex items-center gap-3">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                        <UserDisplay name={member.name} telegramId={member.telegram_id} size="sm" />
                      </h4>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                        สำเร็จเฉลี่ย: {member.avgProgress}% ({member.done}/{member.total} ภารกิจ)
                      </p>
                    </div>
                  </div>

                  <div className="px-4 pb-3">
                    <div className="w-full bg-slate-100 dark:bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#34C759] h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${member.avgProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* LEVEL 3: Individual Member Tasks */
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMember(null)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151D2A] text-xs font-semibold text-[#007AFF] hover:bg-slate-50 transition-colors shadow-sm"
            >
              <span>← คนในแผนก {selectedDept}</span>
            </button>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate">
              ภารกิจของ: <span className="text-[#007AFF]">{selectedMember}</span>
            </h2>
          </div>

          <div className="space-y-3">
            {memberTasks.map((t) => (
              <TaskCard key={t.id} task={t} currentUserName={currentUserName} users={users} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
