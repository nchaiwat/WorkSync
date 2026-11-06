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
import { formatUserDisplayName } from '@/lib/auth';

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
  overdue: '#FF3B30',     // iOS Red
  purple: '#5856D6',      // iOS Purple
};

const CHART_PALETTE = [
  '#007AFF', '#34C759', '#FF9500', '#5856D6', 
  '#FF2D55', '#5AC8FA', '#AF52DE', '#FFCC00',
  '#30B0C7', '#34C759', '#FF3B30', '#64D2FF'
];

type DashboardTab = 'dept' | 'project' | 'workload' | 'deadlines';

export default function DashboardView({ tasks, users, currentUserName }: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('dept');
  
  // Drill-down states for Dept tab
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  
  // Drill-down state for Project tab
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Helper to extract department
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

  // 1. Overall KPI Stats
  const statsSummary = useMemo(() => {
    let total = 0;
    let completed = 0;
    let doing = 0;
    let review = 0;
    let todo = 0;
    let overdue = 0;
    let totalSubtasks = 0;
    let completedSubtasks = 0;
    const now = Date.now();

    tasks.forEach(t => {
      if (t.is_archived) return;
      total++;
      if (t.status === 'done') completed++;
      else if (t.status === 'review') review++;
      else if (t.status === 'in_progress') doing++;
      else todo++;

      if (t.status !== 'done' && t.deadline && new Date(t.deadline).getTime() < now) {
        overdue++;
      }

      if (t.subtasks && Array.isArray(t.subtasks)) {
        totalSubtasks += t.subtasks.length;
        completedSubtasks += t.subtasks.filter(s => s.completed).length;
      }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { 
      total, 
      completed, 
      doing: doing + review, 
      review, 
      todo, 
      overdue, 
      completionRate,
      totalSubtasks,
      completedSubtasks 
    };
  }, [tasks]);

  // Status Distribution for Donut Chart
  const statusDistribution = useMemo(() => {
    return [
      { name: 'To Do', value: statsSummary.todo, color: COLORS.todo },
      { name: 'Doing', value: statsSummary.doing - statsSummary.review, color: COLORS.in_progress },
      { name: 'Review', value: statsSummary.review, color: COLORS.review },
      { name: 'Done', value: statsSummary.completed, color: COLORS.done },
    ].filter(item => item.value > 0);
  }, [statsSummary]);

  // 2. Department Data Model
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

  // Department Members Data
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

  const departmentMemberTasks = useMemo(() => {
    if (!selectedMember) return [];
    return tasks.filter(t => !t.is_archived && t.assignee === selectedMember);
  }, [tasks, selectedMember]);

  // 3. Project / Workstream Data Model
  const projectData = useMemo(() => {
    const projMap = new Map<string, {
      name: string;
      total: number;
      done: number;
      in_progress: number;
      review: number;
      todo: number;
      overdue: number;
      progressSum: number;
      members: Set<string>;
      tasks: Task[];
    }>();

    const now = Date.now();

    tasks.forEach(task => {
      if (task.is_archived) return;
      const projName = (task.project_owner && task.project_owner.trim()) || 'ทั่วไป (General)';
      let entry = projMap.get(projName);
      if (!entry) {
        entry = {
          name: projName,
          total: 0,
          done: 0,
          in_progress: 0,
          review: 0,
          todo: 0,
          overdue: 0,
          progressSum: 0,
          members: new Set<string>(),
          tasks: [],
        };
        projMap.set(projName, entry);
      }

      entry.total++;
      entry.progressSum += (task.progress || 0);
      entry.tasks.push(task);
      if (task.assignee) entry.members.add(task.assignee);

      if (task.status === 'done') entry.done++;
      else if (task.status === 'review') entry.review++;
      else if (task.status === 'in_progress') entry.in_progress++;
      else entry.todo++;

      if (task.status !== 'done' && task.deadline && new Date(task.deadline).getTime() < now) {
        entry.overdue++;
      }
    });

    return Array.from(projMap.values()).map(p => ({
      ...p,
      completionRate: p.total > 0 ? Math.round((p.done / p.total) * 100) : 0,
      avgProgress: p.total > 0 ? Math.round(p.progressSum / p.total) : 0,
      memberCount: p.members.size,
    })).sort((a, b) => b.total - a.total);
  }, [tasks]);

  const selectedProjectTasks = useMemo(() => {
    if (!selectedProject) return [];
    return tasks.filter(t => {
      if (t.is_archived) return false;
      const proj = (t.project_owner && t.project_owner.trim()) || 'ทั่วไป (General)';
      return proj === selectedProject;
    });
  }, [tasks, selectedProject]);

  // 4. Team Workload & Capacity Data Model
  const teamWorkload = useMemo(() => {
    const memberMap = new Map<string, {
      name: string;
      total: number;
      activeTasks: number;
      done: number;
      doing: number;
      review: number;
      todo: number;
      overdue: number;
      progressSum: number;
      avatar_url?: string;
      telegram_id?: string;
      department?: string;
      tasks: Task[];
    }>();

    const now = Date.now();

    tasks.forEach(task => {
      if (task.is_archived) return;
      const assignee = task.assignee || 'Unassigned';
      let entry = memberMap.get(assignee);
      if (!entry) {
        const u = users.find(user => 
          assignee.includes(`(${user.first_name})`) ||
          assignee.includes(`(${user.username})`) ||
          assignee === user.first_name ||
          assignee === user.username
        );
        entry = {
          name: assignee,
          total: 0,
          activeTasks: 0,
          done: 0,
          doing: 0,
          review: 0,
          todo: 0,
          overdue: 0,
          progressSum: 0,
          avatar_url: u?.avatar_url || undefined,
          telegram_id: u?.telegram_id || undefined,
          department: u?.department || getDepartment(assignee),
          tasks: [],
        };
        memberMap.set(assignee, entry);
      }

      entry.total++;
      entry.progressSum += (task.progress || 0);
      entry.tasks.push(task);

      if (task.status === 'done') entry.done++;
      else {
        entry.activeTasks++;
        if (task.status === 'review') entry.review++;
        else if (task.status === 'in_progress') entry.doing++;
        else entry.todo++;
      }

      if (task.status !== 'done' && task.deadline && new Date(task.deadline).getTime() < now) {
        entry.overdue++;
      }
    });

    return Array.from(memberMap.values()).map(m => {
      const avgProgress = m.total > 0 ? Math.round(m.progressSum / m.total) : 0;
      // Workload capacity levels
      let capacityBadge = { label: 'ปกติ', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
      if (m.activeTasks >= 6) {
        capacityBadge = { label: 'งานล้นมือ', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
      } else if (m.activeTasks >= 3) {
        capacityBadge = { label: 'ปานกลาง', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      }

      return {
        ...m,
        avgProgress,
        capacityBadge,
      };
    }).sort((a, b) => b.activeTasks - a.activeTasks || b.total - a.total);
  }, [tasks, users]);

  // 5. Deadlines & Risk Radar Data Model
  const deadlineAnalysis = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const in7DaysMs = nowMs + 7 * 24 * 60 * 60 * 1000;
    const in48HoursMs = nowMs + 48 * 60 * 60 * 1000;

    const overdueTasks: Array<Task & { daysOverdue: number }> = [];
    const urgent7Days: Array<Task & { daysLeft: number; dueLabel: string }> = [];
    const highRiskTasks: Task[] = [];

    tasks.forEach(task => {
      if (task.is_archived || task.status === 'done' || !task.deadline) return;
      const deadlineMs = new Date(task.deadline).getTime();

      // Overdue
      if (deadlineMs < nowMs) {
        const daysOverdue = Math.max(1, Math.round((nowMs - deadlineMs) / (1000 * 60 * 60 * 24)));
        overdueTasks.push({ ...task, daysOverdue });
      } else if (deadlineMs <= in7DaysMs) {
        // Due in next 7 days
        const daysLeft = Math.ceil((deadlineMs - nowMs) / (1000 * 60 * 60 * 24));
        const dueLabel = daysLeft === 0 ? 'วันนี้' : daysLeft === 1 ? 'พรุ่งนี้' : `อีก ${daysLeft} วัน`;
        urgent7Days.push({ ...task, daysLeft, dueLabel });
      }

      // High Risk Radar: Progress < 40% and deadline within 48 hours
      if (deadlineMs <= in48HoursMs && (task.progress || 0) < 40) {
        highRiskTasks.push(task);
      }
    });

    overdueTasks.sort((a, b) => b.daysOverdue - a.daysOverdue);
    urgent7Days.sort((a, b) => a.daysLeft - b.daysLeft);

    return { overdueTasks, urgent7Days, highRiskTasks };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* 1. iOS Stat Capsule Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Tasks */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#007AFF] font-mono">{statsSummary.total}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] border border-blue-200/60 dark:border-blue-900/40">
              {statsSummary.completionRate}% Done
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span>📋</span> ภารกิจทั้งหมด
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#34C759] font-mono">{statsSummary.completed}</div>
            {statsSummary.totalSubtasks > 0 && (
              <span className="text-[10px] text-slate-400">
                ☑️ {statsSummary.completedSubtasks}/{statsSummary.totalSubtasks} ข้อย่อย
              </span>
            )}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span>✅</span> เสร็จสิ้นแล้ว
          </div>
        </div>

        {/* In Progress & Review */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#FF9500] font-mono">{statsSummary.doing}</div>
            <span className="text-[10px] font-semibold text-slate-400">
              {statsSummary.doing - statsSummary.review} Doing • {statsSummary.review} Review
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span>🔄</span> ดำเนินการ & ตรวจสอบ
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${statsSummary.overdue > 0 ? 'text-[#FF3B30] animate-pulse' : 'text-slate-400'}`}>
              {statsSummary.overdue}
            </div>
            {statsSummary.overdue > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                ต้องแก้ไข
              </span>
            )}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
            <span>⚠️</span> เกินกำหนดส่ง
          </div>
        </div>
      </div>

      {/* 2. iOS Segmented Sub-View Switcher */}
      <div className="flex items-center p-1.5 bg-slate-200/60 dark:bg-[#151E2E] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none shadow-xs">
        <button
          type="button"
          onClick={() => {
            setActiveTab('dept');
            setSelectedDept(null);
            setSelectedMember(null);
          }}
          className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'dept'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>🏢</span>
          <span>แผนกและภาพรวม</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('project');
            setSelectedProject(null);
          }}
          className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'project'
              ? 'bg-white dark:bg-slate-700 text-[#007AFF] dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📂</span>
          <span>แยกตามโครงการ ({projectData.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workload')}
          className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'workload'
              ? 'bg-white dark:bg-slate-700 text-[#5856D6] dark:text-purple-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>👥</span>
          <span>ภาระงานทีม ({teamWorkload.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('deadlines')}
          className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'deadlines'
              ? 'bg-white dark:bg-slate-700 text-[#FF9500] dark:text-amber-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>⏰</span>
          <span>กำหนดส่ง & ความเสี่ยง</span>
          {statsSummary.overdue > 0 && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* 3. Sub-View Contents */}

      {/* ─────────────────── TAB 1: 🏢 แผนกและภาพรวม (DEPARTMENTS) ─────────────────── */}
      {activeTab === 'dept' && (
        <>
          {!selectedDept ? (
            /* LEVEL 1: Department Overview */
            <div className="space-y-6">
              {/* Balanced 2-Column: Status Distribution Ring + Department Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Overall Status Donut */}
                <div className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                    <span>🎯</span> สัดส่วนสถานะงานรวม
                  </h3>
                  <div className="h-48 w-full flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-black font-mono text-slate-900 dark:text-white">
                        {statsSummary.completionRate}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Completed</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {statusDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600 dark:text-slate-400 truncate">{item.name}:</span>
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-200 ml-auto">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right (2 Cols): Department Horizontal Stacked Bar */}
                <div className="lg:col-span-2 bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span>🏢</span> ภาระงานแยกตามแผนก
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">คลิกที่แท่งกราฟหรือการ์ดแผนกด้านล่างเพื่อเจาะลึกดูสมาชิก</p>
                    </div>
                  </div>

                  <div className="h-48 sm:h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={departmentData}
                        layout="vertical"
                        margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                        onClick={(state) => {
                          if (state && state.activeLabel) {
                            setSelectedDept(state.activeLabel);
                          }
                        }}
                      >
                        <XAxis type="number" stroke="#888888" fontSize={10} />
                        <YAxis dataKey="name" type="category" stroke="#888888" fontSize={11} width={80} />
                        <Tooltip
                          cursor={{ fill: 'rgba(0, 122, 255, 0.05)' }}
                          contentStyle={{
                            backgroundColor: 'rgba(21, 29, 42, 0.95)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontSize: '11px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                        <Bar dataKey="todo" name="To Do" stackId="a" fill={COLORS.todo} />
                        <Bar dataKey="in_progress" name="Doing" stackId="a" fill={COLORS.in_progress} />
                        <Bar dataKey="review" name="Review" stackId="a" fill={COLORS.review} />
                        <Bar dataKey="done" name="Done" stackId="a" fill={COLORS.done} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Department Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {departmentData.map((dept) => (
                  <div
                    key={dept.name}
                    onClick={() => setSelectedDept(dept.name)}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#151E2E] hover:border-[#007AFF] dark:hover:border-blue-400 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <span>🏢</span>
                        <span>{dept.name}</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
                        สำเร็จ {dept.completionRate}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-3 overflow-hidden">
                      <div
                        className="bg-[#34C759] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${dept.completionRate}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700/60">
                        <div>{dept.todo}</div>
                        <div className="text-[8px] font-sans font-normal text-slate-400">To Do</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/30 p-1.5 rounded-lg text-[#007AFF] border border-blue-100 dark:border-blue-900/40">
                        <div>{dept.in_progress}</div>
                        <div className="text-[8px] font-sans font-normal">Doing</div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg text-[#FF9500] border border-amber-100 dark:border-amber-900/40">
                        <div>{dept.review}</div>
                        <div className="text-[8px] font-sans font-normal">Review</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded-lg text-[#34C759] border border-emerald-100 dark:border-emerald-900/40">
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151E2E] text-xs font-semibold text-[#007AFF] hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <span>← แผนกทั้งหมด</span>
                </button>
                <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                  แผนก: <span className="text-[#007AFF]">{selectedDept}</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-1 bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-center items-center">
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
                          {memberData.map((_, index) => (
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
                      className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden cursor-pointer hover:border-[#007AFF] hover:shadow-md transition-all duration-200 flex flex-col justify-between"
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151E2E] text-xs font-semibold text-[#007AFF] hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <span>← คนในแผนก {selectedDept}</span>
                </button>
                <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                  ภารกิจของ: <span className="text-[#007AFF]">{selectedMember}</span>
                </h2>
              </div>

              <div className="space-y-3">
                {departmentMemberTasks.map((t) => (
                  <TaskCard key={t.id} task={t} currentUserName={currentUserName} users={users} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─────────────────── TAB 2: 📂 แยกตามโครงการ (PROJECTS) ─────────────────── */}
      {activeTab === 'project' && (
        <div className="space-y-6">
          {!selectedProject ? (
            <>
              {/* Project Overview Chart + Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Donut Chart: Project Share */}
                <div className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2">
                    <span>📊</span> สัดส่วนงานในแต่ละโครงการ
                  </h3>
                  <div className="h-44 w-full flex justify-center items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={projectData}
                          dataKey="total"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={68}
                          paddingAngle={3}
                        >
                          {projectData.map((_, index) => (
                            <Cell key={`cell-proj-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
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

                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 max-h-36 overflow-y-auto">
                    {projectData.map((p, idx) => (
                      <div key={p.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate mr-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }} />
                          <span className="text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                        </div>
                        <span className="font-mono text-slate-500 dark:text-slate-400 font-bold">{p.total} ภารกิจ</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Project Cards List */}
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      รายการโครงการทั้งหมด ({projectData.length})
                    </h3>
                    <span className="text-xs text-slate-400">คลิกที่การ์ดเพื่อดูงานภายในโครงการ</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {projectData.map((project, idx) => (
                      <div
                        key={project.name}
                        onClick={() => setSelectedProject(project.name)}
                        className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 hover:border-[#007AFF] p-4 rounded-2xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }} />
                              <span className="truncate">{project.name}</span>
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              สำเร็จ {project.completionRate}%
                            </span>
                          </div>

                          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-3 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-[#007AFF] to-[#34C759] h-2 rounded-full transition-all duration-300"
                              style={{ width: `${project.completionRate}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
                            <span>👥 ผู้รับผิดชอบ {project.memberCount} คน</span>
                            <span>{project.done}/{project.total} งานเสร็จสิ้น</span>
                          </div>

                          <div className="flex gap-1 text-[10px] font-mono font-bold">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                              {project.todo} To Do
                            </span>
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] rounded">
                              {project.in_progress} Doing
                            </span>
                            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-[#FF9500] rounded">
                              {project.review} Review
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-[#34C759] rounded">
                              {project.done} Done
                            </span>
                            {project.overdue > 0 && (
                              <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-[#FF3B30] rounded">
                                {project.overdue} สาย
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Selected Project Tasks Drilldown */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151E2E] text-xs font-semibold text-[#007AFF] hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <span>← โครงการทั้งหมด</span>
                </button>
                <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                  ภารกิจในโครงการ: <span className="text-[#007AFF]">{selectedProject}</span> ({selectedProjectTasks.length} ภารกิจ)
                </h2>
              </div>

              <div className="space-y-3">
                {selectedProjectTasks.map((t) => (
                  <TaskCard key={t.id} task={t} currentUserName={currentUserName} users={users} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────── TAB 3: 👥 ภาระงานทีม (TEAM WORKLOAD) ─────────────────── */}
      {activeTab === 'workload' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>👥</span> การกระจายภาระงานในทีม (Team Capacity & Workload)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ประเมินความหนาแน่นของงานสมาชิกแต่ละคน เพื่อเกลี่ยงานได้อย่างมีประสิทธิภาพ
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                🟢 ปกติ (1-2 งาน)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                🟡 ปานกลาง (3-5 งาน)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-800">
                🔴 งานแน่น (≥6 งาน)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamWorkload.map((member) => (
              <div
                key={member.name}
                className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Member Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover shadow-sm flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          <UserDisplay name={member.name} telegramId={member.telegram_id} size="sm" />
                        </h4>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          แผนก: {member.department}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${member.capacityBadge.color}`}>
                      {member.capacityBadge.label}
                    </span>
                  </div>

                  {/* Active vs Done Bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600 dark:text-slate-400">
                        ค้างอยู่ {member.activeTasks} ภารกิจ (เสร็จ {member.done})
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {member.avgProgress}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                      <div
                        className="bg-[#34C759] h-2 transition-all duration-300"
                        style={{ width: `${member.total > 0 ? (member.done / member.total) * 100 : 0}%` }}
                        title="Done"
                      />
                      <div
                        className="bg-[#007AFF] h-2 transition-all duration-300"
                        style={{ width: `${member.total > 0 ? (member.doing / member.total) * 100 : 0}%` }}
                        title="Doing"
                      />
                      <div
                        className="bg-[#FF9500] h-2 transition-all duration-300"
                        style={{ width: `${member.total > 0 ? (member.review / member.total) * 100 : 0}%` }}
                        title="Review"
                      />
                      <div
                        className="bg-slate-300 dark:bg-slate-600 h-2 transition-all duration-300"
                        style={{ width: `${member.total > 0 ? (member.todo / member.total) * 100 : 0}%` }}
                        title="To Do"
                      />
                    </div>
                  </div>
                </div>

                {/* Mini Status Breakdown Pills */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono font-bold">
                  <span className="text-slate-500">To Do: {member.todo}</span>
                  <span className="text-[#007AFF]">Doing: {member.doing}</span>
                  <span className="text-[#FF9500]">Review: {member.review}</span>
                  <span className="text-[#34C759]">Done: {member.done}</span>
                  {member.overdue > 0 && (
                    <span className="text-[#FF3B30] font-bold">⚠️ เกิน: {member.overdue}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 4: ⏰ กำหนดส่ง & ความเสี่ยง (DEADLINES & RISK) ─────────────────── */}
      {activeTab === 'deadlines' && (
        <div className="space-y-6">
          {/* Top Row: High Risk Alert Box (if any) */}
          {deadlineAnalysis.highRiskTasks.length > 0 && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                <span>🚨</span>
                <span>เรดาร์ความเสี่ยงสูง (High Risk Radar) — {deadlineAnalysis.highRiskTasks.length} ภารกิจ</span>
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-300 mb-3">
                ภารกิจต่อไปนี้เหลือเวลาไม่ถึง 48 ชั่วโมง แต่ความคืบหน้ายังน้อยกว่า 40% หัวหน้างานควรตรวจสอบหรือให้การช่วยเหลือ
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {deadlineAnalysis.highRiskTasks.map(task => (
                  <div key={task.id} className="bg-white dark:bg-[#151E2E] p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 shadow-xs flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{task.title}</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5">👤 {task.assignee}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded">
                      {task.progress}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2-Columns: Overdue vs Next 7 Days */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Overdue Tasks */}
            <div className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="text-rose-500">⚠️</span>
                  <span>งานที่เกินกำหนดส่งแล้ว ({deadlineAnalysis.overdueTasks.length})</span>
                </h3>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                  ต้องการ Action ทันที
                </span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {deadlineAnalysis.overdueTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 hover:border-rose-400 transition-colors shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded">
                          เกินมาแล้ว {task.daysOverdue} วัน
                        </span>
                        {task.project_owner && (
                          <span className="text-[10px] text-slate-400 truncate">📂 {task.project_owner}</span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>👤 {task.assignee}</span>
                        <span>•</span>
                        <span>ความคืบหน้า: {task.progress}%</span>
                      </div>
                    </div>

                    <a
                      href={`/tasks/${task.id}`}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex-shrink-0"
                    >
                      เปิดดู →
                    </a>
                  </div>
                ))}

                {deadlineAnalysis.overdueTasks.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    🎉 ยอดเยี่ยม! ขณะนี้ไม่มีงานที่เกินกำหนดส่งในระบบ
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Due in Next 7 Days */}
            <div className="bg-white dark:bg-[#151E2E] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="text-amber-500">⏰</span>
                  <span>กำหนดส่งใน 7 วันข้างหน้า ({deadlineAnalysis.urgent7Days.length})</span>
                </h3>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
                  ต้องติดตาม
                </span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {deadlineAnalysis.urgent7Days.map(task => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 hover:border-amber-400 transition-colors shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          task.dueLabel === 'วันนี้' 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                        }`}>
                          ส่ง: {task.dueLabel}
                        </span>
                        {task.project_owner && (
                          <span className="text-[10px] text-slate-400 truncate">📂 {task.project_owner}</span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>👤 {task.assignee}</span>
                        <span>•</span>
                        <span>ความคืบหน้า: {task.progress}%</span>
                      </div>
                    </div>

                    <a
                      href={`/tasks/${task.id}`}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex-shrink-0"
                    >
                      เปิดดู →
                    </a>
                  </div>
                ))}

                {deadlineAnalysis.urgent7Days.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    ☕ ไม่มีงานที่ครบกำหนดส่งใน 7 วันนี้ ทีมสามารถวางแผนงานถัดไปได้สบายๆ
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
