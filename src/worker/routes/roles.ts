import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';
import { id, now, hasPermission, addAuditLog } from '../../shared/utils';

type Variables = { session: SessionPayload; userId: string };
const roles = new Hono<{ Bindings: Env; Variables: Variables }>();

async function isMember(db: D1Database, serverId: string, userId: string) {
  return !!(await db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').bind(serverId, userId).first());
}

function rowToRole(r: Record<string, unknown>) {
  return {
    id: r.id, serverId: r.server_id, name: r.name, color: r.color,
    hoist: !!r.hoist, mentionable: !!r.mentionable, position: r.position,
    permissions: (() => { try { return JSON.parse(r.permissions as string); } catch { return {}; } })(),
    createdAt: r.created_at,
  };
}

// ── List roles ────────────────────────────────────────────────────────────────
roles.get('/:serverId/roles', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const rows = await c.env.DB.prepare(
    'SELECT * FROM server_roles WHERE server_id = ? ORDER BY position DESC, created_at ASC'
  ).bind(serverId).all();

  return c.json({ roles: (rows.results || []).map(rowToRole as (r: unknown) => ReturnType<typeof rowToRole>) });
});

// ── Create role ───────────────────────────────────────────────────────────────
roles.post('/:serverId/roles', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageRoles'))) return c.json({ error: 'Missing permission' }, 403);

  const body = await c.req.json<{
    name?: string; color?: string; hoist?: boolean;
    mentionable?: boolean; permissions?: Record<string, boolean>;
  }>();
  if (!body.name?.trim()) return c.json({ error: 'Role name required' }, 400);

  const maxPos = await c.env.DB.prepare('SELECT MAX(position) as mp FROM server_roles WHERE server_id = ?').bind(serverId).first();
  const position = ((maxPos?.mp as number) ?? -1) + 1;
  const roleId = id();
  const ts = now();

  await c.env.DB.prepare(
    'INSERT INTO server_roles (id, server_id, name, color, hoist, mentionable, position, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    roleId, serverId, body.name.trim(),
    body.color || '#99aab5',
    body.hoist ? 1 : 0,
    body.mentionable ? 1 : 0,
    position,
    JSON.stringify(body.permissions || {}),
    ts
  ).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'ROLE_CREATED',
    { targetType: 'role', targetId: roleId, targetName: body.name.trim() }
  );

  const created = await c.env.DB.prepare('SELECT * FROM server_roles WHERE id = ?').bind(roleId).first();
  return c.json({ role: rowToRole(created as Record<string, unknown>) }, 201);
});

// ── Update role ───────────────────────────────────────────────────────────────
roles.patch('/:serverId/roles/:roleId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const roleId = c.req.param('roleId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageRoles'))) return c.json({ error: 'Missing permission' }, 403);

  const existing = await c.env.DB.prepare('SELECT * FROM server_roles WHERE id = ? AND server_id = ?').bind(roleId, serverId).first();
  if (!existing) return c.json({ error: 'Role not found' }, 404);

  const body = await c.req.json<{
    name?: string; color?: string; hoist?: boolean;
    mentionable?: boolean; position?: number; permissions?: Record<string, boolean>;
  }>();

  const updates: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name.trim()); }
  if (body.color !== undefined) { updates.push('color = ?'); params.push(body.color); }
  if (body.hoist !== undefined) { updates.push('hoist = ?'); params.push(body.hoist ? 1 : 0); }
  if (body.mentionable !== undefined) { updates.push('mentionable = ?'); params.push(body.mentionable ? 1 : 0); }
  if (body.position !== undefined) { updates.push('position = ?'); params.push(body.position); }
  if (body.permissions !== undefined) { updates.push('permissions = ?'); params.push(JSON.stringify(body.permissions)); }

  if (updates.length) {
    params.push(roleId);
    await c.env.DB.prepare(`UPDATE server_roles SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'ROLE_UPDATED',
    { targetType: 'role', targetId: roleId, targetName: (body.name || existing.name) as string }
  );

  const updated = await c.env.DB.prepare('SELECT * FROM server_roles WHERE id = ?').bind(roleId).first();
  return c.json({ role: rowToRole(updated as Record<string, unknown>) });
});

// ── Delete role ───────────────────────────────────────────────────────────────
roles.delete('/:serverId/roles/:roleId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const roleId = c.req.param('roleId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageRoles'))) return c.json({ error: 'Missing permission' }, 403);

  const role = await c.env.DB.prepare('SELECT name FROM server_roles WHERE id = ? AND server_id = ?').bind(roleId, serverId).first();
  if (!role) return c.json({ error: 'Role not found' }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM role_members WHERE role_id = ?').bind(roleId),
    c.env.DB.prepare('DELETE FROM server_roles WHERE id = ?').bind(roleId),
  ]);

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'ROLE_DELETED',
    { targetType: 'role', targetId: roleId, targetName: role.name as string }
  );

  return c.json({ ok: true });
});

// ── Assign role to member ─────────────────────────────────────────────────────
roles.post('/:serverId/members/:targetUserId/roles/:roleId', async (c) => {
  const actorId = c.get('userId');
  const { serverId, targetUserId, roleId } = c.req.param();
  if (!(await isMember(c.env.DB, serverId, actorId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, actorId, 'manageRoles'))) return c.json({ error: 'Missing permission' }, 403);

  const role = await c.env.DB.prepare('SELECT name FROM server_roles WHERE id = ? AND server_id = ?').bind(roleId, serverId).first();
  if (!role) return c.json({ error: 'Role not found' }, 404);

  if (!(await isMember(c.env.DB, serverId, targetUserId))) return c.json({ error: 'Target is not a member' }, 404);

  const existing = await c.env.DB.prepare('SELECT 1 FROM role_members WHERE role_id = ? AND user_id = ?').bind(roleId, targetUserId).first();
  if (existing) return c.json({ error: 'Member already has this role' }, 409);

  await c.env.DB.prepare('INSERT INTO role_members (role_id, user_id, server_id, assigned_at) VALUES (?, ?, ?, ?)').bind(roleId, targetUserId, serverId, now()).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(actorId).first();
  const targetRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(targetUserId).first();
  await addAuditLog(c.env.DB, serverId, actorId, (actorRow?.username as string) || actorId, 'ROLE_ASSIGNED',
    { targetType: 'user', targetId: targetUserId, targetName: targetRow?.username as string, details: { roleName: role.name } }
  );

  return c.json({ ok: true });
});

// ── Remove role from member ───────────────────────────────────────────────────
roles.delete('/:serverId/members/:targetUserId/roles/:roleId', async (c) => {
  const actorId = c.get('userId');
  const { serverId, targetUserId, roleId } = c.req.param();
  if (!(await isMember(c.env.DB, serverId, actorId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, actorId, 'manageRoles'))) return c.json({ error: 'Missing permission' }, 403);

  const role = await c.env.DB.prepare('SELECT name FROM server_roles WHERE id = ? AND server_id = ?').bind(roleId, serverId).first();
  if (!role) return c.json({ error: 'Role not found' }, 404);

  await c.env.DB.prepare('DELETE FROM role_members WHERE role_id = ? AND user_id = ?').bind(roleId, targetUserId).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(actorId).first();
  const targetRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(targetUserId).first();
  await addAuditLog(c.env.DB, serverId, actorId, (actorRow?.username as string) || actorId, 'ROLE_REMOVED',
    { targetType: 'user', targetId: targetUserId, targetName: targetRow?.username as string, details: { roleName: role.name } }
  );

  return c.json({ ok: true });
});

export default roles;
