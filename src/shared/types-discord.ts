export interface Env {
  DB: D1Database;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET: string;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  R2?: R2Bucket;
  GIPHY_API_KEY?: string;
}

export interface SessionPayload {
  userId: string;
  role: 'user' | 'admin';
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  avatarColor: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  created_at: number;
}

export interface Server {
  id: string;
  name: string;
  description: string;
  icon_color: string;
  icon_url?: string;
  banner_url?: string;
  owner_id: string;
  invite_code: string;
  category_id?: string;
  created_at: number;
}

export interface ServerMember {
  server_id: string;
  user_id: string;
  role: 'owner' | 'co_owner' | 'admin' | 'moderator' | 'member';
  banned: boolean;
  muted: boolean;
  joined_at: number;
}

export interface VoiceChannel {
  id: string;
  server_id: string;
  category_id?: string;
  name: string;
  bitrate: number;
  user_limit: number;
  created_at: number;
}

export interface ChannelCategory {
  id: string;
  server_id: string;
  name: string;
  position: number;
  created_at: number;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: number;
  edited_at?: number;
}

export interface Friend {
  id: string;
  user_id_1: string;
  user_id_2: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: number;
  updated_at: number;
}

export interface Sticker {
  id: string;
  server_id?: string;
  user_id: string;
  name: string;
  image_url: string;
  pack_id?: string;
  created_at: number;
}

export interface Emoji {
  id: string;
  server_id?: string;
  name: string;
  image_url: string;
  created_at: number;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji_id?: string;
  emoji_text?: string;
  created_at: number;
}

export interface VoiceSession {
  id: string;
  channel_id: string;
  user_id: string;
  joined_at: number;
  left_at?: number;
}

export interface Ban {
  id: string;
  user_id: string;
  server_id?: string;
  reason?: string;
  banned_by: string;
  created_at: number;
  expires_at?: number;
}

export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_user_id?: string;
  target_server_id?: string;
  details?: string;
  created_at: number;
}

export interface ServerCategory {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: number;
}
