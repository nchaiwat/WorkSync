'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Task, User, TaskComment } from '@/types';
import { STATUS_CONFIG } from '@/types';
import { api } from '@/lib/api';
import { formatUserDisplayName } from '@/lib/auth';
import CommentSection from './CommentSection';
import UserDisplay from './UserDisplay';

interface TaskDetailProps {
  task: Task;
  onUpdate: (task: Task) => void;
  canEdit?: boolean;
  isCreator?: boolean;
  currentUserName: string;
  currentUser?: {
    id: string;
    username: string;
    first_name: string;
    role: string;
    formattedName: string;
    nickname?: string;
    department?: string;
  } | null;
  onDelete?: (taskId: string, reason: string) => void;
  onArchive?: (taskId: string, reason: string) => void;
  users?: User[];
}

interface ParsedUpdate {
  key: string;
  timestamp: string;
  content: string;
  raw: string;
  attachment?: {
    url: string;
    name: string;
  };
}

function parseTaskUpdates(latestUpdateText: string | null | undefined): ParsedUpdate[] {
  if (!latestUpdateText) return [];
  const sections = latestUpdateText.split(/---\r?\n|---/g);
  return sections
    .map(sec => sec.trim())
    .filter(Boolean)
    .map(sec => {
      const tsMatch = sec.match(/^\[([^\]]+)\]/);
      if (tsMatch) {
        const fullContent = sec.slice(tsMatch[0].length).trim();
        const attachMatch = fullContent.match(/\[attachment:([^|\]]+)\|name:([^\]]+)\]/);
        let content = fullContent;
        let attachment;
        if (attachMatch) {
          content = fullContent.replace(attachMatch[0], '').trim();
          attachment = {
            url: attachMatch[1],
            name: attachMatch[2],
          };
        }
        return {
          key: tsMatch[0], // e.g. "[11 มิ.ย. 2569 08:30]"
          timestamp: tsMatch[1],
          content: content,
          raw: sec,
          attachment,
        };
      }

      const attachMatch = sec.match(/\[attachment:([^|\]]+)\|name:([^\]]+)\]/);
      let content = sec;
      let attachment;
      if (attachMatch) {
        content = sec.replace(attachMatch[0], '').trim();
        attachment = {
          url: attachMatch[1],
          name: attachMatch[2],
        };
      }
      return {
        key: sec,
        timestamp: 'อัปเดตงาน',
        content: content,
        raw: sec,
        attachment,
      };
    });
}

