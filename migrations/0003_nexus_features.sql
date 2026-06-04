-- User profile extensions
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN bio_expires_at INTEGER;
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'online';
ALTER TABLE users ADD COLUMN theme_color TEXT NOT NULL DEFAULT '#5865f2';
ALTER TABLE users ADD COLUMN theme_mode TEXT NOT NULL DEFAULT 'dark';
ALTER TABLE users ADD COLUMN nexus_role TEXT;
ALTER TABLE users ADD COLUMN nexus_badge_url TEXT;
ALTER TABLE users ADD COLUMN developer_badge_url TEXT;

-- Server discovery
ALTER TABLE servers ADD COLUMN is_discoverable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE servers ADD COLUMN custom_invite TEXT;

-- Channel organization
ALTER TABLE channels ADD COLUMN category_id TEXT;
ALTER TABLE channels ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN type TEXT NOT NULL DEFAULT 'text';

-- Custom server roles
CREATE TABLE IF NOT EXISTS server_roles (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#99aab5',
  hoist INTEGER NOT NULL DEFAULT 0,
  mentionable INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  permissions TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Role assignments to members
CREATE TABLE IF NOT EXISTS role_members (
  role_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  PRIMARY KEY (role_id, user_id),
  FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Server-level audit log
CREATE TABLE IF NOT EXISTS server_audit_log (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,
  details TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Mutes / timeouts
CREATE TABLE IF NOT EXISTS mutes (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT,
  muted_by TEXT NOT NULL,
  muted_at INTEGER NOT NULL,
  expires_at INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- WebRTC signaling for voice channels
CREATE TABLE IF NOT EXISTS voice_signals (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_server_roles_server ON server_roles(server_id);
CREATE INDEX IF NOT EXISTS idx_role_members_server ON role_members(server_id);
CREATE INDEX IF NOT EXISTS idx_role_members_user ON role_members(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_server ON server_audit_log(server_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mutes_server ON mutes(server_id, active);
CREATE INDEX IF NOT EXISTS idx_voice_signals ON voice_signals(channel_id, created_at);
