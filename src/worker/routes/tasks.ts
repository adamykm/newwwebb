import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';
import { id, now } from '../../shared/utils';

type Variables = { session: SessionPayload; userId: string };

const tasks = new Hono<{ Bindings: Env; Variables: Variables }>();

tasks.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all();
  return c.json({ tasks: (rows.results || []).map(mapTask) });
});

tasks.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ title?: string; description?: string; priority?: string; dueAt?: number; status?: string }>();
  if (!body.title?.trim()) return c.json({ error: 'Title required' }, 400);
  const taskId = id();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO tasks (id, user_id, title, description, status, priority, due_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    taskId, userId, body.title.trim(), body.description || '', body.status || 'todo',
    body.priority || 'medium', body.dueAt || null, ts, ts
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  return c.json({ task: mapTask(row as Record<string, unknown>) }, 201);
});

tasks.patch('/:taskId', async (c) => {
  const userId = c.get('userId');
  const taskId = c.req.param('taskId');
  const existing = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(taskId, userId).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json<{ title?: string; description?: string; status?: string; priority?: string; dueAt?: number | null }>();
  await c.env.DB.prepare(
    `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).bind(
    body.title ?? existing.title,
    body.description ?? existing.description,
    body.status ?? existing.status,
    body.priority ?? existing.priority,
    body.dueAt !== undefined ? body.dueAt : existing.due_at,
    now(), taskId, userId
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  return c.json({ task: mapTask(row as Record<string, unknown>) });
});

tasks.delete('/:taskId', async (c) => {
  const userId = c.get('userId');
  const taskId = c.req.param('taskId');
  const result = await c.env.DB.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').bind(taskId, userId).run();
  if (!result.meta.changes) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

function mapTask(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    serverId: row.server_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    username: row.username,
  };
}

export default tasks;
