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
import { STATUS_CONFIG } from '@/types';
import TaskCard from './TaskCard';
import UserDisplay from './UserDisplay';

interface DashboardViewProps {
  tasks: Task[];
  users: User[];
  currentUserName?: string;
}

// สีตามแบรนด์
const COLORS = {
  todo: '#94a3b8',        // slate-400
  in_progress: '#3b82f6', // blue-500
  review: '#f59e0b',      // amber-500
  done: '#10b981',        // emerald-500
};

const CHART_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#a855f7'
];

export default function DashboardView({ tasks, users, currentUserName }: DashboardViewProps) {
  // สเตตัสการซูม/เจาะลึก
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // Helper ในการดึงแผนกจากผู้ใช้หรือข้อความ Assignee
  const getDepartment = (assigneeName: string): string => {
    if (!assigneeName) return 'OTHER';
    
    // 1. ตรวจสอบว่าในข้อความ assignee มี /แผนก ต่อท้ายหรือไม่
    const match = assigneeName.match(/\/([^\s/]+)$/);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }

    // 2. ค้นหาใน Users ของระบบเพื่อดึงแผนก
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

  // -------------------------------------------------------------
  // ระดับ 1: คำนวณข้อมูลระดับแผนก (Department Level Calculations)
  // -------------------------------------------------------------
  const departmentData = useMemo(() => {
    const deptMap: Record<string, { todo: number; in_progress: number; review: number; done: number; total: number }> = {};
    
    // ตั้งค่าเริ่มต้นทุกแผนกที่มี
    const departmentsList = ['IT', 'SALES', 'MARKETING', 'PRODUCTION', 'WAREHOUSE', 'PURCHASING', 'ACCOUNTING', 'OTHER'];
    departmentsList.forEach(dept => {
      deptMap[dept] = { todo: 0, in_progress: 0, review: 0, done: 0, total: 0 };
    });

    // วนลูปนับงาน
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
      .map(([name, stats]) => ({
        name,
        ...stats,
        completionRate: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
      }))
      .filter(item => item.total > 0); // แสดงเฉพาะแผนกที่มีงานจริง
  }, [tasks, users]);

  // -------------------------------------------------------------
  // ระดับ 2: คำนวณข้อมูลรายบุคคลในแผนกที่เลือก (Member Level Calculations)
  // -------------------------------------------------------------
  const memberData = useMemo(() => {
    if (!selectedDept) return [];

    const memberMap: Record<string, {
      name: string;
      avatar_url?: string;
      telegram_id?: string;
      todo: number;
      in_progress: number;
      review: number;
      done: number;
      total: number;
      totalProgress: number;
    }> = {};

    tasks.forEach(task => {
      if (task.is_archived) return;
      const dept = getDepartment(task.assignee);
      
      if (dept === selectedDept) {
        const memberName = task.assignee;
        if (!memberMap[memberName]) {
          // หาข้อมูล User จริง
          const matchedUser = users.find(u => {
            return memberName === u.username || 
                   memberName === u.first_name ||
                   memberName.includes(`(${u.first_name})`);
          });

          memberMap[memberName] = {
            name: memberName,
            avatar_url: matchedUser?.avatar_url || task.avatar_url || undefined,
            telegram_id: matchedUser?.telegram_id || undefined,
            todo: 0,
            in_progress: 0,
            review: 0,
            done: 0,
            total: 0,
            totalProgress: 0
          };
        }

        const status = task.status as 'todo' | 'in_progress' | 'review' | 'done';
        if (memberMap[memberName][status] !== undefined) {
          memberMap[memberName][status]++;
          memberMap[memberName].total++;
          memberMap[memberName].totalProgress += task.progress || 0;
        }
      }
    });

    return Object.values(memberMap).map(member => ({
      ...member,
      avgProgress: member.total > 0 ? Math.round(member.totalProgress / member.total) : 0,
    }));
  }, [selectedDept, tasks, users]);

  // -------------------------------------------------------------
  // ระดับ 3: รายการงานของพนักงานที่ถูกเลือก (Selected Member's Tasks)
  // -------------------------------------------------------------
  const filteredTasks = useMemo(() => {
    if (!selectedMember) return [];
    return tasks.filter(task => !task.is_archived && task.assignee === selectedMember);
  }, [selectedMember, tasks]);

  // -------------------------------------------------------------
  // สรุปสถิติภาพรวม (Top Stats Grid)
  // -------------------------------------------------------------
  const statsSummary = useMemo(() => {
    let activeTasks = tasks.filter(t => !t.is_archived);
    
    let total = activeTasks.length;
    let completed = activeTasks.filter(t => t.status === 'done').length;
    let doing = activeTasks.filter(t => t.status === 'in_progress' || t.status === 'review').length;
    
    let overdue = activeTasks.filter(t => {
      if (t.status === 'done') return false;
      if (!t.deadline) return false;
      return new Date(t.deadline).getTime() < Date.now();
    }).length;

    return { total, completed, doing, overdue };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* 1. สรุปสถิติในรูปแบบการ์ดไล่ระดับสี (Top Stats Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900/60 p-4 rounded-xl shadow-sm">
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{statsSummary.total}</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">งานในระบบทั้งหมด</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-100 dark:border-emerald-900/60 p-4 rounded-xl shadow-sm">
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{statsSummary.completed}</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">เสร็จสิ้น (Done)</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-100 dark:border-amber-900/60 p-4 rounded-xl shadow-sm">
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{statsSummary.doing}</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">กำลังทำ & ตรวจสอบ</div>
        </div>
        <div className="bg-gradient-to-br from-rose-500/10 to-pink-500/10 dark:from-rose-950/40 dark:to-pink-950/40 border border-rose-100 dark:border-rose-900/60 p-4 rounded-xl shadow-sm">
          <div className={`text-2xl font-black ${statsSummary.overdue > 0 ? 'text-rose-600 dark:text-rose-450 animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}>{statsSummary.overdue}</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">⚠️ เกินกำหนดส่ง (Overdue)</div>
        </div>
      </div>

      {/* 2. แสดงข้อมูลตามระดับการ Drill Down */}
      {!selectedDept ? (
        // ==========================================
        // LEVEL 1: แผนกหลักทั้งหมด
        // ==========================================
        <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">สรุปภาระงานแบ่งตามแผนก 🏢</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">วิเคราะห์สัดส่วนสถานะงานแยกรายแผนก (คลิกที่แท่งกราฟหรือการ์ดเพื่อดูรายชื่อพนักงาน)</p>
            </div>
          </div>

          {/* กราฟเปรียบเทียบภาระงานของแผนก */}
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
                <XAxis type="number" stroke="#888888" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#888888" fontSize={11} width={80} />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '8px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="todo" name="To Do" stackId="a" fill={COLORS.todo} radius={[0, 0, 0, 0]} />
                <Bar dataKey="in_progress" name="Doing" stackId="a" fill={COLORS.in_progress} radius={[0, 0, 0, 0]} />
                <Bar dataKey="review" name="Review" stackId="a" fill={COLORS.review} radius={[0, 0, 0, 0]} />
                <Bar dataKey="done" name="Done" stackId="a" fill={COLORS.done} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* การ์ดสถิติแสดงความคืบหน้าของแผนก */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departmentData.map((dept) => (
              <div
                key={dept.name}
                onClick={() => setSelectedDept(dept.name)}
                className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-all duration-200"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200">{dept.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                    ความสำเร็จ {dept.completionRate}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-3">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${dept.completionRate}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-extrabold text-slate-500 dark:text-slate-400">
                  <div className="bg-slate-100 dark:bg-slate-850 p-1 rounded">
                    <div>{dept.todo}</div>
                    <div className="text-[8px] mt-0.5">To Do</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-1 rounded text-blue-600 dark:text-blue-400">
                    <div>{dept.in_progress}</div>
                    <div className="text-[8px] mt-0.5">Doing</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 p-1 rounded text-amber-600 dark:text-amber-400">
                    <div>{dept.review}</div>
                    <div className="text-[8px] mt-0.5">Review</div>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-1 rounded text-emerald-600 dark:text-emerald-400">
                    <div>{dept.done}</div>
                    <div className="text-[8px] mt-0.5">Done</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !selectedMember ? (
        // ==========================================
        // LEVEL 2: พนักงานในแผนกที่เลือก
        // ==========================================
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedDept(null)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-extrabold border-2 border-slate-200 dark:border-slate-650 transition-colors shadow-sm"
            >
              ⬅️ กลับสู่ภาพรวมแผนก
            </button>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              แผนก: <span className="text-blue-600 dark:text-blue-400 uppercase">{selectedDept}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* กราฟสัดส่วนงานรายบุคคลในแผนก */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm flex flex-col justify-center items-center">
              <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 mb-4 text-center">สัดส่วนงานของคนในแผนก</h3>
              <div className="h-48 w-full flex justify-center items-center">
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
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '11px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* คำอธิบายสีกราฟวงแหวน */}
              <div className="w-full mt-4 space-y-1 max-h-32 overflow-y-auto scrollbar-none">
                {memberData.map((member, index) => (
                  <div key={member.name} className="flex items-center justify-between text-[10px] font-bold">
                    <div className="flex items-center gap-1.5 truncate mr-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length] }} />
                      <span className="text-slate-700 dark:text-slate-355 truncate">{member.name.split('/')[0]}</span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400">{member.total} งาน ({Math.round(member.total / (memberData.reduce((sum, m) => sum + m.total, 0) || 1) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* รายชื่อการ์ดพนักงานในแผนก */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {memberData.map((member) => (
                <div
                  key={member.name}
                  onClick={() => setSelectedMember(member.name)}
                  className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                >
                  <div className="p-4 flex items-center gap-3">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-md flex-shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                        <UserDisplay name={member.name} telegramId={member.telegram_id} size="sm" />
                      </h4>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                        ความสำเร็จเฉลี่ย: {member.avgProgress}% ({member.done}/{member.total} งาน)
                      </p>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <div className="w-full bg-slate-150 dark:bg-slate-700 rounded-full h-1.5 mb-3">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${member.avgProgress}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-extrabold text-slate-500 dark:text-slate-400">
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-1 rounded">
                        <div>{member.todo}</div>
                        <div className="text-[7px] text-slate-400 mt-0.5">To Do</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-1 rounded text-blue-600 dark:text-blue-400">
                        <div>{member.in_progress}</div>
                        <div className="text-[7px] text-blue-500/70 mt-0.5">Doing</div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/20 p-1 rounded text-amber-600 dark:text-amber-400">
                        <div>{member.review}</div>
                        <div className="text-[7px] text-amber-500/70 mt-0.5">Review</div>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-1 rounded text-emerald-600 dark:text-emerald-400">
                        <div>{member.done}</div>
                        <div className="text-[7px] text-emerald-500/70 mt-0.5">Done</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // ==========================================
        // LEVEL 3: งานของพนักงานที่เจาะลึกเข้ามา
        // ==========================================
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedMember(null)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-extrabold border-2 border-slate-200 dark:border-slate-650 transition-colors shadow-sm"
            >
              ⬅️ กลับสู่รายชื่อพนักงาน
            </button>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              งานของ: <span className="text-blue-600 dark:text-blue-400">{selectedMember.split('/')[0]}</span>
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 ml-2">({selectedDept} Department)</span>
            </h2>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/20 rounded-xl p-3 border-2 border-slate-100 dark:border-slate-800/80 space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">ไม่พบงานที่รับผิดชอบอยู่ขณะนี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserName={currentUserName}
                    users={users}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
