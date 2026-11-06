import type { Task, TaskComment, TaskFormData, User } from '@/types';

const getApiBase = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://api:4000';
  }
  return '';
};
const API_BASE = getApiBase();
const PUBLIC_API_BASE = getApiBase();

// ─── Auth Header Helpers ────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const token = cookies['directus_token'];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Helper Functions ───────────────────────────────────────────────

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = getAuthHeaders();
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }

  return res.json();
}

// ─── Task CRUD ──────────────────────────────────────────────────────

export async function getTasks(filters?: {
  status?: string;
  assignee?: string;
  is_archived?: boolean;
  limit?: number;
  offset?: number;
  filter?: Record<string, any>;
}): Promise<{ data: Task[]; total: number }> {
  const params = new URLSearchParams();

  if (filters?.status) {
    params.append('filter[status][_eq]', filters.status);
  }
  if (filters?.assignee) {
    params.append('filter[assignee][_eq]', filters.assignee);
  }
  if (filters?.is_archived !== undefined) {
    params.append('filter[is_archived][_eq]', String(filters.is_archived));
  }
  if (filters?.filter) {
    // Merge complex filter object into params
    const buildFilterParams = (obj: Record<string, any>, prefix: string = 'filter') => {
      for (const [key, value] of Object.entries(obj)) {
        const paramKey = `${prefix}[${key}]`;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          if (key === '_or' || key === '_and') {
            // For _or/_and, append each item separately
            (value as any[]).forEach((item, idx) => {
              for (const [k, v] of Object.entries(item)) {
                params.append(`${paramKey}[${idx}][${k}]`, JSON.stringify(v));
              }
            });
          } else {
            buildFilterParams(value, paramKey);
          }
        } else {
          params.append(paramKey, JSON.stringify(value));
        }
      }
    };
    buildFilterParams(filters.filter);
  }
  params.append('limit', String(filters?.limit || 100));
  params.append('offset', String(filters?.offset || 0));
  params.append('sort', '-created_at');
  params.append('_t', String(Date.now())); // cache-busting

  const url = `${PUBLIC_API_BASE}/items/tasks?${params.toString()}`;
  const result = await fetchJSON<{ data: Task[]; meta: { total: number } }>(url);

  return {
    data: result.data,
    total: result.meta?.total || result.data.length,
  };
}

export async function getTaskById(id: string): Promise<Task> {
  const url = `${PUBLIC_API_BASE}/items/tasks/${id}`;
  const result = await fetchJSON<{ data: Task }>(url);
  return result.data;
}

export async function createTask(data: TaskFormData): Promise<Task> {
  const url = `${API_BASE}/items/tasks`;
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  const currentUserRaw = cookies['directus_first_name'] || cookies['directus_username'] || '';
  const body = { ...data, created_by_name: data.assignee || currentUserRaw };
  const result = await fetchJSON<{ data: Task }>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return result.data;
}

