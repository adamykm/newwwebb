import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { id, now } from '../../shared/utils';

const friends = new Hono<{ Bindings: Env }>();

// Send friend request
friends.post('/request', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { recipient_id } = await c.req.json<{ recipient_id: string }>();

  if (recipient_id === session.userId) return c.json({ error: 'Cannot friend yourself' }, 400);

  const friendId = id();
  await c.env.DB.prepare(
    'INSERT INTO friends (id, user_id_1, user_id_2, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(friendId, session.userId, recipient_id, 'pending', now(), now())
    .run();

  return c.json({ friendId }, 201);
});

// Accept friend request
friends.post('/accept', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { friend_id } = await c.req.json<{ friend_id: string }>();

  await c.env.DB.prepare('UPDATE friends SET status = ?, updated_at = ? WHERE id = ?')
    .bind('accepted', now(), friend_id)
    .run();

  return c.json({ ok: true });
});

// Get friends list
friends.get('/list', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await c.env.DB.prepare(
    `SELECT f.id, f.user_id_1, f.user_id_2, f.status, u.username FROM friends f
     JOIN users u ON (f.user_id_1 = ? AND u.id = f.user_id_2) OR (f.user_id_2 = ? AND u.id = f.user_id_1)
     WHERE f.status = 'accepted'`
  )
    .bind(session.userId, session.userId)
    .all();

  return c.json({ friends: rows });
});

export default friends;
