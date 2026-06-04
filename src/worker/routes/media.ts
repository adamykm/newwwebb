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

  if (!file || !name) return c.json({ error: 'Missing file or name' }, 400);

  const stickerId = id();
  const image_url = `https://cdn.example.com/stickers/${stickerId}`;

  await c.env.DB.prepare(
    'INSERT INTO stickers (id, user_id, name, image_url, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(stickerId, session.userId, name, image_url, now())
    .run();

  return c.json({ stickerId, image_url }, 201);
});

// Get stickers
media.get('/stickers', async (c) => {
  const stickers = await c.env.DB.prepare('SELECT id, name, image_url FROM stickers LIMIT 100').all();
  return c.json({ stickers });
});

// Upload emoji
media.post('/emojis/upload', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { name, image_url } = await c.req.json<{ name: string; image_url: string }>();

  const emojiId = id();
  await c.env.DB.prepare('INSERT INTO emojis (id, name, image_url, created_at) VALUES (?, ?, ?, ?)')
    .bind(emojiId, name, image_url, now())
    .run();

  return c.json({ emojiId }, 201);
});

// Get emojis
media.get('/emojis', async (c) => {
  const emojis = await c.env.DB.prepare('SELECT id, name, image_url FROM emojis LIMIT 100').all();
  return c.json({ emojis });
});

// Add reaction
media.post('/reactions/add', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { message_id, emoji_text } = await c.req.json<{ message_id: string; emoji_text: string }>();

  const reactionId = id();
  await c.env.DB.prepare(
    'INSERT INTO message_reactions (id, message_id, user_id, emoji_text, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(reactionId, message_id, session.userId, emoji_text, now())
    .run();

  return c.json({ reactionId }, 201);
});

// Get reactions
media.get('/reactions/:messageId', async (c) => {
  const { messageId } = c.req.param();
  const reactions = await c.env.DB.prepare(
    'SELECT emoji_text, COUNT(*) as count FROM message_reactions WHERE message_id = ? GROUP BY emoji_text'
  )
    .bind(messageId)
    .all();

  return c.json({ reactions });
});

export default media;
