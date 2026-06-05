const API = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed');
  return data as T;
}

export const api = {
  auth: {
    me: () => request<{ user: User | null }>('/auth/me'),
    login: (email: string, password: string) =>
      request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (email: string, username: string, password: string) =>
      request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, username, password }) }),
    logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  },
  tasks: {
    list: () => request<{ tasks: Task[] }>('/tasks'),
    create: (data: Partial<Task>) => request<{ task: Task }>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Task>) => request<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
  },
  notes: {
    list: () => request<{ notes: Note[] }>('/notes'),
    create: (data: { title: string; body?: string }) => request<{ note: Note }>('/notes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Note>) => request<{ note: Note }>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/notes/${id}`, { method: 'DELETE' }),
  },
  events: {
    list: () => request<{ events: Event[] }>('/events'),
    create: (data: Partial<Event>) => request<{ event: Event }>('/events', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Event>) => request<{ event: Event }>(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/events/${id}`, { method: 'DELETE' }),
  },
  servers: {
    list: () => request<{ servers: Server[] }>('/servers'),
    create: (name: string, description?: string) =>
      request<{ server: Server }>('/servers', { method: 'POST', body: JSON.stringify({ name, description }) }),
    join: (inviteCode: string) => request<{ ok: boolean; serverId: string }>('/servers/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
    get: (id: string) => request<{ server: Server; channels: Channel[]; members: ServerMember[] }>(`/servers/${id}`),
    messages: (serverId: string, channelId: string, since?: number) =>
      request<{ messages: Message[] }>(`/servers/${serverId}/channels/${channelId}/messages${since ? `?since=${since}` : ''}`),
    sendMessage: (serverId: string, channelId: string, content: string) =>
      request<{ message: Message }>(`/servers/${serverId}/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  },
  admin: {
    stats: () => request<{ stats: AdminStats }>('/admin/stats'),
    users: () => request<{ users: User[] }>('/admin/users'),
    tasks: () => request<{ tasks: Record<string, unknown>[] }>('/admin/tasks'),
    notes: () => request<{ notes: Record<string, unknown>[] }>('/admin/notes'),
    events: () => request<{ events: Record<string, unknown>[] }>('/admin/events'),
    servers: () => request<{ servers: Record<string, unknown>[] }>('/admin/servers'),
  },
};

export interface User {
  id: string;
  email?: string;
  username: string;
  role: 'user' | 'admin';
  avatarColor: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Event {
  id: string;
  userId: string;
  title: string;
  description: string;
  startAt: number;
  endAt: number | null;
  location: string;
  createdAt: number;
}

export interface Server {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  ownerId: string;
  inviteCode: string;
  createdAt: number;
  memberCount?: number;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  createdAt: number;
}

export interface ServerMember {
  userId: string;
  username: string;
  avatarColor: string;
  joinedAt: number;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: number;
  username?: string;
  avatarColor?: string;
}

export interface AdminStats {
  users: number;
  tasks: number;
  notes: number;
  events: number;
  servers: number;
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
