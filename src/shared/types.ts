export interface User {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  avatarColor: string;
  createdAt: number;
}

export interface Task {
  id: string;
  userId: string;
  serverId: string | null;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueAt: number | null;
  createdAt: number;
  updatedAt: number;
  username?: string;
}

export interface Note {
  id: string;
  userId: string;
  serverId: string | null;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  username?: string;
}

export interface Event {
  id: string;
  userId: string;
  serverId: string | null;
  title: string;
  description: string;
  startAt: number;
  endAt: number | null;
  location: string;
  createdAt: number;
  username?: string;
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

export interface ServerMember {
  userId: string;
  username: string;
  avatarColor: string;
  joinedAt: number;
  role?: string;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  createdAt: number;
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

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}

export interface SessionPayload {
  userId: string;
  role: 'user' | 'admin';
}
