import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';

type Variables = { session: SessionPayload; userId: string };

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

admin.use('*', async (c, next) => {
  const session = c.get('session');
  if (session.role !== 'admin') return c.json({ error: 'Admin access required' }, 403);
  await next();
});

admin.get('/stats', async (c) => {
  const [users, tasks, notes, events, servers] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM tasks').first(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM notes').first(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM events').first(),
    c.env.DB.prepare('SELECT COUNT(*) as c FROM servers').first(),
  ]);
  return c.json({
    stats: {
      users: users?.c ?? 0,
      tasks: tasks?.c ?? 0,
      notes: notes?.c ?? 0,
      events: events?.c ?? 0,
      servers: servers?.c ?? 0,
    },
  });
});

admin.get('/users', async (c) => {
  const rows = await c.env.DB.prepare('SELECT id, email, username, role, avatar_color, created_at FROM users ORDER BY created_at DESC').all();
  return c.json({
    users: (rows.results || []).map((u: Record<string, unknown>) => ({
      id: u.id, email: u.email, username: u.username, role: u.role,
      avatarColor: u.avatar_color, createdAt: u.created_at,
    })),
  });
});

admin.get('/tasks', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT t.*, u.username FROM tasks t JOIN users u ON u.id = t.user_id ORDER BY t.updated_at DESC LIMIT 200
  `).all();
  return c.json({ tasks: rows.results || [] });
});

admin.get('/notes', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT n.*, u.username FROM notes n JOIN users u ON u.id = n.user_id ORDER BY n.updated_at DESC LIMIT 200
  `).all();
  return c.json({ notes: rows.results || [] });
});

admin.get('/events', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT e.*, u.username FROM events e JOIN users u ON u.id = e.user_id ORDER BY e.start_at DESC LIMIT 200
  `).all();
  return c.json({ events: rows.results || [] });
});

admin.get('/servers', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT s.*, u.username as owner_name, COUNT(sm.user_id) as member_count
    FROM servers s
    JOIN users u ON u.id = s.owner_id
    LEFT JOIN server_members sm ON sm.server_id = s.id
    GROUP BY s.id ORDER BY s.created_at DESC
  `).all();
  return c.json({ servers: rows.results || [] });
});

export default admin;
