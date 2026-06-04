import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';
import { id, now } from '../../shared/utils';

type Variables = { session: SessionPayload; userId: string };

const notes = new Hono<{ Bindings: Env; Variables: Variables }>();

notes.get('/', async (c) => {
  const userId = c.get('userId');
  const rows = await c.env.DB.prepare(
    'SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all();
  return c.json({ notes: (rows.results || []).map(mapNote) });
});

notes.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ title?: string; body?: string }>();
  if (!body.title?.trim()) return c.json({ error: 'Title required' }, 400);
  const noteId = id();
  const ts = now();
  await c.env.DB.prepare(
    'INSERT INTO notes (id, user_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(noteId, userId, body.title.trim(), body.body || '', ts, ts).run();
  const row = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(noteId).first();
  return c.json({ note: mapNote(row as Record<string, unknown>) }, 201);
});

notes.patch('/:noteId', async (c) => {
  const userId = c.get('userId');
  const noteId = c.req.param('noteId');
  const existing = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').bind(noteId, userId).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json<{ title?: string; body?: string }>();
  await c.env.DB.prepare(
    'UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind(body.title ?? existing.title, body.body ?? existing.body, now(), noteId, userId).run();
  const row = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(noteId).first();
  return c.json({ note: mapNote(row as Record<string, unknown>) });
});

notes.delete('/:noteId', async (c) => {
  const userId = c.get('userId');
  const noteId = c.req.param('noteId');
  const result = await c.env.DB.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(noteId, userId).run();
  if (!result.meta.changes) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

function mapNote(row: Record<string, unknown>) {
  return {
    id: row.id, userId: row.user_id, serverId: row.server_id,
    title: row.title, body: row.body, createdAt: row.created_at, updatedAt: row.updated_at, username: row.username,
  };
}

export default notes;
