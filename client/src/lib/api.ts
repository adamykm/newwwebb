const API = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
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
    join: (inviteCode: string) =>
      request<{ ok: boolean; serverId: string }>('/servers/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }),
    get: (id: string) =>
      request<{ server: Server; categories: ChannelCategory[]; channels: Channel[]; voiceChannels: VoiceChannel[]; roles: ServerRole[]; members: ServerMember[] }>(`/servers/${id}`),
    update: (id: string, data: Partial<Server> & { customInvite?: string; isDiscoverable?: boolean; discoveryCategory?: string }) =>
      request<{ server: Server }>(`/servers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/servers/${id}`, { method: 'DELETE' }),

    // Categories
    createCategory: (serverId: string, name: string) =>
      request<{ category: ChannelCategory }>(`/servers/${serverId}/categories`, { method: 'POST', body: JSON.stringify({ name }) }),
    updateCategory: (serverId: string, catId: string, data: { name?: string; position?: number }) =>
      request<{ category: ChannelCategory }>(`/servers/${serverId}/categories/${catId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteCategory: (serverId: string, catId: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/categories/${catId}`, { method: 'DELETE' }),

    // Channels
    createChannel: (serverId: string, data: { name: string; categoryId?: string | null; type?: string }) =>
      request<{ channel: Channel }>(`/servers/${serverId}/channels`, { method: 'POST', body: JSON.stringify(data) }),
    updateChannel: (serverId: string, channelId: string, data: { name?: string; categoryId?: string | null; position?: number }) =>
      request<{ channel: Channel }>(`/servers/${serverId}/channels/${channelId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteChannel: (serverId: string, channelId: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/channels/${channelId}`, { method: 'DELETE' }),

    // Voice channels
    createVoice: (serverId: string, data: { name: string; categoryId?: string | null; userLimit?: number }) =>
      request<{ voiceChannel: VoiceChannel }>(`/servers/${serverId}/voice`, { method: 'POST', body: JSON.stringify(data) }),
    deleteVoice: (serverId: string, vcId: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/voice/${vcId}`, { method: 'DELETE' }),
    joinVoice: (serverId: string, vcId: string) =>
      request<{ sessionId: string; participants: VoiceParticipant[] }>(`/servers/${serverId}/voice/${vcId}/join`, { method: 'POST', body: '{}' }),
    leaveVoice: (serverId: string, vcId: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/voice/${vcId}/leave`, { method: 'POST', body: '{}' }),
    voiceParticipants: (serverId: string, vcId: string) =>
      request<{ participants: VoiceParticipant[] }>(`/servers/${serverId}/voice/${vcId}/participants`),
    voiceSignals: (serverId: string, vcId: string, since?: number) =>
      request<{ signals: VoiceSignal[] }>(`/servers/${serverId}/voice/${vcId}/signals${since ? `?since=${since}` : ''}`),
    sendSignal: (serverId: string, vcId: string, data: { type: string; data: string; toUserId?: string }) =>
      request<{ ok: boolean }>(`/servers/${serverId}/voice/${vcId}/signal`, { method: 'POST', body: JSON.stringify(data) }),

    // Messages
    messages: (serverId: string, channelId: string, since?: number) =>
      request<{ messages: Message[]; isMuted?: boolean }>(`/servers/${serverId}/channels/${channelId}/messages${since ? `?since=${since}` : ''}`),
    sendMessage: (serverId: string, channelId: string, content: string) =>
      request<{ message: Message }>(`/servers/${serverId}/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  },
  moderation: {
    getBans: (serverId: string) => request<{ bans: Ban[] }>(`/servers/${serverId}/bans`),
    ban: (serverId: string, data: { userId: string; reason?: string; expiresAt?: number | null }) =>
      request<{ ok: boolean; banId: string }>(`/servers/${serverId}/bans`, { method: 'POST', body: JSON.stringify(data) }),
    revokeBan: (serverId: string, banId: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/bans/${banId}`, { method: 'DELETE' }),
    kick: (serverId: string, userId: string, reason?: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/kick`, { method: 'POST', body: JSON.stringify({ userId, reason }) }),
    getMutes: (serverId: string) => request<{ mutes: Mute[] }>(`/servers/${serverId}/mutes`),
    mute: (serverId: string, data: { userId: string; reason?: string; duration?: number }) =>
      request<{ ok: boolean; muteId: string }>(`/servers/${serverId}/mute`, { method: 'POST', body: JSON.stringify(data) }),
    unmute: (serverId: string, muteId: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/mutes/${muteId}`, { method: 'DELETE' }),
    getAuditLog: (serverId: string) => request<{ entries: AuditLogEntry[] }>(`/servers/${serverId}/audit-log`),
  },
  roles: {
    list: (serverId: string) => request<{ roles: ServerRole[] }>(`/servers/${serverId}/roles`),
    create: (serverId: string, data: Partial<ServerRole> & { permissions?: RolePermissions }) =>
      request<{ role: ServerRole }>(`/servers/${serverId}/roles`, { method: 'POST', body: JSON.stringify(data) }),
    update: (serverId: string, roleId: string, data: Partial<ServerRole> & { permissions?: RolePermissions }) =>
      request<{ role: ServerRole }>(`/servers/${serverId}/roles/${roleId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (serverId: string, roleId: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/roles/${roleId}`, { method: 'DELETE' }),
    assign: (serverId: string, userId: string, roleId: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/members/${userId}/roles/${roleId}`, { method: 'POST', body: '{}' }),
    remove: (serverId: string, userId: string, roleId: string) =>
      request<{ ok: boolean }>(`/servers/${serverId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' }),
  },
  discovery: {
    list: (q?: string, category?: string) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      const qs = params.toString();
      return request<{ servers: DiscoverableServer[] }>(`/discovery${qs ? `?${qs}` : ''}`);
    },
    categories: () => request<{ categories: string[] }>('/discovery/categories'),
  },
  profile: {
    get: (userId: string) => request<{ user: PublicUser }>(`/profile/${userId}`),
    update: (data: {
      displayName?: string | null; avatarUrl?: string | null;
      bio?: string | null; bioExpiry?: '24h' | 'permanent' | null;
      status?: string; themeColor?: string; themeMode?: string;
    }) => request<{ user: User }>('/profile/', { method: 'PATCH', body: JSON.stringify(data) }),
    assignNexusRole: (userId: string, nexusRole: 'moderator' | 'administrator' | null, nexusBadgeUrl?: string | null) =>
      request<{ ok: boolean }>('/profile/nexus-role', { method: 'POST', body: JSON.stringify({ userId, nexusRole, nexusBadgeUrl }) }),
    assignDeveloperBadge: (userId: string, developerBadgeUrl: string | null) =>
      request<{ ok: boolean }>('/profile/developer-badge', { method: 'POST', body: JSON.stringify({ userId, developerBadgeUrl }) }),
  },
  admin: {
    stats: () => request<{ stats: AdminStats }>('/admin/stats'),
    users: () => request<{ users: AdminUser[] }>('/admin/users'),
    tasks: () => request<{ tasks: Record<string, unknown>[] }>('/admin/tasks'),
    notes: () => request<{ notes: Record<string, unknown>[] }>('/admin/notes'),
    events: () => request<{ events: Record<string, unknown>[] }>('/admin/events'),
    servers: () => request<{ servers: Record<string, unknown>[] }>('/admin/servers'),
    setBadge: (userId: string, data: { nexusRole?: string | null; nexusBadgeUrl?: string | null; developerBadgeUrl?: string | null }) =>
      request<{ ok: boolean }>(`/admin/users/${userId}/badge`, { method: 'POST', body: JSON.stringify(data) }),
    disableUser: (userId: string, reason?: string) =>
      request<{ ok: boolean }>(`/admin/users/${userId}/disable`, { method: 'POST', body: JSON.stringify({ reason }) }),
    enableUser: (userId: string) =>
      request<{ ok: boolean }>(`/admin/users/${userId}/enable`, { method: 'POST', body: '{}' }),
    terminateUser: (userId: string, reason?: string) =>
      request<{ ok: boolean }>(`/admin/users/${userId}/terminate`, { method: 'POST', body: JSON.stringify({ reason }) }),
    timeoutUser: (userId: string, duration: number) =>
      request<{ ok: boolean; timeoutUntil: number }>(`/admin/users/${userId}/timeout`, { method: 'POST', body: JSON.stringify({ duration }) }),
    clearTimeout: (userId: string) =>
      request<{ ok: boolean }>(`/admin/users/${userId}/timeout`, { method: 'DELETE' }),
  },
};

