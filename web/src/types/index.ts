export interface Task {
  id: string;
  title: string;
  description: string;
  progress: number;
  deadline?: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  assignee: string;
  manager?: string | null;
  collaborators: string[];
  avatar_url: string;
  created_at: string;
  updated_at: string;
  creator_id?: string;
  created_by_name?: string | null;
  latest_update?: string | null;
  project_owner?: string | null;
  previous_progress?: number;
  is_archived?: boolean;
  archive_reason?: string | null;
  likes?: {
    user_id: string;
    username: string;
    first_name: string;
    nickname?: string | null;
    department?: string | null;
    formatted_name?: string;
  }[];
}

export interface TaskComment {
  id: string;
  task: string;
  user: string;
  message: string;
  created_at: string;
  update_key?: string | null;
}

export interface TeamMember {
  name: string;
  avatar_url: string;
  tasks: Task[];
  totalTasks: number;
  completedTasks: number;
  overallProgress: number;
  telegram_id?: string;
  last_update?: string;
}

export type TaskFormData = Omit<Task, 'id' | 'created_at' | 'updated_at'>;

export type TaskStatus = Task['status'];

export interface User {
  id: string;
  email: string;
  username: string;
  nickname?: string | null;
  first_name: string;
  last_name: string;
  status: 'active' | 'inactive' | 'suspended';
  role?: {
    id: string;
    name: string;
  };
  department?: string;
  position?: string;
  manager?: string;
  colleagues?: string[];
  telegram_id?: string;
  is_ad_auth?: boolean;
  last_access?: string | null;
  previous_access?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export const DEPARTMENTS = [
  { value: 'IT', label: 'IT' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Production', label: 'Production' },
  { value: 'Warehouse', label: 'Warehouse' },
  { value: 'Purchasing', label: 'Purchasing' },
  { value: 'Accounting', label: 'Accounting' },
];

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'To Do', color: 'text-gray-700 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-700' },
  in_progress: { label: 'Doing', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-100 dark:bg-blue-900' },
  review: { label: 'Review', color: 'text-yellow-700 dark:text-yellow-300', bgColor: 'bg-yellow-100 dark:bg-yellow-900' },
  done: { label: 'Done', color: 'text-green-700 dark:text-green-300', bgColor: 'bg-green-100 dark:bg-green-900' },
};

export const PROGRESS_COLORS = {
  low: 'bg-red-500',
  medium: 'bg-yellow-500',
  high: 'bg-blue-500',
  complete: 'bg-green-500',
};
