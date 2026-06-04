import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';
import { id, now, inviteCode, hasPermission, addAuditLog } from '../../shared/utils';

type Variables = { session: SessionPayload; userId: string };
const servers = new Hono<{ Bindings: Env; Variables: Variables }>();

async function isMember(db: D1Database, serverId: string, userId: string) {
  const row = await db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').bind(serverId, userId).first();
  return !!row;
}

async function isOwner(db: D1Database, serverId: string, userId: string) {
  const row = await db.prepare('SELECT 1 FROM servers WHERE id = ? AND owner_id = ?').bind(serverId, userId).first();
  return !!row;
}

function rowToChannel(ch: Record<string, unknown>) {
  return {
    id: ch.id, serverId: ch.server_id, name: ch.name,
    type: ch.type || 'text', categoryId: ch.category_id ?? null,
    position: ch.position ?? 0, createdAt: ch.created_at,
  };
}

// ── List servers ──────────────────────────────────────────────────────────────
servers.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(`
    SELECT s.*, COUNT(sm.user_id) as member_count
    FROM servers s
    INNER JOIN server_members sm ON sm.server_id = s.id
    WHERE sm.user_id = ?
    GROUP BY s.id ORDER BY s.created_at DESC
  `).bind(userId).all();
  return c.json({
    servers: (rows.results || []).map((r: Record<string, unknown>) => ({
      id: r.id, name: r.name, description: r.description, iconColor: r.icon_color,
      iconUrl: r.icon_url ?? null, ownerId: r.owner_id, inviteCode: r.invite_code,
      customInvite: r.custom_invite ?? null, isDiscoverable: !!r.is_discoverable,
      createdAt: r.created_at, memberCount: r.member_count,
    })),
  });
});

// ── Create server ─────────────────────────────────────────────────────────────
servers.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ name?: string; description?: string }>();
  if (!body.name?.trim()) return c.json({ error: 'Server name required' }, 400);

  const serverId = id();
  const code = inviteCode();
  const ts = now();
  const colors = ['#5865f2', '#57f287', '#eb459e', '#fee75c', '#ed4245'];
  const iconColor = colors[Math.floor(Math.random() * colors.length)];

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO servers (id, name, description, icon_color, owner_id, invite_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(serverId, body.name.trim(), body.description || '', iconColor, userId, code, ts),
    c.env.DB.prepare('INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)').bind(serverId, userId, ts),
    c.env.DB.prepare('INSERT INTO channels (id, server_id, name, created_at) VALUES (?, ?, ?, ?)').bind(id(), serverId, 'general', ts),
  ]);

  const row = await c.env.DB.prepare('SELECT * FROM servers WHERE id = ?').bind(serverId).first();
  return c.json({
    server: {
      id: row!.id, name: row!.name, description: row!.description, iconColor: row!.icon_color,
      iconUrl: null, ownerId: row!.owner_id, inviteCode: row!.invite_code,
      customInvite: null, isDiscoverable: false, createdAt: row!.created_at, memberCount: 1,
    },
  }, 201);
});

// ── Join server ───────────────────────────────────────────────────────────────
servers.post('/join', async (c) => {
  const userId = c.get('userId');
  const { inviteCode: code } = await c.req.json<{ inviteCode?: string }>();
  if (!code?.trim()) return c.json({ error: 'Invite code required' }, 400);

  const clean = code.trim().toLowerCase();
  const server = await c.env.DB.prepare(
    'SELECT * FROM servers WHERE invite_code = ? OR custom_invite = ?'
  ).bind(clean, clean).first();
  if (!server) return c.json({ error: 'Invalid invite code' }, 404);

  const banned = await c.env.DB.prepare(
    'SELECT id FROM bans WHERE server_id = ? AND user_id = ? AND (expires_at IS NULL OR expires_at > ?)'
  ).bind(server.id, userId, now()).first();
  if (banned) return c.json({ error: 'You are banned from this server' }, 403);

  const already = await isMember(c.env.DB, server.id as string, userId);
  if (already) return c.json({ error: 'Already a member' }, 409);

  await c.env.DB.prepare('INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)').bind(server.id, userId, now()).run();
  return c.json({ ok: true, serverId: server.id });
});