export interface User {
  id: string;
  email?: string;
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
}

export interface PublicUser {
  id: string;
  username: string;
  displayName?: string | null;
  role: string;
  avatarColor: string;
  avatarUrl?: string | null;
  bio?: string | null;
  status?: string;
  nexusRole?: string | null;
  nexusBadgeUrl?: string | null;
  developerBadgeUrl?: string | null;
  createdAt: number;
}

export interface Task {
  id: string; userId: string; title: string; description: string;
  status: 'todo' | 'in_progress' | 'done'; priority: 'low' | 'medium' | 'high';
  dueAt: number | null; createdAt: number; updatedAt: number;
}

export interface Note {
  id: string; userId: string; title: string; body: string; createdAt: number; updatedAt: number;
}

export interface Event {
  id: string; userId: string; title: string; description: string;
  startAt: number; endAt: number | null; location: string; createdAt: number;
}

export interface Server {
  id: string; name: string; description: string; iconColor: string; iconUrl?: string | null;
  ownerId: string; inviteCode: string; customInvite?: string | null;
  isDiscoverable?: boolean; discoveryCategory?: string | null;
  createdAt: number; memberCount?: number;
}

export interface DiscoverableServer {
  id: string; name: string; description: string; iconColor: string; iconUrl?: string | null;
  inviteCode: string; customInvite?: string | null;
  discoveryCategory?: string | null; memberCount: number;
}

