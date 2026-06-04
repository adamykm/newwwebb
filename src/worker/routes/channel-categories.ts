import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { id, now } from '../../shared/utils';

const channelCategories = new Hono<{ Bindings: Env }>();

// Create channel category
channelCategories.post('/', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { server_id, name } = await c.req.json<{ server_id: string; name: string }>();

  const categoryId = id();
  await c.env.DB.prepare(
    'INSERT INTO channel_categories (id, server_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(categoryId, server_id, name, 0, now())
    .run();

  return c.json({ categoryId }, 201);
});

// Get categories for server
channelCategories.get('/:serverId', async (c) => {
  const { serverId } = c.req.param();

  const categories = await c.env.DB.prepare(
    'SELECT id, name, position, created_at FROM channel_categories WHERE server_id = ? ORDER BY position'
  )
    .bind(serverId)
    .all();

  return c.json({ categories });
});

// Delete category
channelCategories.delete('/:categoryId', async (c) => {
  const { categoryId } = c.req.param();

  await c.env.DB.prepare('DELETE FROM channel_categories WHERE id = ?').bind(categoryId).run();

  return c.json({ ok: true });
});

export default channelCategories;
