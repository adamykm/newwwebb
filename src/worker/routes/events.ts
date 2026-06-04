import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';
import { id, now } from '../../shared/utils';

type Variables = { session: SessionPayload; userId: string };

const events = new Hono<{ Bindings: Env; Variables: Variables }>();

events.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM events WHERE user_id = ? ORDER BY start_at ASC'
  ).bind(userId).all();
  return c.json({ events: (rows.results || []).map(mapEvent) });
});

events.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ title?: string; description?: string; startAt?: number; endAt?: number; location?: string }>();
  if (!body.title?.trim() || !body.startAt) return c.json({ error: 'Title and startAt required' }, 400);
  const eventId = id();
  await c.env.DB.prepare(
    'INSERT INTO events (id, user_id, title, description, start_at, end_at, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(eventId, userId, body.title.trim(), body.description || '', body.startAt, body.endAt || null, body.location || '', now()).run();
  const row = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(eventId).first();
  return c.json({ event: mapEvent(row as Record<string, unknown>) }, 201);
});

events.patch('/:eventId', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('eventId');
  const existing = await c.env.DB.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').bind(eventId, userId).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json<{ title?: string; description?: string; startAt?: number; endAt?: number | null; location?: string }>();
  await c.env.DB.prepare(
    'UPDATE events SET title = ?, description = ?, start_at = ?, end_at = ?, location = ? WHERE id = ? AND user_id = ?'
  ).bind(
    body.title ?? existing.title, body.description ?? existing.description,
    body.startAt ?? existing.start_at, body.endAt !== undefined ? body.endAt : existing.end_at,
    body.location ?? existing.location, eventId, userId
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(eventId).first();
  return c.json({ event: mapEvent(row as Record<string, unknown>) });
});

events.delete('/:eventId', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('eventId');
  const result = await c.env.DB.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').bind(eventId, userId).run();
  if (!result.meta.changes) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

function mapEvent(row: Record<string, unknown>) {
  return {
    id: row.id, userId: row.user_id, serverId: row.server_id,
    title: row.title, description: row.description, startAt: row.start_at,
    endAt: row.end_at, location: row.location, createdAt: row.created_at, username: row.username,
  };
}

export default events;
