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

export async function deleteTask(id: string): Promise<void> {
  const url = `${API_BASE}/items/tasks/${id}`;
  await fetchJSON(url, { method: 'DELETE' });
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

// ─── Export API object ──────────────────────────────────────────────

export const api = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskProgress,
  deleteTask,
  getComments,
  createComment,
  deleteComment,
  getTeamMembers,
  getUsers,
  getUserById,
  validateUserExists,
  sendTelegramNotification,
  checkDirectusHealth,
};
