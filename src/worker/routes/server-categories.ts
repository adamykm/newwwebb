import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { id, now } from '../../shared/utils';

const serverCategories = new Hono<{ Bindings: Env }>();

// Create server category (admin only)
serverCategories.post('/', async (c) => {
  const session = c.get('session');
  if (session?.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

  const { name, description } = await c.req.json<{
    name: string;
    description?: string;
  }>();

  const categoryId = id();
  await c.env.DB.prepare(
    'INSERT INTO server_categories (id, name, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(categoryId, name, description || null, session.userId, now())
    .run();

  return c.json({ categoryId }, 201);
});

// Get all server categories
serverCategories.get('/', async (c) => {
  const categories = await c.env.DB.prepare(
    'SELECT id, name, description FROM server_categories ORDER BY name'
  ).all();

  return c.json({ categories });
});

// Add server to category
serverCategories.post('/add-server', async (c) => {
  const session = c.get('session');
  if (session?.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

  const { server_id, category_id } = await c.req.json<{
    server_id: string;
    category_id: string;
  }>();

  await c.env.DB.prepare('UPDATE servers SET category_id = ? WHERE id = ?')
    .bind(category_id, server_id)
    .run();

  return c.json({ ok: true });
});

// Get servers in category
serverCategories.get('/:categoryId/servers', async (c) => {
  const { categoryId } = c.req.param();

  const servers = await c.env.DB.prepare(
    'SELECT id, name, description, icon_url, owner_id FROM servers WHERE category_id = ? ORDER BY name'
  )
    .bind(categoryId)
    .all();

  return c.json({ servers });
});

export default serverCategories;