import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { id, now } from '../../shared/utils';

const channelCategories = new Hono<{ Bindings: Env }>();

// Create channel category
channelCategories.post('/', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { server_id, name, position } = await c.req.json<{
    server_id: string;
    name: string;
    position?: number;
  }>();

  // Check if user is server owner/admin
  const member = await c.env.DB.prepare(
    'SELECT role FROM server_member_roles WHERE server_id = ? AND user_id = ?'
  ).bind(server_id, session.userId).first();

  if (!member || !['owner', 'admin'].includes(member.role as string)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  const categoryId = id();
  await c.env.DB.prepare(
    'INSERT INTO channel_categories (id, server_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(categoryId, server_id, name, position || 0, now())
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

// Update category
channelCategories.patch('/:categoryId', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { categoryId } = c.req.param();
  const { name, position } = await c.req.json<{ name?: string; position?: number }>();

  const category = await c.env.DB.prepare(
    'SELECT server_id FROM channel_categories WHERE id = ?'
  ).bind(categoryId).first();

  if (!category) return c.json({ error: 'Category not found' }, 404);

  const member = await c.env.DB.prepare(
    'SELECT role FROM server_member_roles WHERE server_id = ? AND user_id = ?'
  ).bind(category.server_id, session.userId).first();

  if (!member || !['owner', 'admin'].includes(member.role as string)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  await c.env.DB.prepare(
    'UPDATE channel_categories SET name = COALESCE(?, name), position = COALESCE(?, position) WHERE id = ?'
  )
    .bind(name || null, position !== undefined ? position : null, categoryId)
    .run();

  return c.json({ ok: true });
});

// Delete category
channelCategories.delete('/:categoryId', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { categoryId } = c.req.param();

  const category = await c.env.DB.prepare(
    'SELECT server_id FROM channel_categories WHERE id = ?'
  ).bind(categoryId).first();

  if (!category) return c.json({ error: 'Category not found' }, 404);

  const member = await c.env.DB.prepare(
    'SELECT role FROM server_member_roles WHERE server_id = ? AND user_id = ?'
  ).bind(category.server_id, session.userId).first();

  if (!member || !['owner', 'admin'].includes(member.role as string)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM channel_categories WHERE id = ?')
    .bind(categoryId)
    .run();

  return c.json({ ok: true });
});

export default channelCategories;