import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';
import { id, now } from '../../shared/utils';

type Variables = { session: SessionPayload; userId: string };

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

admin.use('*', async (c, next) => {
  const session = c.get('session');
  if (session.role !== 'admin') return c.json({ error: 'Admin access required' }, 403);
  await next();
});

admin.get('/stats', async (c) => {
  const [users, tasks, notes, events, servers] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM tasks').first(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM notes').first(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM events').first(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM servers').first(),
  ]);
  return c.json({
    stats: {
      users: users?.c ?? 0, tasks: tasks?.c ?? 0,
      notes: notes?.c ?? 0, events: events?.c ?? 0, servers: servers?.c ?? 0,
    },
  });
});

admin.get('/users', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, email, username, display_name, role, avatar_color, avatar_url,
            nexus_role, nexus_badge_url, developer_badge_url,
            is_disabled, is_terminated, disabled_reason, disabled_at,
            global_timeout_until, created_at
     FROM users ORDER BY created_at DESC`
  ).all();
  return c.json({
    users: (rows.results || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.display_name ?? null,
      role: u.role,
      avatarColor: u.avatar_color,
      avatarUrl: u.avatar_url ?? null,
      nexusRole: u.nexus_role ?? null,
      nexusBadgeUrl: u.nexus_badge_url ?? null,
      developerBadgeUrl: u.developer_badge_url ?? null,
      isDisabled: !!(u.is_disabled as number),
      isTerminated: !!(u.is_terminated as number),
      disabledReason: u.disabled_reason ?? null,
      disabledAt: u.disabled_at ?? null,
      globalTimeoutUntil: u.global_timeout_until ?? null,
      createdAt: u.created_at,
    })),
  });
});

admin.get('/tasks', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT t.*, u.username FROM tasks t JOIN users u ON u.id = t.user_id ORDER BY t.updated_at DESC LIMIT 200'
  ).all();
  return c.json({ tasks: rows.results || [] });
});

admin.get('/notes', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT n.*, u.username FROM notes n JOIN users u ON u.id = n.user_id ORDER BY n.updated_at DESC LIMIT 200'
  ).all();
  return c.json({ notes: rows.results || [] });
});

admin.get('/events', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT e.*, u.username FROM events e JOIN users u ON u.id = e.user_id ORDER BY e.start_at DESC LIMIT 200'
  ).all();
  return c.json({ events: rows.results || [] });
});

admin.get('/servers', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT s.*, u.username as owner_name, COUNT(sm.user_id) as member_count
    FROM servers s JOIN users u ON u.id = s.owner_id
    LEFT JOIN server_members sm ON sm.server_id = s.id
    GROUP BY s.id ORDER BY s.created_at DESC
  `).all();
  return c.json({ servers: rows.results || [] });
});

// ── Badge & nexus role assignment ─────────────────────────────────────────────
admin.post('/nexus-role', async (c) => {
  const body = await c.req.json<{ userId?: string; nexusRole?: string | null; nexusBadgeUrl?: string | null }>();
  if (!body.userId) return c.json({ error: 'userId required' }, 400);

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.userId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare('UPDATE users SET nexus_role = ?, nexus_badge_url = ? WHERE id = ?')
    .bind(body.nexusRole || null, body.nexusBadgeUrl || null, body.userId).run();
  return c.json({ ok: true });
});

admin.post('/developer-badge', async (c) => {
  const body = await c.req.json<{ userId?: string; developerBadgeUrl?: string | null }>();
  if (!body.userId) return c.json({ error: 'userId required' }, 400);

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.userId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare('UPDATE users SET developer_badge_url = ? WHERE id = ?')
    .bind(body.developerBadgeUrl || null, body.userId).run();
  return c.json({ ok: true });
});

// Combined badge update
admin.post('/users/:userId/badge', async (c) => {
  const actorId = c.get('userId');
  const targetId = c.req.param('userId');
  if (targetId === actorId) return c.json({ error: 'Cannot modify your own badges here' }, 400);

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  const body = await c.req.json<{
    nexusRole?: string | null;
    nexusBadgeUrl?: string | null;
    developerBadgeUrl?: string | null;
  }>();

  const updates: string[] = [];
  const params: unknown[] = [];
  if (body.nexusRole !== undefined) { updates.push('nexus_role = ?'); params.push(body.nexusRole || null); }
  if (body.nexusBadgeUrl !== undefined) { updates.push('nexus_badge_url = ?'); params.push(body.nexusBadgeUrl || null); }
  if (body.developerBadgeUrl !== undefined) { updates.push('developer_badge_url = ?'); params.push(body.developerBadgeUrl || null); }

  if (!updates.length) return c.json({ error: 'Nothing to update' }, 400);
  params.push(targetId);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  return c.json({ ok: true });
});

// ── Account moderation ────────────────────────────────────────────────────────
admin.post('/users/:userId/disable', async (c) => {
  const actorId = c.get('userId');
  const targetId = c.req.param('userId');
  if (targetId === actorId) return c.json({ error: 'Cannot disable your own account' }, 400);

  const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(targetId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);
  if ((user.role as string) === 'admin') return c.json({ error: 'Cannot disable another admin account' }, 403);

  const { reason } = await c.req.json<{ reason?: string }>();
  await c.env.DB.prepare(
    'UPDATE users SET is_disabled = 1, disabled_reason = ?, disabled_by = ?, disabled_at = ? WHERE id = ?'
  ).bind(reason || null, actorId, now(), targetId).run();

  return c.json({ ok: true });
});

admin.post('/users/:userId/enable', async (c) => {
  const targetId = c.req.param('userId');

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare(
    'UPDATE users SET is_disabled = 0, disabled_reason = NULL, disabled_by = NULL, disabled_at = NULL WHERE id = ?'
  ).bind(targetId).run();

  return c.json({ ok: true });
});

admin.post('/users/:userId/terminate', async (c) => {
  const actorId = c.get('userId');
  const targetId = c.req.param('userId');
  if (targetId === actorId) return c.json({ error: 'Cannot terminate your own account' }, 400);

  const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(targetId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);
  if ((user.role as string) === 'admin') return c.json({ error: 'Cannot terminate another admin account' }, 403);

  const { reason } = await c.req.json<{ reason?: string }>();
  await c.env.DB.prepare(
    'UPDATE users SET is_terminated = 1, is_disabled = 1, disabled_reason = ?, disabled_by = ?, disabled_at = ? WHERE id = ?'
  ).bind(reason || 'Account terminated', actorId, now(), targetId).run();

  return c.json({ ok: true });
});

admin.post('/users/:userId/timeout', async (c) => {
  const targetId = c.req.param('userId');

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  const { duration } = await c.req.json<{ duration?: number }>();
  if (!duration || duration < 1) return c.json({ error: 'duration (minutes) required' }, 400);

  const timeoutUntil = now() + duration * 60 * 1000;
  await c.env.DB.prepare('UPDATE users SET global_timeout_until = ? WHERE id = ?')
    .bind(timeoutUntil, targetId).run();

  return c.json({ ok: true, timeoutUntil });
});

admin.delete('/users/:userId/timeout', async (c) => {
  const targetId = c.req.param('userId');

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare('UPDATE users SET global_timeout_until = NULL WHERE id = ?')
    .bind(targetId).run();

  return c.json({ ok: true });
});

export default admin;
