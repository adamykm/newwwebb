import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { id, now } from '../../shared/utils';

const media = new Hono<{ Bindings: Env }>();

// Upload sticker
media.post('/stickers/upload', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const name = formData.get('name') as string;
  const server_id = formData.get('server_id') as string;

  if (!file || !name) return c.json({ error: 'Missing file or name' }, 400);

  if (!c.env.R2) return c.json({ error: 'File upload not configured' }, 500);

  const fileName = `stickers/${server_id || 'global'}/${id()}.${file.type.split('/')[1]}`;
  await c.env.R2.put(fileName, file);

  const image_url = `https://cdn.yourdomain.com/${fileName}`;
  const stickerId = id();

  await c.env.DB.prepare(
    'INSERT INTO stickers (id, server_id, user_id, name, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(stickerId, server_id || null, session.userId, name, image_url, now())
    .run();

  return c.json({ stickerId, image_url }, 201);
});

// Get stickers for server or global
media.get('/stickers/:serverId?', async (c) => {
  const { serverId } = c.req.param();

  let query = 'SELECT id, name, image_url FROM stickers WHERE';
  if (serverId) {
    query += ' server_id = ?';
  } else {
    query += ' server_id IS NULL';
  }

  const stickers = await c.env.DB.prepare(query).bind(serverId).all();
  return c.json({ stickers });
});

// Upload emoji
media.post('/emojis/upload', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { server_id, name, image_url } = await c.req.json<{
    server_id?: string;
    name: string;
    image_url: string;
  }>();

  // Check permissions if server emoji
  if (server_id) {
    const member = await c.env.DB.prepare(
      'SELECT role FROM server_member_roles WHERE server_id = ? AND user_id = ?'
    ).bind(server_id, session.userId).first();

    if (!member || !['owner', 'admin'].includes(member.role as string)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
  }

  const emojiId = id();
  await c.env.DB.prepare(
    'INSERT INTO emojis (id, server_id, name, image_url, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(emojiId, server_id || null, name, image_url, now())
    .run();

  return c.json({ emojiId }, 201);
});

// Get emojis
media.get('/emojis/:serverId?', async (c) => {
  const { serverId } = c.req.param();

  let query = 'SELECT id, name, image_url FROM emojis WHERE';
  if (serverId) {
    query += ' server_id = ?';
  } else {
    query += ' server_id IS NULL';
  }

  const emojis = await c.env.DB.prepare(query).bind(serverId).all();
  return c.json({ emojis });
});

// Add reaction to message
media.post('/reactions/add', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { message_id, emoji_id, emoji_text } = await c.req.json<{
    message_id: string;
    emoji_id?: string;
    emoji_text?: string;
  }>();

  if (!emoji_id && !emoji_text) {
    return c.json({ error: 'Emoji ID or text required' }, 400);
  }

  const reactionId = id();
  await c.env.DB.prepare(
    'INSERT INTO message_reactions (id, message_id, user_id, emoji_id, emoji_text, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(reactionId, message_id, session.userId, emoji_id || null, emoji_text || null, now())
    .run();

  return c.json({ reactionId }, 201);
});

// Get reactions for message
media.get('/reactions/:messageId', async (c) => {
  const { messageId } = c.req.param();

  const reactions = await c.env.DB.prepare(`
    SELECT mr.emoji_id, mr.emoji_text, COUNT(*) as count
    FROM message_reactions mr
    WHERE mr.message_id = ?
    GROUP BY COALESCE(mr.emoji_id, mr.emoji_text)
  `)
    .bind(messageId)
    .all();

  return c.json({ reactions });
});

export default media;