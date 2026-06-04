import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { id, now } from '../../shared/utils';

const moderation = new Hono<{ Bindings: Env }>();

// Ban user from server
moderation.post('/ban', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { user_id, server_id, reason, expires_at } = await c.req.json<{
    user_id: string;
    server_id?: string;
    reason?: string;
    expires_at?: number;
  }>();

  const banId = id();
  await c.env.DB.prepare(
    'INSERT INTO bans (id, user_id, server_id, reason, banned_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(banId, user_id, server_id || null, reason || null, session.userId, now(), expires_at || null)
    .run();

  return c.json({ banId }, 201);
});

// Kick user from server
moderation.post('/kick', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { user_id, server_id } = await c.req.json<{ user_id: string; server_id: string }>();

  await c.env.DB.prepare('DELETE FROM server_member_roles WHERE server_id = ? AND user_id = ?')
    .bind(server_id, user_id)
    .run();

  return c.json({ ok: true });
});

// Mute user
moderation.post('/mute', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { user_id, server_id } = await c.req.json<{ user_id: string; server_id: string }>();

  await c.env.DB.prepare('UPDATE server_member_roles SET muted = 1, muted_at = ? WHERE server_id = ? AND user_id = ?')
    .bind(now(), server_id, user_id)
    .run();

  return c.json({ ok: true });
});

export default moderation;