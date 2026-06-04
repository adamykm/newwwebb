import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { id, now } from '../../shared/utils';

const dm = new Hono<{ Bindings: Env }>();

// Send direct message
dm.post('/send', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { recipient_id, content } = await c.req.json<{ recipient_id: string; content: string }>();

  if (!content?.trim()) return c.json({ error: 'Message cannot be empty' }, 400);

  const messageId = id();
  await c.env.DB.prepare(
    'INSERT INTO direct_messages (id, sender_id, recipient_id, content, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(messageId, session.userId, recipient_id, content, now())
    .run();

  return c.json({ messageId }, 201);
});

// Get conversation
dm.get('/conversation/:userId', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { userId } = c.req.param();

  const messages = await c.env.DB.prepare(
    `SELECT id, sender_id, recipient_id, content, created_at FROM direct_messages
     WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
     ORDER BY created_at DESC LIMIT 50`
  )
    .bind(session.userId, userId, userId, session.userId)
    .all();

  return c.json({ messages });
});

// Get DM list
dm.get('/list', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const conversations = await c.env.DB.prepare(
    `SELECT DISTINCT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END as other_user_id,
            MAX(created_at) as last_message_at
     FROM direct_messages WHERE sender_id = ? OR recipient_id = ?
     GROUP BY other_user_id ORDER BY last_message_at DESC`
  )
    .bind(session.userId, session.userId, session.userId)
    .all();

  return c.json({ conversations });
});

export default dm;