export interface Channel {
  id: string; serverId: string; name: string; type: string;
  categoryId?: string | null; position: number; createdAt: number;
}

export interface ChannelCategory {
  id: string; serverId: string; name: string; position: number; createdAt: number;
}

export interface VoiceChannel {
  id: string; serverId: string; name: string; categoryId?: string | null;
  bitrate: number; userLimit: number; position: number; createdAt: number;
  participants?: VoiceParticipant[];
}

export interface VoiceParticipant {
  userId: string; username: string; avatarColor: string; joinedAt: number;
}

export interface VoiceSignal {
  id: string; fromUserId: string; toUserId?: string | null;
  type: string; data: string; createdAt: number;
}

export interface ServerMember {
  userId: string; username: string; displayName?: string | null;
  avatarColor: string; avatarUrl?: string | null; joinedAt: number;
  roles?: Array<{ id: string; name: string; color: string; hoist: boolean; position: number }>;
  status?: string; isMuted?: boolean;
}

export interface ServerRole {
  id: string; serverId: string; name: string; color: string;
  hoist: boolean; mentionable: boolean; position: number;
  permissions: RolePermissions; createdAt: number;
}

export interface RolePermissions {
  administrator?: boolean; manageServer?: boolean; manageChannels?: boolean;
  manageRoles?: boolean; manageMessages?: boolean; kickMembers?: boolean;
  banMembers?: boolean; muteMembers?: boolean; sendMessages?: boolean; viewChannels?: boolean;
}

export interface Message {
  id: string; channelId: string; userId: string; content: string;
  createdAt: number; username?: string; displayName?: string | null; avatarColor?: string;
}

export interface Ban {
  id: string; serverId: string; userId: string; username: string; avatarColor: string;
  reason: string | null; bannedBy: string; bannedByName: string;
  createdAt: number; expiresAt: number | null;
}

export interface Mute {
  id: string; serverId: string; userId: string; username: string; avatarColor: string;
  reason: string | null; mutedBy: string; mutedByName: string;
  mutedAt: number; expiresAt: number | null; active: boolean;
}

export interface AuditLogEntry {
  id: string; serverId: string; actorId: string; actorName: string;
  action: string; targetType: string | null; targetId: string | null;
  targetName: string | null; details: string | null; createdAt: number;
}

export interface AdminStats {
  users: number; tasks: number; notes: number; events: number; servers: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: 'user' | 'admin';
  avatarColor: string;
  avatarUrl: string | null;
  nexusRole: string | null;
  nexusBadgeUrl: string | null;
  developerBadgeUrl: string | null;
  isDisabled: boolean;
  isTerminated: boolean;
  disabledReason: string | null;
  disabledAt: number | null;
  globalTimeoutUntil: number | null;
  createdAt: number;
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

export function getDisplayName(user: { username: string; displayName?: string | null }) {
  return user.displayName || user.username;
}
