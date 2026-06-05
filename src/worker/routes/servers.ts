import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';
import { id, now, inviteCode } from '../../shared/utils';

type Variables = { session: SessionPayload; userId: string };

const servers = new Hono<{ Bindings: Env; Variables: Variables }>();

async function isMember(db: D1Database, serverId: string, userId: string) {
  const row = await db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').bind(serverId, userId).first();
  return !!row;
}

servers.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(`
    SELECT s.*, COUNT(sm.user_id) as member_count
    FROM servers s
    INNER JOIN server_members sm ON sm.server_id = s.id
    WHERE sm.user_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).bind(userId).all();
  return c.json({
    servers: (rows.results || []).map((r: Record<string, unknown>) => ({
      id: r.id, name: r.name, description: r.description, iconColor: r.icon_color,
      ownerId: r.owner_id, inviteCode: r.invite_code, createdAt: r.created_at, memberCount: r.member_count,
    })),
  });
});

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
      ownerId: row!.owner_id, inviteCode: row!.invite_code, createdAt: row!.created_at, memberCount: 1,
    },
  }, 201);
});

servers.post('/join', async (c) => {
  const userId = c.get('userId');
  const { inviteCode: code } = await c.req.json<{ inviteCode?: string }>();
  if (!code?.trim()) return c.json({ error: 'Invite code required' }, 400);

  const server = await c.env.DB.prepare('SELECT * FROM servers WHERE invite_code = ?').bind(code.trim().toLowerCase()).first();
  if (!server) return c.json({ error: 'Invalid invite code' }, 404);

  const already = await isMember(c.env.DB, server.id as string, userId);
  if (already) return c.json({ error: 'Already a member' }, 409);

  await c.env.DB.prepare('INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)').bind(server.id, userId, now()).run();
  return c.json({ ok: true, serverId: server.id });
});

servers.get('/:serverId', async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('serverId');
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const server = await c.env.DB.prepare('SELECT * FROM servers WHERE id = ?').bind(serverId).first();
  const channels = await c.env.DB.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY created_at').bind(serverId).all();
  const members = await c.env.DB.prepare(`
    SELECT u.id as user_id, u.username, u.avatar_color, sm.joined_at
    FROM server_members sm JOIN users u ON u.id = sm.user_id
    WHERE sm.server_id = ? ORDER BY sm.joined_at
  `).bind(serverId).all();

  return c.json({
    server: {
      id: server!.id, name: server!.name, description: server!.description, iconColor: server!.icon_color,
      ownerId: server!.owner_id, inviteCode: server!.invite_code, createdAt: server!.created_at,
    },
    channels: (channels.results || []).map((ch: Record<string, unknown>) => ({ id: ch.id, serverId: ch.server_id, name: ch.name, createdAt: ch.created_at })),
    members: (members.results || []).map((m: Record<string, unknown>) => ({
      userId: m.user_id, username: m.username, avatarColor: m.avatar_color, joinedAt: m.joined_at,
    })),
  });
});

// Messages
servers.get('/:serverId/channels/:channelId/messages', async (c) => {
  const userId = c.get('userId');
  const { serverId, channelId } = c.req.param();
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

  const channel = await c.env.DB.prepare('SELECT * FROM channels WHERE id = ? AND server_id = ?').bind(channelId, serverId).first();
  if (!channel) return c.json({ error: 'Channel not found' }, 404);

  const since = c.req.query('since');
  let query = `
    SELECT m.*, u.username, u.avatar_color FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = ?
  `;
  const params: (string | number)[] = [channelId];
  if (since) {
    query += ' AND m.created_at > ?';
    params.push(Number(since));
  }
  query += ' ORDER BY m.created_at ASC LIMIT 100';

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({
    messages: (rows.results || []).map((m: Record<string, unknown>) => ({
      id: m.id, channelId: m.channel_id, userId: m.user_id, content: m.content,
      createdAt: m.created_at, username: m.username, avatarColor: m.avatar_color,
    })),
  });
});

servers.post('/:serverId/channels/:channelId/messages', async (c) => {
  const userId = c.get('userId');
  const { serverId, channelId } = c.req.param();
  if (!(await isMember(c.env.DB, serverId, userId))) return c.json({ error: 'Forbidden' }, 403);

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

  const user = await c.env.DB.prepare('SELECT username, avatar_color FROM users WHERE id = ?').bind(userId).first();
  return c.json({
    message: {
      id: messageId, channelId, userId, content: content.trim(), createdAt: ts,
      username: user!.username, avatarColor: user!.avatar_color,
    },
  }, 201);
});

export default servers;
