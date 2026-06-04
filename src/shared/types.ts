export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string | null;
  role: 'user' | 'admin';
  avatarColor: string;
  avatarUrl?: string | null;
  bio?: string | null;
  bioExpiresAt?: number | null;
  status?: string;
  themeColor?: string;
  themeMode?: string;
  nexusRole?: string | null;
  nexusBadgeUrl?: string | null;
  developerBadgeUrl?: string | null;
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
  iconUrl?: string | null;
  ownerId: string;
  inviteCode: string;
  customInvite?: string | null;
  isDiscoverable?: boolean;
  discoveryCategory?: string | null;
  createdAt: number;
  memberCount?: number;
}

export interface ServerMember {
  userId: string;
  username: string;
  displayName?: string | null;
  avatarColor: string;
  avatarUrl?: string | null;
  joinedAt: number;
  roles?: ServerRole[];
  status?: string;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'announcement';
  categoryId?: string | null;
  position: number;
  createdAt: number;
}

export interface VoiceChannel {
  id: string;
  serverId: string;
  name: string;
  categoryId?: string | null;
  bitrate: number;
  userLimit: number;
  position: number;
  createdAt: number;
  participants?: VoiceParticipant[];
}

export interface VoiceParticipant {
  userId: string;
  username: string;
  avatarColor: string;
  joinedAt: number;
}

export interface ChannelCategory {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt: number;
}

export interface ServerRole {
  id: string;
  serverId: string;
  name: string;
  color: string;
  hoist: boolean;
  mentionable: boolean;
  position: number;
  permissions: RolePermissions;
  createdAt: number;
}

export interface RolePermissions {
  administrator?: boolean;
  manageServer?: boolean;
  manageChannels?: boolean;
  manageRoles?: boolean;
  manageMessages?: boolean;
  kickMembers?: boolean;
  banMembers?: boolean;
  muteMembers?: boolean;
  sendMessages?: boolean;
  viewChannels?: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: number;
  username?: string;
  avatarColor?: string;
  displayName?: string | null;
}

export interface Ban {
  id: string;
  serverId: string;
  userId: string;
  username: string;
  avatarColor: string;
  reason: string | null;
  bannedBy: string;
  bannedByName: string;
  createdAt: number;
  expiresAt: number | null;
}

export interface Mute {
  id: string;
  serverId: string;
  userId: string;
  username: string;
  avatarColor: string;
  reason: string | null;
  mutedBy: string;
  mutedByName: string;
  mutedAt: number;
  expiresAt: number | null;
  active: boolean;
}

export interface AuditLogEntry {
  id: string;
  serverId: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  details: string | null;
  createdAt: number;
}

export interface DiscoverableServer {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  iconUrl?: string | null;
  inviteCode: string;
  customInvite?: string | null;
  memberCount: number;
  discoveryCategory?: string | null;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  STATIC_ASSETS: Fetcher;
  SESSION_SECRET: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}

export interface SessionPayload {
  userId: string;
  role: 'user' | 'admin';
}
