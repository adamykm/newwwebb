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

  // Check permissions
  const member = await c.env.DB.prepare(
    'SELECT role FROM server_member_roles WHERE server_id = ? AND user_id = ?'
  ).bind(server_id, session.userId).first();

  if (!member || !['owner', 'co_owner', 'admin', 'moderator'].includes(member.role as string)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  const banId = id();
  await c.env.DB.prepare(
    'INSERT INTO bans (id, user_id, server_id, reason, banned_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(banId, user_id, server_id || null, reason || null, session.userId, now(), expires_at || null)
    .run();

  // Log action
  await c.env.DB.prepare(
    'INSERT INTO admin_logs (id, admin_id, action, target_user_id, target_server_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id(), session.userId, 'BAN_USER', user_id, server_id || null, reason, now())
    .run();

  return c.json({ banId }, 201);
});

// Kick user from server
moderation.post('/kick', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { user_id, server_id, reason } = await c.req.json<{
    user_id: string;
    server_id: string;
    reason?: string;
  }>();

  // Check permissions
  const member = await c.env.DB.prepare(
    'SELECT role FROM server_member_roles WHERE server_id = ? AND user_id = ?'
  ).bind(server_id, session.userId).first();

  if (!member || !['owner', 'co_owner', 'admin', 'moderator'].includes(member.role as string)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  // Remove from server
  await c.env.DB.prepare('DELETE FROM server_member_roles WHERE server_id = ? AND user_id = ?')
    .bind(server_id, user_id)
    .run();

  // Log action
  await c.env.DB.prepare(
    'INSERT INTO admin_logs (id, admin_id, action, target_user_id, target_server_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id(), session.userId, 'KICK_USER', user_id, server_id, reason, now())
    .run();

  return c.json({ ok: true });
});

// Mute user in server
moderation.post('/mute', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { user_id, server_id, duration_ms } = await c.req.json<{
    user_id: string;
    server_id: string;
    duration_ms?: number;
  }>();

  // Check permissions
  const member = await c.env.DB.prepare(
    'SELECT role FROM server_member_roles WHERE server_id = ? AND user_id = ?'
  ).bind(server_id, session.userId).first();

  if (!member || !['owner', 'co_owner', 'admin', 'moderator'].includes(member.role as string)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  await c.env.DB.prepare(
    'UPDATE server_member_roles SET muted = 1, muted_at = ? WHERE server_id = ? AND user_id = ?'
  )
    .bind(now(), server_id, user_id)
    .run();

  return c.json({ ok: true });
});

// Get moderation logs for server
moderation.get('/logs/:serverId', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { serverId } = c.req.param();

  // Check if admin of server
  const member = await c.env.DB.prepare(
    'SELECT role FROM server_member_roles WHERE server_id = ? AND user_id = ?'
  ).bind(serverId, session.userId).first();

  if (!member || !['owner', 'co_owner', 'admin'].includes(member.role as string)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  const logs = await c.env.DB.prepare(
    'SELECT id, admin_id, action, target_user_id, details, created_at FROM admin_logs WHERE target_server_id = ? ORDER BY created_at DESC LIMIT 100'
  )
    .bind(serverId)
    .all();

  return c.json({ logs });
});

export default moderation;