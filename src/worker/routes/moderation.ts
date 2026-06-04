import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';
import { id, now, hasPermission, addAuditLog } from '../../shared/utils';

type Variables = { session: SessionPayload; userId: string };
const moderation = new Hono<{ Bindings: Env; Variables: Variables }>();

async function isMember(db: D1Database, serverId: string, userId: string) {
  return !!(await db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').bind(serverId, userId).first());
}

// ── Bans ──────────────────────────────────────────────────────────────────────
moderation.get('/:serverId/bans', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'banMembers'))) return c.json({ error: 'Missing permission' }, 403);

  const rows = await c.env.DB.prepare(`
    SELECT b.*, u.username, u.avatar_color, bu.username as banned_by_name
    FROM bans b JOIN users u ON u.id = b.user_id JOIN users bu ON bu.id = b.banned_by
    WHERE b.server_id = ? ORDER BY b.created_at DESC
  `).bind(serverId).all();

  return c.json({
    bans: (rows.results || []).map((b: Record<string, unknown>) => ({
      id: b.id, serverId, userId: b.user_id, username: b.username,
      avatarColor: b.avatar_color, reason: b.reason ?? null,
      bannedBy: b.banned_by, bannedByName: b.banned_by_name,
      createdAt: b.created_at, expiresAt: b.expires_at ?? null,
    })),
  });
});

moderation.post('/:serverId/bans', async (c) => {
  const actorId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, actorId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, actorId, 'banMembers'))) return c.json({ error: 'Missing permission' }, 403);

  const body = await c.req.json<{ userId?: string; reason?: string; expiresAt?: number | null }>();
  if (!body.userId) return c.json({ error: 'userId required' }, 400);

  const server = await c.env.DB.prepare('SELECT owner_id FROM servers WHERE id = ?').bind(serverId).first();
  if (body.userId === actorId) return c.json({ error: 'Cannot ban yourself' }, 400);
  if (body.userId === server?.owner_id) return c.json({ error: 'Cannot ban the server owner' }, 400);

  const targetUser = await c.env.DB.prepare('SELECT username, avatar_color FROM users WHERE id = ?').bind(body.userId).first();
  if (!targetUser) return c.json({ error: 'User not found' }, 404);

  const existingBan = await c.env.DB.prepare(
    'SELECT id FROM bans WHERE server_id = ? AND user_id = ? AND (expires_at IS NULL OR expires_at > ?)'
  ).bind(serverId, body.userId, now()).first();
  if (existingBan) return c.json({ error: 'User is already banned' }, 409);

  const banId = id();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO bans (id, user_id, server_id, reason, banned_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(banId, body.userId, serverId, body.reason || null, actorId, now(), body.expiresAt || null),
    c.env.DB.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').bind(serverId, body.userId),
    c.env.DB.prepare('DELETE FROM role_members WHERE server_id = ? AND user_id = ?').bind(serverId, body.userId),
  ]);

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(actorId).first();
  await addAuditLog(c.env.DB, serverId, actorId, (actorRow?.username as string) || actorId,
    body.expiresAt ? 'TEMP_BAN' : 'PERMANENT_BAN',
    { targetType: 'user', targetId: body.userId, targetName: targetUser.username as string, details: { reason: body.reason, expiresAt: body.expiresAt } }
  );

  return c.json({ ok: true, banId }, 201);
});

moderation.delete('/:serverId/bans/:banId', async (c) => {
  const actorId = c.get('userId');
  const serverId = c.req.param('serverId');
  const banId = c.req.param('banId');
  if (!(await isMember(c.env.DB, serverId, actorId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, actorId, 'banMembers'))) return c.json({ error: 'Missing permission' }, 403);

  const ban = await c.env.DB.prepare('SELECT * FROM bans WHERE id = ? AND server_id = ?').bind(banId, serverId).first();
  if (!ban) return c.json({ error: 'Ban not found' }, 404);

  await c.env.DB.prepare('DELETE FROM bans WHERE id = ?').bind(banId).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(actorId).first();
  const targetRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(ban.user_id).first();
  await addAuditLog(c.env.DB, serverId, actorId, (actorRow?.username as string) || actorId, 'BAN_REVOKED',
    { targetType: 'user', targetId: ban.user_id as string, targetName: targetRow?.username as string }
  );
  return c.json({ ok: true });
});

// ── Kick ──────────────────────────────────────────────────────────────────────
moderation.post('/:serverId/kick', async (c) => {
  const actorId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, actorId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, actorId, 'kickMembers'))) return c.json({ error: 'Missing permission' }, 403);

  const { userId: targetId, reason } = await c.req.json<{ userId?: string; reason?: string }>();
  if (!targetId) return c.json({ error: 'userId required' }, 400);

  const server = await c.env.DB.prepare('SELECT owner_id FROM servers WHERE id = ?').bind(serverId).first();
  if (targetId === actorId) return c.json({ error: 'Cannot kick yourself' }, 400);
  if (targetId === server?.owner_id) return c.json({ error: 'Cannot kick the server owner' }, 400);

  const targetUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(targetId).first();
  if (!targetUser) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM server_members WHERE server_id = ? AND user_id = ?').bind(serverId, targetId),
    c.env.DB.prepare('DELETE FROM role_members WHERE server_id = ? AND user_id = ?').bind(serverId, targetId),
  ]);

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(actorId).first();
  await addAuditLog(c.env.DB, serverId, actorId, (actorRow?.username as string) || actorId, 'MEMBER_KICKED',
    { targetType: 'user', targetId, targetName: targetUser.username as string, details: { reason } }
  );
  return c.json({ ok: true });
});