export default function TaskDetail({ task, onUpdate, canEdit = true, isCreator = false, currentUserName, currentUser, onDelete, onArchive, users = [] }: TaskDetailProps) {
  const statusConfig = STATUS_CONFIG[task.status];
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editProgress, setEditProgress] = useState(task.progress);
  const [editStatus, setEditStatus] = useState(task.status);
  const [editManager, setEditManager] = useState(task.manager || '');
  const [editCollaborators, setEditCollaborators] = useState<string[]>(task.collaborators || []);
  const [editProjectOwner, setEditProjectOwner] = useState(task.project_owner || '');
  const [newUpdateText, setNewUpdateText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Modal / Preview States
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [reasonModal, setReasonModal] = useState<{ isOpen: boolean; actionType: 'delete' | 'archive'; reason: string }>({
    isOpen: false,
    actionType: 'archive',
    reason: '',
  });

  // Comments & Replies States
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [isSubmittingReply, setIsSubmittingReply] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadComments();
  }, [task.id]);

  const [isTogglingLike, setIsTogglingLike] = useState(false);

  const isCurrentUserInvolved = useMemo(() => {
    if (!currentUser) return false;
    
    const nameToMatch = currentUser.first_name || currentUser.username;
    const displayNameToMatch = currentUser.formattedName;
    const idToMatch = currentUser.id;

    // Match assignee
    const matchesAssignee = 
      task.assignee === displayNameToMatch ||
      task.assignee === nameToMatch ||
      task.assignee === idToMatch ||
      (currentUser.first_name && task.assignee?.includes(`(${currentUser.first_name})`)) ||
      (currentUser.username && task.assignee?.includes(`(${currentUser.username})`));

    // Match manager
    const matchesManager = 
      task.manager === displayNameToMatch ||
      task.manager === nameToMatch ||
      task.manager === idToMatch ||
      (task.manager && (
        (currentUser.first_name && task.manager.includes(`(${currentUser.first_name})`)) ||
        (currentUser.username && task.manager.includes(`(${currentUser.username})`))
      ));

    // Match collaborators
    const matchesCollaborators = (task.collaborators || []).some(collab => 
      collab === displayNameToMatch ||
      collab === nameToMatch ||
      collab === idToMatch ||
      (currentUser.first_name && collab.includes(`(${currentUser.first_name})`)) ||
      (currentUser.username && collab.includes(`(${currentUser.username})`))
    );

    return matchesAssignee || matchesManager || matchesCollaborators;
  }, [task, currentUser]);

  const getUpdateLikes = (updateKey: string) => {
    if (!task.likes) return [];
    return task.likes.filter(like => like.target_type === 'update' && like.target_id === updateKey);
  };

  const hasLikedUpdate = (updateKey: string) => {
    if (!currentUser) return false;
    return getUpdateLikes(updateKey).some(like => like.user_id === currentUser.id);
  };

  const getCommentLikes = (commentId: string) => {
    if (!task.likes) return [];
    return task.likes.filter(like => like.target_type === 'comment' && like.target_id === commentId);
  };

  const hasLikedComment = (commentId: string) => {
    if (!currentUser) return false;
    return getCommentLikes(commentId).some(like => like.user_id === currentUser.id);
  };

  const handleToggleLike = async (targetType: string, targetId: string) => {
    if (!currentUser) return;
    setIsTogglingLike(true);
    try {
      const updated = await api.toggleTaskLike(task.id, targetType, targetId);
      onUpdate(updated);
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถดำเนินการได้');
    } finally {
      setIsTogglingLike(false);
    }
  };

  useEffect(() => {
    if (!isEditing && task && users.length > 0) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setEditProgress(task.progress);
      setEditStatus(task.status);
      setEditProjectOwner(task.project_owner || '');

      // Resolve manager
      const mgrUser = users.find(u => 
        formatUserDisplayName(u) === task.manager ||
        u.first_name === task.manager ||
        u.username === task.manager ||
        (u.first_name && task.manager?.includes(`(${u.first_name})`)) ||
        (u.username && task.manager?.includes(`(${u.username})`))
      );
      setEditManager(mgrUser ? (mgrUser.first_name || mgrUser.username) : '');

      // Resolve collaborators
      const collabNames = (task.collaborators || []).map(collab => {
        const colUser = users.find(u =>
          formatUserDisplayName(u) === collab ||
          u.first_name === collab ||
          u.username === collab ||
          (u.first_name && collab.includes(`(${u.first_name})`)) ||
          (u.username && collab.includes(`(${u.username})`))
        );
        return colUser ? (colUser.first_name || colUser.username) : collab;
      });
      setEditCollaborators(collabNames);
    }
  }, [task, users, isEditing]);

  const loadComments = async () => {
    try {
      const data = await api.getComments(task.id);
      setComments(data);
    } catch {
      // Fail silently
    }
  };

  const progressColor =
    task.progress === 100
      ? 'bg-green-500'
      : task.progress >= 70
        ? 'bg-blue-500'
        : task.progress >= 30
          ? 'bg-yellow-500'
          : 'bg-red-500';

  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const isOverdue = deadlineDate ? deadlineDate < new Date() && task.status !== 'done' : false;
  const isDone = task.status === 'done';
  const deadlineDiff = (() => {
    if (!deadlineDate) return null;
    const now = new Date();
    const d1 = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
    
    if (isDone) {
      return { text: 'เสร็จสิ้น', colorClass: 'text-emerald-600 dark:text-emerald-400 font-semibold' };
    }
    
    if (diffDays > 0) {
      return { text: `อีก ${diffDays} วัน`, colorClass: 'text-gray-500 dark:text-gray-400' };
    } else if (diffDays === 0) {
      return { text: 'ครบกำหนดวันนี้', colorClass: 'text-amber-600 dark:text-amber-400 font-bold' };
    } else {
      return { text: `เกินกำหนด ${Math.abs(diffDays)} วัน`, colorClass: 'text-red-500 dark:text-red-400 font-bold' };
    }
  })();

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    setError('');
    try {
      // Format manager and collaborators back to display names
      let formattedManager = '';
      if (editManager) {
        const m = users.find(u => u.first_name === editManager || u.username === editManager);
        if (m) formattedManager = formatUserDisplayName(m);
      }

      const formattedColleagues = editCollaborators.map(colName => {
        const c = users.find(u => u.first_name === colName || u.username === colName);
        return c ? formatUserDisplayName(c) : colName;
      });

      const updated = await api.updateTask(task.id, {
        title: editTitle,
        description: editDescription,
        progress: editProgress,
        status: editStatus,
        manager: formattedManager || null,
        collaborators: formattedColleagues,
        project_owner: editProjectOwner || undefined,
      });
      onUpdate(updated);
      setIsEditing(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };



  const handleSaveLatestUpdate = async () => {
    if (!newUpdateText.trim()) return;
    setIsSaving(true);
    try {
      let attachmentText = '';
      if (selectedFile) {
        const uploadRes = await api.uploadTaskFile(task.id, selectedFile);
        attachmentText = `\n[attachment:${uploadRes.url}|name:${uploadRes.filename}]`;
      }
      const timestamp = new Date().toLocaleString('th-TH', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
      const appendedUpdate = `[${timestamp}] ${newUpdateText.trim()}${attachmentText}\n${task.latest_update ? '---\n' + task.latest_update : ''}`;
      
      const updated = await api.updateTask(task.id, { latest_update: appendedUpdate });
      onUpdate(updated);
      setNewUpdateText(''); // clear input
      setSelectedFile(null); // clear file selection
    } catch (err: any) {
      alert(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUpdateReply = async (updateKey: string) => {
    const text = replyText[updateKey];
    if (!text?.trim()) return;
    
    setIsSubmittingReply(prev => ({ ...prev, [updateKey]: true }));
    try {
      const isGeneral = updateKey === '__general__';
      const keyToSend = isGeneral ? undefined : updateKey;
      const newComment = await api.createComment(task.id, currentUserName, text.trim(), keyToSend);
      setComments(prev => [...prev, newComment]);
      setReplyText(prev => ({ ...prev, [updateKey]: '' }));
    } catch {
      alert('ตอบกลับไม่สำเร็จ');
    } finally {
      setIsSubmittingReply(prev => ({ ...prev, [updateKey]: false }));
    }
  };

  const getUserDisplayName = (nameOrId: string) => {
    if (!nameOrId) return '-';
    const user = users.find(u => {
      if (u.id === nameOrId || u.username === nameOrId || u.first_name === nameOrId) return true;
      if (formatUserDisplayName(u) === nameOrId) return true;
      if (u.first_name && nameOrId.includes(`(${u.first_name})`)) return true;
      if (u.username && nameOrId.includes(`(${u.username})`)) return true;
      return false;
    });
    if (user) {
      return formatUserDisplayName(user);
    }
    return nameOrId;
  };

  const getUserTelegramId = (nameOrId: string) => {
    if (!nameOrId) return undefined;
    const user = users.find(u => {
      if (u.id === nameOrId || u.username === nameOrId || u.first_name === nameOrId) return true;
      if (formatUserDisplayName(u) === nameOrId) return true;
      if (u.first_name && nameOrId.includes(`(${u.first_name})`)) return true;
      if (u.username && nameOrId.includes(`(${u.username})`)) return true;
      return false;
    });
    return user?.telegram_id || undefined;
  };

  // ── Position-hierarchy helpers (mirror of new task page) ──
  const getPositionRank = (position?: string): number => {
    const pos = (position || '').toLowerCase().trim();
    if (pos === 'staff') return 1;
    if (pos === 'supervisor') return 2;
    if (pos === 'manager') return 3;
    if (pos === 'c-level' || pos === 'c level') return 4;
    if (pos === 'ceo') return 5;
    return 1;
  };

  // Assignee's department + position (looked up from users prop)
  const assigneeMeta = useMemo(() => {
    const assigneeName = task.assignee;
    const u = users.find(x => 
      formatUserDisplayName(x) === assigneeName ||
      x.first_name === assigneeName ||
      x.username === assigneeName ||
      (x.first_name && assigneeName?.includes(`(${x.first_name})`)) ||
      (x.username && assigneeName?.includes(`(${x.username})`))
    );
    return { dept: u?.department || '', position: u?.position || '' };
  }, [users, task.assignee]);

  const isAllowedManager = (managerPosition?: string): boolean => {
    const userRank = getPositionRank(assigneeMeta.position);
    const mgrRank = getPositionRank(managerPosition);
    if (userRank <= 2) return mgrRank >= 2;
    if (userRank === 3) return mgrRank >= 3;
    return mgrRank >= 5;
  };

  const editCandidateManagers = useMemo(() => {
    const valid = users.filter(u => isAllowedManager(u.position));
    if (!assigneeMeta.dept) return { sameDept: valid, otherDept: [] };
    return {
      sameDept: valid.filter(u => u.department === assigneeMeta.dept),
      otherDept: valid.filter(u => u.department !== assigneeMeta.dept),
    };
  }, [users, assigneeMeta]);

  const editCandidateColleagues = useMemo(() => {
    const valid = users.filter(u => (u.position || '').toLowerCase().trim() !== 'ceo');
    if (!assigneeMeta.dept) return { sameDept: valid, otherDept: [] };
    return {
      sameDept: valid.filter(u => u.department === assigneeMeta.dept),
      otherDept: valid.filter(u => u.department !== assigneeMeta.dept),
    };
  }, [users, assigneeMeta]);

  const statusHeaderBorders = {
    todo: 'border-t-slate-400 dark:border-t-slate-500',
    in_progress: 'border-t-blue-500 dark:border-t-blue-400',
    review: 'border-t-amber-500 dark:border-t-amber-400',
    done: 'border-t-emerald-500 dark:border-t-emerald-400',
  };
  const statusHeaderBorder = statusHeaderBorders[task.status] || 'border-t-slate-400';

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-300 dark:border-slate-700 overflow-hidden shadow-md border-t-8 ${statusHeaderBorder}`}>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {isEditing && canEdit ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-primary-500 focus:outline-none pb-1"
              />
            ) : (
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {task.title}
              </h1>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className={`text-xs px-3 py-1 rounded-lg font-bold border shadow-sm ${statusConfig.bgColor} ${statusConfig.color} ${
                task.status === 'todo' ? 'border-gray-200 dark:border-gray-700' :
                task.status === 'in_progress' ? 'border-blue-200 dark:border-blue-850' :
                task.status === 'review' ? 'border-amber-250 dark:border-amber-800' :
                'border-emerald-250 dark:border-emerald-800'
              }`}>
                {statusConfig.label}
              </span>
              {isOverdue && (
                <span className="text-sm px-3 py-1 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 font-medium">
                  ⚠️ Overdue
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canEdit && (
              <button
                onClick={() => {
                  if (!isEditing) {
                    setEditTitle(task.title);
                    setEditDescription(task.description || '');
                    setEditProgress(task.progress);
                    setEditStatus(task.status);
                    setEditProjectOwner(task.project_owner || '');
                    
                    const mgrUser = users.find(u => 
                      formatUserDisplayName(u) === task.manager ||
                      u.first_name === task.manager ||
                      u.username === task.manager ||
                      (u.first_name && task.manager?.includes(`(${u.first_name})`)) ||
                      (u.username && task.manager?.includes(`(${u.username})`))
                    );
                    setEditManager(mgrUser ? (mgrUser.first_name || mgrUser.username) : '');

                    const collabNames = (task.collaborators || []).map(collab => {
                      const colUser = users.find(u =>
                        formatUserDisplayName(u) === collab ||
                        u.first_name === collab ||
                        u.username === collab ||
                        (u.first_name && collab.includes(`(${u.first_name})`)) ||
                        (u.username && collab.includes(`(${u.username})`))
                      );
                      return colUser ? (colUser.first_name || colUser.username) : collab;
                    });
                    setEditCollaborators(collabNames);
                  }
                  setIsEditing(!isEditing);
                  setError('');
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                {isEditing ? '✕' : '✏️'}
              </button>
            )}
            
             {task.status === 'done' && (canEdit || isCreator) && onArchive && (
               <button
                 onClick={() => {
                   setReasonModal({ isOpen: true, actionType: 'archive', reason: '' });
                 }}
                 className="p-2 rounded-lg text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                 title="เก็บถาวรงานนี้ (Archive)"
               >
                 📦
               </button>
             )}
             
             {(canEdit || isCreator) && onDelete && (
               <button
                 onClick={() => {
                   setReasonModal({ isOpen: true, actionType: 'delete', reason: '' });
                 }}
                 className="p-2 rounded-lg text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                 title="ลบงานนี้"
               >
                 🗑️
               </button>
             )}
          </div>
        </div>

        {/* Description - Spans full width */}
        {task.description && !isEditing && (
          <div className="mt-4 p-3.5 bg-slate-100/50 dark:bg-slate-900/60 rounded-xl border-2 border-slate-250 dark:border-slate-700/60 shadow-inner">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Description
            </p>
            <p className="text-sm text-slate-750 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{task.description}</p>
          </div>
        )}
      </div>

      {/* Progress Section */}
      <div className="p-4 sm:p-6 border-b-2 border-slate-200 dark:border-slate-700/80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 tracking-wide">
            Progress
          </h3>
          <div className="flex items-baseline gap-2">
            {task.previous_progress !== undefined && task.progress !== task.previous_progress && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                task.progress > task.previous_progress 
                  ? 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50' 
                  : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50'
              }`}>
                {task.progress > task.previous_progress ? '+' : ''}{task.progress - task.previous_progress}%
              </span>
            )}
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{task.progress}%</span>
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-4">
          <div
            className={`progress-bar-fill h-4 rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      {/* Edit Form */}
      {isEditing && canEdit && (
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              Project Owner
            </label>
            <input
              type="text"
              list="edit-project-owners"
              value={editProjectOwner}
              onChange={(e) => setEditProjectOwner(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
              placeholder="เช่น Phatta/AC"
            />
            <datalist id="edit-project-owners">
              {users.map(u => {
                const displayName = formatUserDisplayName(u);
                const hint = `${u.first_name} ${u.last_name} (@${u.username})${u.department ? ` — ${u.department}` : ''}${u.position ? ` (${u.position})` : ''}`;
                return (
                  <option key={u.id} value={displayName}>
                    {hint}
                  </option>
                );
              })}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              Progress
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={editProgress}
                onChange={(e) => setEditProgress(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-500 focus:outline-none"
              />
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 w-12 text-right">
                {editProgress}%
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              Status
            </label>
            <div className="flex gap-2">
              {(['todo', 'in_progress', 'review', 'done'] as const).map((status) => {
                const active = editStatus === status;
                const config = STATUS_CONFIG[status];
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setEditStatus(status)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${
                      active
                        ? `${config.bgColor} ${config.color} border-primary-500 shadow-sm`
                        : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                    }`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manager — same UI as new task form */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              Manager
            </label>
            <select
              value={editManager}
              onChange={(e) => setEditManager(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
            >
              <option value="">— ไม่ระบุ Manager —</option>
              {editCandidateManagers.sameDept.map(u => (
                <option key={u.id} value={u.first_name || u.username}>
                  {u.first_name} {u.last_name} (@{u.username})
                  {u.department ? ` — ${u.department}` : ''}
                  {u.position ? ` (${u.position})` : ''}
                </option>
              ))}
              {editCandidateManagers.sameDept.length > 0 && editCandidateManagers.otherDept.length > 0 && (
                <option disabled>── คนแผนกอื่น ──</option>
              )}
              {editCandidateManagers.otherDept.map(u => (
                <option key={u.id} value={u.first_name || u.username}>
                  {u.first_name} {u.last_name} (@{u.username})
                  {u.department ? ` — ${u.department}` : ''}
                  {u.position ? ` (${u.position})` : ''}
                </option>
              ))}
            </select>
            {assigneeMeta.dept && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                แสดงเฉพาะคนในแผนก {assigneeMeta.dept} ก่อน
              </p>
            )}
          </div>

          {/* Collaborators — same UI as new task form */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
              เพื่อนร่วมงาน (Colleagues)
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700">
              {editCandidateColleagues.sameDept.map(u => {
                const name = u.first_name || u.username || '';
                const checked = editCollaborators.includes(name);
                return (
                  <label key={u.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-600/30 rounded px-1 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setEditCollaborators(prev => checked ? prev.filter(c => c !== name) : [...prev, name])}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {u.first_name} {u.last_name} (@{u.username})
                      {u.position && <span className="text-xs text-gray-500"> — {u.position}</span>}
                    </span>
                  </label>
                );
              })}
              {editCandidateColleagues.sameDept.length > 0 && editCandidateColleagues.otherDept.length > 0 && (
                <div className="border-t border-dashed border-gray-300 dark:border-slate-600 my-2 pt-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  คนแผนกอื่น
                </div>
              )}
              {editCandidateColleagues.otherDept.map(u => {
                const name = u.first_name || u.username || '';
                const checked = editCollaborators.includes(name);
                return (
                  <label key={u.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-600/30 rounded px-1 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setEditCollaborators(prev => checked ? prev.filter(c => c !== name) : [...prev, name])}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">
                      {u.first_name} {u.last_name} (@{u.username})
                      {u.department && <span className="text-xs text-gray-400"> ({u.department})</span>}
                      {u.position && <span className="text-xs text-gray-500"> — {u.position}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div className="p-4 sm:p-6 border-b-2 border-slate-250 dark:border-slate-700/65 bg-slate-50/40 dark:bg-slate-900/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          {/* Assignee */}
          <div className="flex items-center justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">
              Assignee
            </span>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right min-w-0">
              <UserDisplay name={getUserDisplayName(task.assignee)} telegramId={getUserTelegramId(task.assignee)} />
            </div>
          </div>

          {/* Manager */}
          <div className="flex items-center justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">
              Manager
            </span>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right min-w-0">
              <UserDisplay name={getUserDisplayName(task.manager || '')} telegramId={getUserTelegramId(task.manager || '')} />
            </div>
          </div>

          {/* Project Owner */}
          <div className="flex items-center justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">
              Project Owner
            </span>
            <div className="text-right">
              <span className="text-sm font-bold text-indigo-650 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-lg border border-indigo-100/65 dark:border-indigo-900/40 inline-block shadow-sm">
                📂 {task.project_owner || '—'}
              </span>
            </div>
          </div>

          {/* Deadline */}
          <div className="flex items-center justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">
              Deadline
            </span>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center justify-end gap-1.5 flex-wrap">
              <span>{deadlineDate ? deadlineDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</span>
              {deadlineDiff && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  isDone ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30' :
                  deadlineDiff.text.includes('เกินกำหนด') ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30' :
                  deadlineDiff.text.includes('วันนี้') ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30' :
                  'bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600'
                } ${deadlineDiff.colorClass}`}>
                  {deadlineDiff.text}
                </span>
              )}
            </div>
          </div>

          {/* Created By */}
          <div className="flex items-center justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">
              Created By
            </span>
            <div className="text-right flex flex-col items-end min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1 justify-end">
                <UserDisplay name={getUserDisplayName(task.created_by_name || task.creator_id || '')} telegramId={getUserTelegramId(task.created_by_name || task.creator_id || '')} />
                {isCreator && <span className="text-[10px] text-gray-500 font-normal flex-shrink-0">(คุณ)</span>}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                {new Date(task.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Collaborators */}
          {task.collaborators && task.collaborators.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-200/60 dark:border-slate-700/60 col-span-1 sm:col-span-2 gap-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">
                Collaborators
              </span>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {task.collaborators.map((c, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    <UserDisplay name={getUserDisplayName(c)} size="sm" telegramId={getUserTelegramId(c)} />
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>



      {/* Task Update Section — always visible */}
      <div className="p-4 sm:p-6 border-b-2 border-blue-300 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/20 border-l-4 border-l-blue-600 dark:border-l-blue-500">
        <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-4 flex items-center gap-2">
          <span>📝</span> Task Update
        </h3>

        {isCreator && (
          <div className="space-y-3 mb-6">
            <textarea
              value={newUpdateText}
              onChange={(e) => setNewUpdateText(e.target.value)}
              placeholder="เพิ่มอัปเดตล่าสุดที่นี่ (ข้อมูลจะถูกบันทึกและเรียงต่อจากของเดิม)..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-blue-300 dark:border-blue-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm shadow-sm"
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-350 dark:border-slate-600 rounded-xl cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm select-none">
                <span>📎</span> แนบไฟล์ (เอกสาร/รูปภาพ ไม่เกิน 10MB)
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        alert('ขนาดไฟล์ต้องไม่เกิน 10MB');
                        e.target.value = '';
                        return;
                      }
                      setSelectedFile(file);
                    }
                  }}
                />
              </label>
              {selectedFile && (
                <div className="flex items-center gap-2 bg-blue-100/50 dark:bg-slate-750 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-slate-650 text-xs font-medium text-blue-800 dark:text-slate-200 shadow-inner animate-in fade-in slide-in-from-left-2 duration-150">
                  <span className="truncate max-w-[200px]">📄 {selectedFile.name}</span>
                  <span className="text-[10px] text-gray-500">({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-red-500 hover:text-red-700 font-bold ml-1 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleSaveLatestUpdate}
              disabled={isSaving || !newUpdateText.trim()}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              {isSaving ? 'กำลังบันทึก...' : 'บันทึกอัปเดตงาน'}
            </button>
          </div>
        )}

        {task.latest_update ? (
          <div className="space-y-4">
            <span className="font-bold text-blue-900 dark:text-blue-200 text-sm">ประวัติการอัปเดตงาน (Update History):</span>
            {parseTaskUpdates(task.latest_update).map((update, idx) => {
              // For the first update, also include comments with no update_key (general comments)
              const commentsForUpdate = comments.filter(c =>
                c.update_key === update.key || (idx === 0 && !c.update_key)
              );
              return (
                <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 border-l-4 border-l-blue-600 dark:border-l-blue-400 shadow-md space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <span>👤 เจ้าของงาน</span>
                    <span>🕒 {update.timestamp}</span>
                  </div>
                  <div className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                    {update.content}
                    {isCurrentUserInvolved && (
                      <>
                        {' '}
                        <button
                          onClick={() => { if (!hasLikedUpdate(update.key)) handleToggleLike('update', update.key); }}
                          disabled={isTogglingLike}
                          className="inline-flex items-center justify-center p-0 bg-transparent hover:scale-110 active:scale-90 transition-transform select-none align-middle"
                          title="กดไลค์ (อ่านแล้ว)"
                        >
                          👍
                        </button>
                      </>
                    )}
                  </div>
                   {update.attachment && (() => {
                     const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(update.attachment.name || '');
                     return (
                       <div className="mt-2 pt-1 flex flex-wrap gap-2">
                         <a
                           href={update.attachment.url}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors shadow-sm max-w-full"
                         >
                           <span>📎 ไฟล์แนบ:</span>
                           <span className="truncate max-w-[200px]">{update.attachment.name}</span>
                         </a>
                         {isImage && (
                           <button
                             type="button"
                             onClick={() => setPreviewImage({ url: update.attachment.url, name: update.attachment.name })}
                             className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/80 rounded-xl border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors shadow-sm"
                           >
                             <span>👁️ ดูรูปภาพ</span>
                           </button>
                         )}
                       </div>
                     );
                   })()}

                   {getUpdateLikes(update.key).length > 0 && (
                     <div className="flex items-center gap-1.5 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                       <span className="text-blue-500">👍</span>
                       <span className="font-semibold text-slate-655 dark:text-slate-355">อ่านแล้ว:</span>
                       <span className="font-medium text-slate-700 dark:text-slate-300">
                         {getUpdateLikes(update.key).map(like => {
                           const name = getUserDisplayName(like.formatted_name || like.nickname || like.first_name || like.username);
                           return name.split('/')[0];
                         }).join(', ')}
                       </span>
                     </div>
                   )}

                  <div className="pt-2 border-t border-gray-100 dark:border-slate-700 space-y-2">
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400">ความคิดเห็นต่ออัปเดตนี้ ({commentsForUpdate.length})</div>
                    {commentsForUpdate.map(c => {
                      const commentLikes = getCommentLikes(c.id);
                      return (
                        <div key={c.id} className="text-xs bg-gray-50 dark:bg-slate-700/50 p-2.5 rounded-lg border border-gray-100 dark:border-slate-700 space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            <UserDisplay name={getUserDisplayName(c.user)} size="sm" telegramId={getUserTelegramId(c.user)} />
                            <span className="text-gray-400 font-normal">
                              {new Date(c.created_at).toLocaleDateString('th-TH', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                            {c.message}
                            {isCurrentUserInvolved && (
                              <>
                                {' '}
                                <button
                                  onClick={() => { if (!hasLikedComment(c.id)) handleToggleLike('comment', c.id); }}
                                  disabled={isTogglingLike}
                                  className="inline-flex items-center justify-center p-0 bg-transparent hover:scale-110 active:scale-90 transition-transform select-none align-middle"
                                  title="กดไลค์ (อ่านแล้ว)"
                                >
                                  👍
                                </button>
                              </>
                            )}
                          </p>

                          {commentLikes.length > 0 && (
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-600 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="text-blue-500">👍</span>
                              <span className="font-semibold text-slate-655 dark:text-slate-355">อ่านแล้ว:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {commentLikes.map(like => {
                                  const name = getUserDisplayName(like.formatted_name || like.nickname || like.first_name || like.username);
                                  return name.split('/')[0];
                                }).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="พิมพ์ความคิดเห็นตอบกลับอัปเดตนี้..."
                        value={replyText[update.key] || ''}
                        onChange={(e) => setReplyText(prev => ({ ...prev, [update.key]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddUpdateReply(update.key); } }}
                        className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleAddUpdateReply(update.key)}
                        disabled={!replyText[update.key]?.trim() || isSubmittingReply[update.key]}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        {isSubmittingReply[update.key] ? 'กำลังส่ง...' : 'ตอบกลับ'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* No Task Updates yet — show a general comment box for everyone */
          <div className="space-y-3">
            <p className="text-xs text-blue-700 dark:text-blue-300 italic">
              {isCreator
                ? 'ยังไม่มีอัปเดตงาน — เพิ่มอัปเดตแรกด้านบน'
                : 'ยังไม่มีอัปเดตงานจากเจ้าของงานเลย'}
            </p>
            
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-slate-700 pb-1">
              ความคิดเห็น ({comments.filter(c => !c.update_key).length})
            </div>

            {/* General comments (will appear under first update once it exists) */}
            {comments.filter(c => !c.update_key).map(c => {
              const commentLikes = getCommentLikes(c.id);
              return (
                <div key={c.id} className="text-xs bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    <UserDisplay name={getUserDisplayName(c.user)} size="sm" telegramId={getUserTelegramId(c.user)} />
                    <span className="text-gray-400 font-normal">
                      {new Date(c.created_at).toLocaleDateString('th-TH', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {c.message}
                    {isCurrentUserInvolved && (
                      <>
                        {' '}
                        <button
                          onClick={() => { if (!hasLikedComment(c.id)) handleToggleLike('comment', c.id); }}
                          disabled={isTogglingLike}
                          className="inline-flex items-center justify-center p-0 bg-transparent hover:scale-110 active:scale-90 transition-transform select-none align-middle"
                          title="กดไลค์ (อ่านแล้ว)"
                        >
                          👍
                        </button>
                      </>
                    )}
                  </p>

                  {commentLikes.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-750 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="text-blue-500">👍</span>
                      <span className="font-semibold text-slate-655 dark:text-slate-355">อ่านแล้ว:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {commentLikes.map(like => {
                          const name = getUserDisplayName(like.formatted_name || like.nickname || like.first_name || like.username);
                          return name.split('/')[0];
                        }).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="แสดงความคิดเห็น..."
                value={replyText['__general__'] || ''}
                onChange={(e) => setReplyText(prev => ({ ...prev, '__general__': e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddUpdateReply('__general__'); } }}
                className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleAddUpdateReply('__general__')}
                disabled={!replyText['__general__']?.trim() || isSubmittingReply['__general__']}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {isSubmittingReply['__general__'] ? 'กำลังส่ง...' : 'ตอบกลับ'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal ป้อนเหตุผลก่อน ลบ หรือ เก็บถาวร (Delete/Archive Reason Modal) */}
      {reasonModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-2xl p-6 w-full max-w-md space-y-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {reasonModal.actionType === 'archive' ? '📦 ยืนยันการเก็บถาวรงาน' : '🗑️ ยืนยันการลบงาน'}
            </h3>
            <p className="text-xs text-gray-505 dark:text-gray-400">
              {reasonModal.actionType === 'archive' 
                ? 'กรุณากรอกเหตุผลเพื่อบันทึกและส่งแจ้งเตือน Telegram ไปยังทีมงานที่เกี่ยวข้อง' 
                : 'การลบจะนำงานนี้ออกจากระบบอย่างถาวร กรุณากรอกเหตุผลและส่งสัญญาณแจ้งทีมงาน'}
            </p>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                เหตุผลประกอบรายการ <span className="text-red-505">*</span>
              </label>
              <textarea
                value={reasonModal.reason}
                onChange={(e) => setReasonModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={reasonModal.actionType === 'archive' ? 'เช่น งานสำเร็จลุล่วง/ปิดโครงการแล้ว' : 'เช่น ป้อนข้อมูลผิด/ยกเลิกแผนงาน'}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-650 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none h-24 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReasonModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!reasonModal.reason.trim()}
                onClick={() => {
                  setReasonModal(prev => ({ ...prev, isOpen: false }));
                  if (reasonModal.actionType === 'archive' && onArchive) {
                    onArchive(task.id, reasonModal.reason.trim());
                  } else if (reasonModal.actionType === 'delete' && onDelete) {
                    onDelete(task.id, reasonModal.reason.trim());
                  }
                }}
                className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${
                  reasonModal.actionType === 'archive' 
                    ? 'bg-amber-600 hover:bg-amber-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                ยืนยันทำรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal ดูรูปภาพขนาดเต็มหน้าจอ (Image Modal Viewer) */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute top-4 left-4 flex gap-4">
            <button
              onClick={() => setPreviewImage(null)}
              className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 shadow-md border border-slate-700 active:scale-95"
            >
              ← กลับ
            </button>
          </div>
          <div className="max-w-4xl max-h-[80vh] flex items-center justify-center mt-12 animate-in zoom-in-95 duration-200">
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl border border-slate-800"
            />
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-400 select-none text-center">
            {previewImage.name}
          </p>
        </div>
      )}
    </div>
  );
}