// ── Get server ────────────────────────────────────────────────────────────────
servers.get('/:serverId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const server = await c.env.DB.prepare('SELECT * FROM servers WHERE id = ?').bind(serverId).first();
  if (!server) return c.json({ error: 'Not found' }, 404);

  const categories = await c.env.DB.prepare(
    'SELECT * FROM channel_categories WHERE server_id = ? ORDER BY position ASC, created_at ASC'
  ).bind(serverId).all();

  const channels = await c.env.DB.prepare(
    'SELECT * FROM channels WHERE server_id = ? ORDER BY position ASC, created_at ASC'
  ).bind(serverId).all();

  const voiceChannels = await c.env.DB.prepare(
    'SELECT vc.*, GROUP_CONCAT(u.id||"|||"||u.username||"|||"||u.avatar_color||"|||"||vs.joined_at, ":::") as parts FROM voice_channels vc LEFT JOIN voice_sessions vs ON vs.channel_id = vc.id AND vs.left_at IS NULL LEFT JOIN users u ON u.id = vs.user_id WHERE vc.server_id = ? GROUP BY vc.id ORDER BY vc.created_at ASC'
  ).bind(serverId).all();

  const roles = await c.env.DB.prepare(
    'SELECT * FROM server_roles WHERE server_id = ? ORDER BY position DESC, created_at ASC'
  ).bind(serverId).all();

  const members = await c.env.DB.prepare(`
    SELECT u.id as user_id, u.username, u.display_name, u.avatar_color, u.avatar_url, u.status, sm.joined_at
    FROM server_members sm JOIN users u ON u.id = sm.user_id
    WHERE sm.server_id = ? ORDER BY sm.joined_at
  `).bind(serverId).all();

  const memberRoles = await c.env.DB.prepare(
    'SELECT rm.user_id, rm.role_id FROM role_members rm WHERE rm.server_id = ?'
  ).bind(serverId).all();

  const roleMap: Record<string, string[]> = {};
  for (const mr of (memberRoles.results || []) as Record<string, unknown>[]) {
    const uid = mr.user_id as string;
    if (!roleMap[uid]) roleMap[uid] = [];
    roleMap[uid].push(mr.role_id as string);
  }

  const rolesById: Record<string, Record<string, unknown>> = {};
  for (const r of (roles.results || []) as Record<string, unknown>[]) {
    rolesById[r.id as string] = r;
  }

  const mutes = await c.env.DB.prepare(
    'SELECT user_id FROM mutes WHERE server_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)'
  ).bind(serverId, now()).all();
  const mutedUsers = new Set((mutes.results || []).map((m: Record<string, unknown>) => m.user_id as string));

  return c.json({
    server: {
      id: server.id, name: server.name, description: server.description,
      iconColor: server.icon_color, iconUrl: server.icon_url ?? null,
      ownerId: server.owner_id, inviteCode: server.invite_code,
      customInvite: server.custom_invite ?? null,
      isDiscoverable: !!server.is_discoverable,
      discoveryCategory: server.discovery_category ?? null,
      createdAt: server.created_at,
    },
    categories: (categories.results || []).map((cat: Record<string, unknown>) => ({
      id: cat.id, serverId: cat.server_id, name: cat.name,
      position: cat.position, createdAt: cat.created_at,
    })),
    channels: (channels.results || []).map(rowToChannel),
    voiceChannels: (voiceChannels.results || []).map((vc: Record<string, unknown>) => {
      const participants: { userId: string; username: string; avatarColor: string; joinedAt: number }[] = [];
      if (vc.parts) {
        const parts = (vc.parts as string).split(':::');
        for (const p of parts) {
          const [uid, uname, ac, jat] = p.split('|||');
          if (uid && uname) participants.push({ userId: uid, username: uname, avatarColor: ac, joinedAt: Number(jat) });
        }
      }
      return { id: vc.id, serverId: vc.server_id, name: vc.name, categoryId: vc.category_id ?? null, bitrate: vc.bitrate ?? 64, userLimit: vc.user_limit ?? 0, position: vc.position ?? 0, createdAt: vc.created_at, participants };
    }),
    roles: (roles.results || []).map((r: Record<string, unknown>) => ({
      id: r.id, serverId: r.server_id, name: r.name, color: r.color,
      hoist: !!r.hoist, mentionable: !!r.mentionable, position: r.position,
      permissions: (() => { try { return JSON.parse(r.permissions as string); } catch { return {}; } })(),
      createdAt: r.created_at,
    })),
    members: (members.results || []).map((m: Record<string, unknown>) => {
      const uid = m.user_id as string;
      const memberRoleIds = roleMap[uid] || [];
      const memberRoleObjects = memberRoleIds.map((rid) => rolesById[rid]).filter(Boolean).map((r) => ({
        id: r.id, name: r.name, color: r.color, hoist: !!r.hoist, position: r.position,
      }));
      return {
        userId: uid, username: m.username, displayName: m.display_name ?? null,
        avatarColor: m.avatar_color, avatarUrl: m.avatar_url ?? null,
        status: m.status || 'online', joinedAt: m.joined_at,
        roles: memberRoleObjects, isMuted: mutedUsers.has(uid),
      };
    }),
  });
});