// ── Mutes / Timeouts ──────────────────────────────────────────────────────────
moderation.get('/:serverId/mutes', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'muteMembers'))) return c.json({ error: 'Missing permission' }, 403);

  const rows = await c.env.DB.prepare(`
    SELECT m.*, u.username, u.avatar_color, mu.username as muted_by_name
    FROM mutes m JOIN users u ON u.id = m.user_id JOIN users mu ON mu.id = m.muted_by
    WHERE m.server_id = ? AND m.active = 1 ORDER BY m.muted_at DESC
  `).bind(serverId).all();

  return c.json({
    mutes: (rows.results || []).map((m: Record<string, unknown>) => ({
      id: m.id, serverId, userId: m.user_id, username: m.username,
      avatarColor: m.avatar_color, reason: m.reason ?? null,
      mutedBy: m.muted_by, mutedByName: m.muted_by_name,
      mutedAt: m.muted_at, expiresAt: m.expires_at ?? null, active: true,
    })),
  });
});

moderation.post('/:serverId/mute', async (c) => {
  const actorId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, actorId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, actorId, 'muteMembers'))) return c.json({ error: 'Missing permission' }, 403);

  const body = await c.req.json<{ userId?: string; reason?: string; duration?: number }>();
  if (!body.userId) return c.json({ error: 'userId required' }, 400);

  const server = await c.env.DB.prepare('SELECT owner_id FROM servers WHERE id = ?').bind(serverId).first();
  if (body.userId === actorId) return c.json({ error: 'Cannot mute yourself' }, 400);
  if (body.userId === server?.owner_id) return c.json({ error: 'Cannot mute the server owner' }, 400);

  const targetUser = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(body.userId).first();
  if (!targetUser) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare('UPDATE mutes SET active = 0 WHERE server_id = ? AND user_id = ? AND active = 1').bind(serverId, body.userId).run();

  const muteId = id();
  const ts = now();
  const expiresAt = body.duration ? ts + body.duration * 1000 : null;
  await c.env.DB.prepare('INSERT INTO mutes (id, server_id, user_id, reason, muted_by, muted_at, expires_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)')
    .bind(muteId, serverId, body.userId, body.reason || null, actorId, ts, expiresAt).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(actorId).first();
  await addAuditLog(c.env.DB, serverId, actorId, (actorRow?.username as string) || actorId, 'MEMBER_MUTED',
    { targetType: 'user', targetId: body.userId, targetName: targetUser.username as string, details: { reason: body.reason, duration: body.duration } }
  );
  return c.json({ ok: true, muteId }, 201);
});

moderation.delete('/:serverId/mutes/:muteId', async (c) => {
  const actorId = c.get('userId');
  const serverId = c.req.param('serverId');
  const muteId = c.req.param('muteId');
  if (!(await isMember(c.env.DB, serverId, actorId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, actorId, 'muteMembers'))) return c.json({ error: 'Missing permission' }, 403);

  const mute = await c.env.DB.prepare('SELECT * FROM mutes WHERE id = ? AND server_id = ?').bind(muteId, serverId).first();
  if (!mute) return c.json({ error: 'Mute not found' }, 404);

  await c.env.DB.prepare('UPDATE mutes SET active = 0 WHERE id = ?').bind(muteId).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(actorId).first();
  const targetRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(mute.user_id).first();
  await addAuditLog(c.env.DB, serverId, actorId, (actorRow?.username as string) || actorId, 'MEMBER_UNMUTED',
    { targetType: 'user', targetId: mute.user_id as string, targetName: targetRow?.username as string }
  );
  return c.json({ ok: true });
});

// ── Audit Log ─────────────────────────────────────────────────────────────────
moderation.get('/:serverId/audit-log', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageServer'))) return c.json({ error: 'Missing permission' }, 403);

  const rows = await c.env.DB.prepare(
    'SELECT * FROM server_audit_log WHERE server_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(serverId).all();

  return c.json({
    entries: (rows.results || []).map((e: Record<string, unknown>) => ({
      id: e.id, serverId: e.server_id, actorId: e.actor_id, actorName: e.actor_name,
      action: e.action, targetType: e.target_type ?? null, targetId: e.target_id ?? null,
      targetName: e.target_name ?? null, details: e.details ?? null, createdAt: e.created_at,
    })),
  });
});

export default moderation;
