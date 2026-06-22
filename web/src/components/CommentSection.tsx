'use client';

import { useState, useEffect } from 'react';
import type { TaskComment, User } from '@/types';
import { api } from '@/lib/api';
import { formatUserDisplayName } from '@/lib/auth';
import UserDisplay from './UserDisplay';

interface CommentSectionProps {
  taskId: string;
  currentUserName: string;
  users?: User[];
  comments?: TaskComment[];
  onCommentAdded?: (comment: TaskComment) => void;
}

export default function CommentSection({ 
  taskId, 
  currentUserName, 
  users = [], 
  comments: propComments, 
  onCommentAdded 
}: CommentSectionProps) {
  const [localComments, setLocalComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState(currentUserName);

  const comments = propComments !== undefined ? propComments : localComments;

  useEffect(() => {
    setUsername(currentUserName);
  }, [currentUserName]);

  useEffect(() => {
    if (propComments === undefined) {
      loadComments();
    } else {
      setLoading(false);
    }
  }, [taskId, propComments]);

  const loadComments = async () => {
    try {
      const data = await api.getComments(taskId);
      setLocalComments(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const comment = await api.createComment(taskId, username || 'Anonymous', newComment.trim());
      if (onCommentAdded) {
        onCommentAdded(comment);
      } else {
        setLocalComments((prev) => [...prev, comment]);
      }
      setNewComment('');
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50/30 dark:bg-slate-800/30">
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
        <span>💬</span> Comments ({comments.length})
      </h3>

      {/* Username */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">Name:</label>
        <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
          <UserDisplay name={username} />
        </span>
      </div>

      {/* Comment Input */}
      <div className="mb-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Sending...' : 'Comment'}
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
              <div className="h-4 w-full bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => {
            let displayName = comment.user;
            if (users && users.length > 0) {
              const u = users.find(x => {
                const formatted = formatUserDisplayName(x);
                if (comment.user === formatted) return true;
                if (comment.user === x.first_name || comment.user === x.username || comment.user === x.id || comment.user === x.email) return true;
                
                // Check if the comment.user contains first_name in parenthesis like "(first_name)"
                if (x.first_name && comment.user.includes(`(${x.first_name})`)) return true;
                if (x.username && comment.user.includes(`(${x.username})`)) return true;
                
                // Check if comment.user starts with nickname
                if (x.nickname && comment.user.startsWith(x.nickname)) return true;

                // Check if comment.user contains the first name as a word
                const cleanedCommentUser = comment.user.toLowerCase();
                if (x.first_name && cleanedCommentUser.includes(x.first_name.toLowerCase())) return true;
                if (x.username && cleanedCommentUser.includes(x.username.toLowerCase())) return true;
                
                return false;
              });
              if (u) {
                displayName = formatUserDisplayName(u);
              }
            }
            return (
              <div
                key={comment.id}
                className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <UserDisplay name={displayName} size="sm" />
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString('th-TH', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {comment.message}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