// ── Update server settings ───────────────────────────────────────────────────
servers.patch('/:serverId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageServer'))) return c.json({ error: 'Missing permission' }, 403);

  const body = await c.req.json<{
    name?: string; description?: string; iconColor?: string; iconUrl?: string;
    customInvite?: string; isDiscoverable?: boolean; discoveryCategory?: string;
  }>();

  const server = await c.env.DB.prepare('SELECT * FROM servers WHERE id = ?').bind(serverId).first();
  if (!server) return c.json({ error: 'Not found' }, 404);

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  const actorName = (actorRow?.username as string) || userId;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name.trim()); }
  if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
  if (body.iconColor !== undefined) { updates.push('icon_color = ?'); params.push(body.iconColor); }
  if (body.iconUrl !== undefined) { updates.push('icon_url = ?'); params.push(body.iconUrl || null); }
  if (body.customInvite !== undefined) {
    const ci = body.customInvite.trim().toLowerCase();
    if (ci) {
      const existing = await c.env.DB.prepare('SELECT id FROM servers WHERE custom_invite = ? AND id != ?').bind(ci, serverId).first();
      if (existing) return c.json({ error: 'Custom invite already taken' }, 409);
      updates.push('custom_invite = ?'); params.push(ci);
    } else {
      updates.push('custom_invite = ?'); params.push(null);
    }
  }
  if (body.isDiscoverable !== undefined) { updates.push('is_discoverable = ?'); params.push(body.isDiscoverable ? 1 : 0); }
  if (body.discoveryCategory !== undefined) { updates.push('discovery_category = ?'); params.push(body.discoveryCategory || null); }

  if (updates.length) {
    params.push(serverId);
    await c.env.DB.prepare(`UPDATE servers SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    await addAuditLog(c.env.DB, serverId, userId, actorName, 'SERVER_UPDATED', { details: body });
  }

  const updated = await c.env.DB.prepare('SELECT * FROM servers WHERE id = ?').bind(serverId).first();
  return c.json({
    server: {
      id: updated!.id, name: updated!.name, description: updated!.description,
      iconColor: updated!.icon_color, iconUrl: updated!.icon_url ?? null,
      ownerId: updated!.owner_id, inviteCode: updated!.invite_code,
      customInvite: updated!.custom_invite ?? null,
      isDiscoverable: !!updated!.is_discoverable,
      discoveryCategory: updated!.discovery_category ?? null,
      createdAt: updated!.created_at,
    },
  });
});

// ── Delete server ─────────────────────────────────────────────────────────────
servers.delete('/:serverId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isOwner(c.env.DB, serverId, userId))) return c.json({ error: 'Only the owner can delete this server' }, 403);
  await c.env.DB.prepare('DELETE FROM servers WHERE id = ?').bind(serverId).run();
  return c.json({ ok: true });
});

// ── Categories ────────────────────────────────────────────────────────────────
servers.get('/:serverId/categories', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  const rows = await c.env.DB.prepare('SELECT * FROM channel_categories WHERE server_id = ? ORDER BY position ASC, created_at ASC').bind(serverId).all();
  return c.json({
    categories: (rows.results || []).map((r: Record<string, unknown>) => ({
      id: r.id, serverId: r.server_id, name: r.name, position: r.position, createdAt: r.created_at,
    })),
  });
});

servers.post('/:serverId/categories', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageChannels'))) return c.json({ error: 'Missing permission' }, 403);

  const { name } = await c.req.json<{ name?: string }>();
  if (!name?.trim()) return c.json({ error: 'Category name required' }, 400);

  const maxPos = await c.env.DB.prepare('SELECT MAX(position) as mp FROM channel_categories WHERE server_id = ?').bind(serverId).first();
  const position = ((maxPos?.mp as number) ?? -1) + 1;
  const catId = id();
  const ts = now();
  await c.env.DB.prepare('INSERT INTO channel_categories (id, server_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)').bind(catId, serverId, name.trim(), position, ts).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'CATEGORY_CREATED', { targetType: 'category', targetId: catId, targetName: name.trim() });

  return c.json({ category: { id: catId, serverId, name: name.trim(), position, createdAt: ts } }, 201);
});

servers.patch('/:serverId/categories/:catId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const catId = c.req.param('catId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageChannels'))) return c.json({ error: 'Missing permission' }, 403);

  const { name, position } = await c.req.json<{ name?: string; position?: number }>();
  const updates: string[] = [];
  const params: unknown[] = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
  if (position !== undefined) { updates.push('position = ?'); params.push(position); }
  if (!updates.length) return c.json({ error: 'Nothing to update' }, 400);
  params.push(catId, serverId);
  await c.env.DB.prepare(`UPDATE channel_categories SET ${updates.join(', ')} WHERE id = ? AND server_id = ?`).bind(...params).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'CATEGORY_UPDATED', { targetType: 'category', targetId: catId, targetName: name });

  const updated = await c.env.DB.prepare('SELECT * FROM channel_categories WHERE id = ?').bind(catId).first();
  return c.json({ category: { id: updated!.id, serverId: updated!.server_id, name: updated!.name, position: updated!.position, createdAt: updated!.created_at } });
});

servers.delete('/:serverId/categories/:catId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const catId = c.req.param('catId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageChannels'))) return c.json({ error: 'Missing permission' }, 403);

  const cat = await c.env.DB.prepare('SELECT name FROM channel_categories WHERE id = ? AND server_id = ?').bind(catId, serverId).first();
  if (!cat) return c.json({ error: 'Not found' }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE channels SET category_id = NULL WHERE category_id = ?').bind(catId),
    c.env.DB.prepare('UPDATE voice_channels SET category_id = NULL WHERE category_id = ?').bind(catId),
    c.env.DB.prepare('DELETE FROM channel_categories WHERE id = ?').bind(catId),
  ]);

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'CATEGORY_DELETED', { targetType: 'category', targetId: catId, targetName: cat.name as string });

  return c.json({ ok: true });
});

// ── Text Channels ─────────────────────────────────────────────────────────────
servers.post('/:serverId/channels', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageChannels'))) return c.json({ error: 'Missing permission' }, 403);

  const body = await c.req.json<{ name?: string; categoryId?: string | null; type?: string }>();
  if (!body.name?.trim()) return c.json({ error: 'Channel name required' }, 400);

  const maxPos = await c.env.DB.prepare('SELECT MAX(position) as mp FROM channels WHERE server_id = ?').bind(serverId).first();
  const position = ((maxPos?.mp as number) ?? -1) + 1;
  const chanId = id();
  const ts = now();
  await c.env.DB.prepare(
    'INSERT INTO channels (id, server_id, name, type, category_id, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(chanId, serverId, body.name.trim().toLowerCase().replace(/\s+/g, '-'), body.type || 'text', body.categoryId || null, position, ts).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'CHANNEL_CREATED', { targetType: 'channel', targetId: chanId, targetName: body.name.trim() });

  const ch = await c.env.DB.prepare('SELECT * FROM channels WHERE id = ?').bind(chanId).first();
  return c.json({ channel: rowToChannel(ch as Record<string, unknown>) }, 201);
});

servers.patch('/:serverId/channels/:channelId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const channelId = c.req.param('channelId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageChannels'))) return c.json({ error: 'Missing permission' }, 403);

  const body = await c.req.json<{ name?: string; categoryId?: string | null; position?: number }>();
  const updates: string[] = [];
  const params: unknown[] = [];
  if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name.trim().toLowerCase().replace(/\s+/g, '-')); }
  if (body.categoryId !== undefined) { updates.push('category_id = ?'); params.push(body.categoryId || null); }
  if (body.position !== undefined) { updates.push('position = ?'); params.push(body.position); }
  if (!updates.length) return c.json({ error: 'Nothing to update' }, 400);
  params.push(channelId, serverId);
  await c.env.DB.prepare(`UPDATE channels SET ${updates.join(', ')} WHERE id = ? AND server_id = ?`).bind(...params).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'CHANNEL_UPDATED', { targetType: 'channel', targetId: channelId });

  const ch = await c.env.DB.prepare('SELECT * FROM channels WHERE id = ?').bind(channelId).first();
  return c.json({ channel: rowToChannel(ch as Record<string, unknown>) });
});

servers.delete('/:serverId/channels/:channelId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const channelId = c.req.param('channelId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageChannels'))) return c.json({ error: 'Missing permission' }, 403);

  const ch = await c.env.DB.prepare('SELECT name FROM channels WHERE id = ? AND server_id = ?').bind(channelId, serverId).first();
  if (!ch) return c.json({ error: 'Not found' }, 404);

  const count = await c.env.DB.prepare('SELECT COUNT(*) as n FROM channels WHERE server_id = ?').bind(serverId).first();
  if ((count?.n as number) <= 1) return c.json({ error: 'Cannot delete the last channel' }, 400);

  await c.env.DB.prepare('DELETE FROM channels WHERE id = ?').bind(channelId).run();
  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'CHANNEL_DELETED', { targetType: 'channel', targetId: channelId, targetName: ch.name as string });

  return c.json({ ok: true });
});

// ── Voice Channels ────────────────────────────────────────────────────────────
servers.post('/:serverId/voice', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageChannels'))) return c.json({ error: 'Missing permission' }, 403);

  const body = await c.req.json<{ name?: string; categoryId?: string | null; userLimit?: number }>();
  if (!body.name?.trim()) return c.json({ error: 'Voice channel name required' }, 400);

  const vcId = id();
  const ts = now();
  await c.env.DB.prepare(
    'INSERT INTO voice_channels (id, server_id, name, category_id, bitrate, user_limit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(vcId, serverId, body.name.trim(), body.categoryId || null, 64, body.userLimit ?? 0, ts).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'VOICE_CHANNEL_CREATED', { targetType: 'voice_channel', targetId: vcId, targetName: body.name.trim() });

  return c.json({ voiceChannel: { id: vcId, serverId, name: body.name.trim(), categoryId: body.categoryId || null, bitrate: 64, userLimit: body.userLimit ?? 0, position: 0, createdAt: ts, participants: [] } }, 201);
});

servers.delete('/:serverId/voice/:vcId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const vcId = c.req.param('vcId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);
  if (!(await hasPermission(c.env.DB, serverId, userId, 'manageChannels'))) return c.json({ error: 'Missing permission' }, 403);

  const vc = await c.env.DB.prepare('SELECT name FROM voice_channels WHERE id = ? AND server_id = ?').bind(vcId, serverId).first();
  if (!vc) return c.json({ error: 'Not found' }, 404);
  await c.env.DB.prepare('DELETE FROM voice_channels WHERE id = ?').bind(vcId).run();

  const actorRow = await c.env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(userId).first();
  await addAuditLog(c.env.DB, serverId, userId, (actorRow?.username as string) || userId, 'VOICE_CHANNEL_DELETED', { targetType: 'voice_channel', targetId: vcId, targetName: vc.name as string });

  return c.json({ ok: true });
});

servers.post('/:serverId/voice/:vcId/join', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const vcId = c.req.param('vcId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const vc = await c.env.DB.prepare('SELECT * FROM voice_channels WHERE id = ? AND server_id = ?').bind(vcId, serverId).first();
  if (!vc) return c.json({ error: 'Voice channel not found' }, 404);

  if ((vc.user_limit as number) > 0) {
    const count = await c.env.DB.prepare('SELECT COUNT(*) as n FROM voice_sessions WHERE channel_id = ? AND left_at IS NULL').bind(vcId).first();
    if ((count?.n as number) >= (vc.user_limit as number)) return c.json({ error: 'Voice channel is full' }, 400);
  }

  await c.env.DB.prepare('UPDATE voice_sessions SET left_at = ? WHERE channel_id = ? AND user_id = ? AND left_at IS NULL').bind(now(), vcId, userId).run();
  const sessionId = id();
  await c.env.DB.prepare('INSERT INTO voice_sessions (id, channel_id, user_id, joined_at) VALUES (?, ?, ?, ?)').bind(sessionId, vcId, userId, now()).run();

  const participants = await c.env.DB.prepare(`
    SELECT vs.user_id, u.username, u.avatar_color, vs.joined_at FROM voice_sessions vs
    JOIN users u ON u.id = vs.user_id WHERE vs.channel_id = ? AND vs.left_at IS NULL
  `).bind(vcId).all();

  return c.json({
    sessionId,
    participants: (participants.results || []).map((p: Record<string, unknown>) => ({
      userId: p.user_id, username: p.username, avatarColor: p.avatar_color, joinedAt: p.joined_at,
    })),
  });
});

servers.post('/:serverId/voice/:vcId/leave', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const vcId = c.req.param('vcId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  await c.env.DB.prepare('UPDATE voice_sessions SET left_at = ? WHERE channel_id = ? AND user_id = ? AND left_at IS NULL').bind(now(), vcId, userId).run();
  await c.env.DB.prepare('DELETE FROM voice_signals WHERE channel_id = ? AND from_user_id = ?').bind(vcId, userId).run();
  return c.json({ ok: true });
});

servers.get('/:serverId/voice/:vcId/participants', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const vcId = c.req.param('vcId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const participants = await c.env.DB.prepare(`
    SELECT vs.user_id, u.username, u.avatar_color, vs.joined_at FROM voice_sessions vs
    JOIN users u ON u.id = vs.user_id WHERE vs.channel_id = ? AND vs.left_at IS NULL
  `).bind(vcId).all();

  return c.json({
    participants: (participants.results || []).map((p: Record<string, unknown>) => ({
      userId: p.user_id, username: p.username, avatarColor: p.avatar_color, joinedAt: p.joined_at,
    })),
  });
});

// WebRTC signaling
servers.get('/:serverId/voice/:vcId/signals', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const vcId = c.req.param('vcId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const since = c.req.query('since');
  let query = 'SELECT * FROM voice_signals WHERE channel_id = ? AND (to_user_id IS NULL OR to_user_id = ?) AND from_user_id != ?';
  const params: unknown[] = [vcId, userId, userId];
  if (since) { query += ' AND created_at > ?'; params.push(Number(since)); }
  query += ' ORDER BY created_at ASC LIMIT 50';

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({
    signals: (rows.results || []).map((s: Record<string, unknown>) => ({
      id: s.id, fromUserId: s.from_user_id, toUserId: s.to_user_id,
      type: s.type, data: s.data, createdAt: s.created_at,
    })),
  });
});

servers.post('/:serverId/voice/:vcId/signal', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  const vcId = c.req.param('vcId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ type: string; data: string; toUserId?: string }>();
  if (!body.type || !body.data) return c.json({ error: 'type and data required' }, 400);

  const sigId = id();
  await c.env.DB.prepare(
    'INSERT INTO voice_signals (id, channel_id, from_user_id, to_user_id, type, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(sigId, vcId, userId, body.toUserId || null, body.type, body.data, now()).run();

  // Clean up old signals (>30 seconds)
  await c.env.DB.prepare('DELETE FROM voice_signals WHERE channel_id = ? AND created_at < ?').bind(vcId, now() - 30000).run();

  return c.json({ ok: true, id: sigId });
});

// ── Messages ──────────────────────────────────────────────────────────────────
servers.get('/:serverId/channels/:channelId/messages', async (c) => {
  const userId = c.get('userId');
  const { serverId, channelId } = c.req.param();
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const channel = await c.env.DB.prepare('SELECT * FROM channels WHERE id = ? AND server_id = ?').bind(channelId, serverId).first();
  if (!channel) return c.json({ error: 'Channel not found' }, 404);

  const isMuted = await c.env.DB.prepare(
    'SELECT id FROM mutes WHERE server_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)'
  ).bind(serverId, userId, now()).first();

  const since = c.req.query('since');
  let query = `
    SELECT m.*, u.username, u.display_name, u.avatar_color FROM messages m
    JOIN users u ON u.id = m.user_id WHERE m.channel_id = ?
  `;
  const params: (string | number)[] = [channelId];
  if (since) { query += ' AND m.created_at > ?'; params.push(Number(since)); }
  query += ' ORDER BY m.created_at ASC LIMIT 100';

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({
    messages: (rows.results || []).map((m: Record<string, unknown>) => ({
      id: m.id, channelId: m.channel_id, userId: m.user_id, content: m.content,
      createdAt: m.created_at, username: m.username, displayName: m.display_name ?? null, avatarColor: m.avatar_color,
    })),
    isMuted: !!isMuted,
  });
});

servers.post('/:serverId/channels/:channelId/messages', async (c) => {
  const userId = c.get('userId');
  const { serverId, channelId } = c.req.param();
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const isMuted = await c.env.DB.prepare(
    'SELECT id FROM mutes WHERE server_id = ? AND user_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)'
  ).bind(serverId, userId, now()).first();
  if (isMuted) return c.json({ error: 'You are muted in this server' }, 403);

  const senderRow = await c.env.DB.prepare('SELECT global_timeout_until FROM users WHERE id = ?').bind(userId).first();
  if (senderRow?.global_timeout_until && (senderRow.global_timeout_until as number) > now()) {
    const remaining = Math.ceil(((senderRow.global_timeout_until as number) - now()) / 60000);
    return c.json({ error: `You are in a global timeout. ${remaining} minute(s) remaining.` }, 403);
  }

  const channel = await c.env.DB.prepare('SELECT * FROM channels WHERE id = ? AND server_id = ?').bind(channelId, serverId).first();
  if (!channel) return c.json({ error: 'Channel not found' }, 404);

  const { content } = await c.req.json<{ content?: string }>();
  if (!content?.trim()) return c.json({ error: 'Message required' }, 400);
  if (content.length > 2000) return c.json({ error: 'Message too long' }, 400);

  const messageId = id();
  const ts = now();
  await c.env.DB.prepare(
    'INSERT INTO messages (id, channel_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(messageId, channelId, userId, content.trim(), ts).run();

  const user = await c.env.DB.prepare('SELECT username, display_name, avatar_color FROM users WHERE id = ?').bind(userId).first();
  return c.json({
    message: {
      id: messageId, channelId, userId, content: content.trim(), createdAt: ts,
      username: user!.username, displayName: (user!.display_name as string | null) ?? null, avatarColor: user!.avatar_color,
    },
  }, 201);
});

export default servers;
