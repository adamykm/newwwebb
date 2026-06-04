-- Account moderation: disable, terminate, global timeout
ALTER TABLE users ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN is_terminated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN disabled_reason TEXT;
ALTER TABLE users ADD COLUMN disabled_by TEXT;
ALTER TABLE users ADD COLUMN disabled_at INTEGER;
ALTER TABLE users ADD COLUMN global_timeout_until INTEGER;
