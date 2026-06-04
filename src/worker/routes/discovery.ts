import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';

type Variables = { session: SessionPayload; userId: string };
const discovery = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── List discoverable servers ─────────────────────────────────────────────────
discovery.get('/', async (c) => {
  const q = c.req.query('q') || '';
  const category = c.req.query('category') || '';

  let query = `
    SELECT s.id, s.name, s.description, s.icon_color, s.icon_url, s.invite_code, s.custom_invite,
           s.discovery_category, COUNT(sm.user_id) as member_count
    FROM servers s
    LEFT JOIN server_members sm ON sm.server_id = s.id
    WHERE s.is_discoverable = 1
  `;
  const params: unknown[] = [];

  if (q) {
    query += ' AND (s.name LIKE ? OR s.description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    query += ' AND s.discovery_category = ?';
    params.push(category);
  }

  query += ' GROUP BY s.id ORDER BY member_count DESC LIMIT 50';

  const rows = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({
    servers: (rows.results || []).map((r: Record<string, unknown>) => ({
      id: r.id, name: r.name, description: r.description,
      iconColor: r.icon_color, iconUrl: r.icon_url ?? null,
      inviteCode: r.invite_code, customInvite: r.custom_invite ?? null,
      discoveryCategory: r.discovery_category ?? null,
      memberCount: r.member_count,
    })),
  });
});

// ── Get categories available in discovery ─────────────────────────────────────
discovery.get('/categories', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT DISTINCT discovery_category FROM servers WHERE is_discoverable = 1 AND discovery_category IS NOT NULL ORDER BY discovery_category'
  ).all();
  return c.json({ categories: (rows.results || []).map((r: Record<string, unknown>) => r.discovery_category) });
});

export default discovery;
