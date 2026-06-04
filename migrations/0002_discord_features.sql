-- Update users table for avatars and profiles
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN banner_url TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;

-- Update servers table for logos and categories
ALTER TABLE servers ADD COLUMN icon_url TEXT;
ALTER TABLE servers ADD COLUMN banner_url TEXT;
ALTER TABLE servers ADD COLUMN category_id TEXT;

-- Server categories (managed by Nexus admin)
CREATE TABLE IF NOT EXISTS server_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Server members with roles and permissions
CREATE TABLE IF NOT EXISTS server_member_roles (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'co_owner', 'admin', 'moderator', 'member')),
  banned INTEGER DEFAULT 0,
  banned_at INTEGER,
  banned_by TEXT,
  muted INTEGER DEFAULT 0,
  muted_at INTEGER,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (server_id, user_id),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Voice channels
CREATE TABLE IF NOT EXISTS voice_channels (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  category_id TEXT,
  name TEXT NOT NULL,
  bitrate INTEGER DEFAULT 64,
  user_limit INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES channel_categories(id) ON DELETE SET NULL
);

-- Channel categories
CREATE TABLE IF NOT EXISTS channel_categories (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Friend system
CREATE TABLE IF NOT EXISTS friends (
  id TEXT PRIMARY KEY,
  user_id_1 TEXT NOT NULL,
  user_id_2 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'blocked')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id_1, user_id_2)
);

-- Direct messages
CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Stickers
CREATE TABLE IF NOT EXISTS stickers (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  pack_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Emojis
CREATE TABLE IF NOT EXISTS emojis (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji_id TEXT,
  emoji_text TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Voice sessions
CREATE TABLE IF NOT EXISTS voice_sessions (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  left_at INTEGER,
  FOREIGN KEY (channel_id) REFERENCES voice_channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bans
CREATE TABLE IF NOT EXISTS bans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  server_id TEXT,
  reason TEXT,
  banned_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Admin logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  target_server_id TEXT,
  details TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id_1);
CREATE INDEX IF NOT EXISTS idx_dms_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dms_recipient ON direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_channel ON voice_sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user ON voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_bans_user ON bans(user_id);
CREATE INDEX IF NOT EXISTS idx_bans_server ON bans(server_id);
CREATE INDEX IF NOT EXISTS idx_stickers_server ON stickers(server_id);
CREATE INDEX IF NOT EXISTS idx_emojis_server ON emojis(server_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id);