export async function updateTask(id: string, data: Partial<TaskFormData>): Promise<Task> {
  const url = `${API_BASE}/items/tasks/${id}`;
  const result = await fetchJSON<{ data: Task }>(url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateTaskProgress(id: string, progress: number): Promise<Task> {
  return updateTask(id, { progress });
}

export async function deleteTask(id: string, reason: string): Promise<void> {
  const url = `${API_BASE}/items/tasks/${id}`;
  await fetchJSON(url, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}

export async function archiveTask(id: string, reason: string): Promise<Task> {
  const url = `${API_BASE}/items/tasks/${id}`;
  const result = await fetchJSON<{ data: Task }>(url, {
    method: 'PATCH',
    body: JSON.stringify({ is_archived: true, archive_reason: reason }),
  });
  return result.data;
}

// ─── Comments ───────────────────────────────────────────────────────

export async function getComments(taskId: string): Promise<TaskComment[]> {
  const url = `${PUBLIC_API_BASE}/items/task_comments?filter[task][_eq]=${taskId}&sort=created_at`;
  const result = await fetchJSON<{ data: TaskComment[] }>(url);
  return result.data;
}

export async function createComment(taskId: string, user: string, message: string, updateKey?: string): Promise<TaskComment> {
  const url = `${API_BASE}/items/task_comments`;
  const result = await fetchJSON<{ data: TaskComment }>(url, {
    method: 'POST',
    body: JSON.stringify({ task: taskId, user, message, update_key: updateKey }),
  });
  return result.data;
}

export async function deleteComment(id: string): Promise<void> {
  const url = `${API_BASE}/items/task_comments/${id}`;
  await fetchJSON(url, { method: 'DELETE' });
}

// ─── Team Members ───────────────────────────────────────────────────

export async function getTeamMembers(): Promise<string[]> {
  const url = `${PUBLIC_API_BASE}/items/tasks?fields=assignee&limit=1000`;
  const result = await fetchJSON<{ data: Task[] }>(url);
  const members = Array.from(new Set(result.data.map((t) => t.assignee).filter(Boolean)));
  return members.sort();
}

// ─── Users ──────────────────────────────────────────────────────────

/**
 * Fetch all users from Directus (for dropdowns in task creation & admin)
 */
export async function getUsers(): Promise<User[]> {
  const url = `${PUBLIC_API_BASE}/users?fields=id,email,username,first_name,last_name,status,department,position,nickname&limit=500`;
  const result = await fetchJSON<{ data: User[] }>(url);
  return result.data || [];
}

/**
 * Fetch a single user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const url = `${PUBLIC_API_BASE}/users/${id}?fields=id,email,username,first_name,last_name,status`;
  try {
    const result = await fetchJSON<{ data: User }>(url);
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Validate that a user ID exists in the system
 */
export async function validateUserExists(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  return user !== null;
}

// ─── Telegram Notification ──────────────────────────────────────────

export async function sendTelegramNotification(message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('Telegram bot not configured. Skipping notification.');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetchJSON(url, {
    method: 'POST',
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });
}

// ─── Health Check ───────────────────────────────────────────────────

export async function checkDirectusHealth(): Promise<boolean> {
  try {
    const url = `${PUBLIC_API_BASE}/server/health`;
    const result = await fetchJSON<{ status: string }>(url);
    return result.status === 'ok';
  } catch {
    return false;
  }
}

// ─── User Profile Actions ───────────────────────────────────────────

export async function updateUser(userId: string, data: any): Promise<User> {
  const url = `${API_BASE}/users/${userId}`;
  const result = await fetchJSON<{ data: User }>(url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function uploadAvatar(userId: string, file: File): Promise<{ avatar_url: string }> {
  const url = `${API_BASE}/users/${userId}/avatar`;
  const authHeaders = getAuthHeaders();
  const optimizedFile = await compressImage(file, 800, 800, 0.85);
  const formData = new FormData();
  formData.append('avatar', optimizedFile);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`อัปโหลดล้มเหลว: ${errorText}`);
  }

  const result = await res.json();
  return result.data;
}

export async function uploadTaskFile(taskId: string, file: File): Promise<{ url: string; filename: string }> {
  const url = `${API_BASE}/items/tasks/${taskId}/upload`;
  const authHeaders = getAuthHeaders();
  const optimizedFile = await compressImage(file, 1920, 1920, 0.82);
  const formData = new FormData();
  formData.append('file', optimizedFile);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders,
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`อัปโหลดล้มเหลว: ${errorText}`);
  }

  const result = await res.json();
  return result.data;
}

export async function sendAnnouncement(message: string, targetUserIds: string[]): Promise<void> {
  const url = `${API_BASE}/users/announce`;
  await fetchJSON(url, {
    method: 'POST',
    body: JSON.stringify({ message, targetUserIds }),
  });
}

export async function testTelegram(telegramId: string, message: string): Promise<void> {
  const url = `${API_BASE}/admin/telegram/test`;
  await fetchJSON(url, {
    method: 'POST',
    body: JSON.stringify({ telegramId, message }),
  });
}

export async function toggleTaskLike(id: string, targetType: string, targetId: string): Promise<Task> {
  const url = `${API_BASE}/items/tasks/${id}/like`;
  const result = await fetchJSON<{ data: Task }>(url, {
    method: 'POST',
    body: JSON.stringify({ target_type: targetType, target_id: targetId })
  });
  return result.data;
}

export async function markTaskAsRead(id: string): Promise<void> {
  const url = `${API_BASE}/items/tasks/${id}/read`;
  await fetchJSON(url, {
    method: 'POST',
  });
}

// ─── SMTP Config ───────────────────────────────────────────────────

export interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_sender_email: string;
  smtp_password_masked: string;
  smtp_password?: string;
  updated_at?: string;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const url = `${API_BASE}/settings/smtp`;
  const res = await fetchJSON<{ status: string; settings: SmtpConfig }>(url);
  return res.settings;
}

export async function updateSmtpConfig(config: Partial<SmtpConfig>): Promise<void> {
  const url = `${API_BASE}/settings/smtp`;
  await fetchJSON(url, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function testSmtp(recipient: string): Promise<{ success: boolean; message: string }> {
  const url = `${API_BASE}/settings/smtp/test`;
  return await fetchJSON<{ success: boolean; message: string }>(url, {
    method: 'POST',
    body: JSON.stringify({ recipient }),
  });
}

// ─── In-App Notifications ──────────────────────────────────────────

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(): Promise<{
  notifications: InAppNotification[];
  unread_count: number;
}> {
  const url = `${API_BASE}/notifications`;
  return await fetchJSON(url);
}

export async function markNotificationRead(id: string): Promise<void> {
  const url = `${API_BASE}/notifications/${id}/read`;
  await fetchJSON(url, { method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<void> {
  const url = `${API_BASE}/notifications/read-all`;
  await fetchJSON(url, { method: 'POST' });
}

// ─── Client-side Image Compression (HTML5 Canvas) ───────────────────

export async function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.8
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file); // Don't use if compressed is somehow larger
            } else {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// ─── Export API object ──────────────────────────────────────────────

export const api = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskProgress,
  deleteTask,
  archiveTask,
  getComments,
  createComment,
  deleteComment,
  getTeamMembers,
  getUsers,
  getUserById,
  validateUserExists,
  sendTelegramNotification,
  checkDirectusHealth,
  updateUser,
  uploadAvatar,
  uploadTaskFile,
  sendAnnouncement,
  testTelegram,
  toggleTaskLike,
  markTaskAsRead,
  getSmtpConfig,
  updateSmtpConfig,
  testSmtp,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  compressImage,
};
