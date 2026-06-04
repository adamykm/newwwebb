import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { id, now } from '../../shared/utils';

const voice = new Hono<{ Bindings: Env }>();

// Create voice channel
voice.post('/channels', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { server_id, name } = await c.req.json<{ server_id: string; name: string }>();

  const channelId = id();
  await c.env.DB.prepare(
    'INSERT INTO voice_channels (id, server_id, name, bitrate, user_limit, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(channelId, server_id, name, 64, 0, now())
    .run();

  return c.json({ channelId }, 201);
});

// Get voice channels in server
voice.get('/channels/:serverId', async (c) => {
  const { serverId } = c.req.param();

  const channels = await c.env.DB.prepare(
    'SELECT id, name, bitrate, user_limit, created_at FROM voice_channels WHERE server_id = ? ORDER BY created_at'
  )
    .bind(serverId)
    .all();

  return c.json({ channels });
});

// Join voice channel
voice.post('/join', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { channel_id } = await c.req.json<{ channel_id: string }>();

  const sessionId = id();
  await c.env.DB.prepare('INSERT INTO voice_sessions (id, channel_id, user_id, joined_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, channel_id, session.userId, now())
    .run();

  return c.json({ sessionId }, 201);
});

// Leave voice channel
voice.post('/leave/:sessionId', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { sessionId } = c.req.param();

  await c.env.DB.prepare('UPDATE voice_sessions SET left_at = ? WHERE id = ? AND user_id = ?')
    .bind(now(), sessionId, session.userId)
    .run();

  return c.json({ ok: true });
});

// Get active users in channel
voice.get('/active/:channelId', async (c) => {
  const { channelId } = c.req.param();

  const users = await c.env.DB.prepare(
    `SELECT u.id, u.username FROM voice_sessions vs
     JOIN users u ON u.id = vs.user_id
     WHERE vs.channel_id = ? AND vs.left_at IS NULL`
  )
    .bind(channelId)
    .all();

  return c.json({ users });
});

export default voice;
