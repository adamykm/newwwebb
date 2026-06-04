import { Hono } from 'hono';
import type { Env, SessionPayload } from '../../shared/types';
import { rowToUser } from '../../shared/utils';

type Variables = { session: SessionPayload; userId: string };
const profiles = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── Get any user profile ──────────────────────────────────────────────────────
profiles.get('/:userId', async (c) => {
  const { userId } = c.req.param();
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!row) return c.json({ error: 'User not found' }, 404);

  const now = Date.now();
  const bio = (row.bio_expires_at && (row.bio_expires_at as number) < now) ? null : row.bio;

  return c.json({
    user: {
      id: row.id, username: row.username, displayName: row.display_name ?? null,
      role: row.role, avatarColor: row.avatar_color, avatarUrl: row.avatar_url ?? null,
      bio: bio ?? null, status: row.status || 'online',
      nexusRole: row.nexus_role ?? null, nexusBadgeUrl: row.nexus_badge_url ?? null,
      developerBadgeUrl: row.developer_badge_url ?? null,
      createdAt: row.created_at,
    },
  });
});

// ── Update own profile ────────────────────────────────────────────────────────
profiles.patch('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{
    displayName?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    bioExpiry?: '24h' | 'permanent' | null;
    status?: string;
    themeColor?: string;
    themeMode?: string;
  }>();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.displayName !== undefined) {
    const dn = body.displayName?.trim() || null;
    if (dn && dn.length > 32) return c.json({ error: 'Display name too long (max 32)' }, 400);
    updates.push('display_name = ?'); params.push(dn);
  }
  if (body.avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(body.avatarUrl || null); }
  if (body.bio !== undefined) {
    const bio = body.bio?.trim() || null;
    if (bio && bio.length > 190) return c.json({ error: 'Bio too long (max 190 chars)' }, 400);
    updates.push('bio = ?'); params.push(bio);

    if (bio) {
      if (body.bioExpiry === '24h') {
        updates.push('bio_expires_at = ?'); params.push(Date.now() + 86400000);
      } else {
        updates.push('bio_expires_at = ?'); params.push(null);
      }
    } else {
      updates.push('bio_expires_at = ?'); params.push(null);
    }
  }
  if (body.status !== undefined) {
    const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
    if (!validStatuses.includes(body.status)) return c.json({ error: 'Invalid status' }, 400);
    updates.push('status = ?'); params.push(body.status);
  }
  if (body.themeColor !== undefined) { updates.push('theme_color = ?'); params.push(body.themeColor || '#5865f2'); }
  if (body.themeMode !== undefined) {
    if (!['dark', 'light'].includes(body.themeMode)) return c.json({ error: 'Invalid theme mode' }, 400);
    updates.push('theme_mode = ?'); params.push(body.themeMode);
  }

  if (!updates.length) return c.json({ error: 'Nothing to update' }, 400);

  params.push(userId);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  const user = rowToUser(row as Record<string, unknown>);
  return c.json({ user: {
    id: user.id, email: user.email, username: user.username, displayName: user.displayName,
    role: user.role, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl,
    bio: user.bio, bioExpiresAt: user.bioExpiresAt, status: user.status,
    themeColor: user.themeColor, themeMode: user.themeMode,
    nexusRole: user.nexusRole, nexusBadgeUrl: user.nexusBadgeUrl, developerBadgeUrl: user.developerBadgeUrl,
  } });
});

// ── Assign nexus role (admin only) ────────────────────────────────────────────
profiles.post('/nexus-role', async (c) => {
  const session = c.get('session');
  if (session.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

  const body = await c.req.json<{
    userId?: string;
    nexusRole?: 'moderator' | 'administrator' | null;
    nexusBadgeUrl?: string | null;
  }>();
  if (!body.userId) return c.json({ error: 'userId required' }, 400);

  const targetUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.userId).first();
  if (!targetUser) return c.json({ error: 'User not found' }, 404);

  const updates: string[] = [];
  const params: unknown[] = [];
  if (body.nexusRole !== undefined) { updates.push('nexus_role = ?'); params.push(body.nexusRole || null); }
  if (body.nexusBadgeUrl !== undefined) { updates.push('nexus_badge_url = ?'); params.push(body.nexusBadgeUrl || null); }

  if (!updates.length) return c.json({ error: 'Nothing to update' }, 400);
  params.push(body.userId);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  return c.json({ ok: true });
});

// ── Assign developer badge (admin only) ───────────────────────────────────────
profiles.post('/developer-badge', async (c) => {
  const session = c.get('session');
  if (session.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

  const body = await c.req.json<{ userId?: string; developerBadgeUrl?: string | null }>();
  if (!body.userId) return c.json({ error: 'userId required' }, 400);

  const targetUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.userId).first();
  if (!targetUser) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare('UPDATE users SET developer_badge_url = ? WHERE id = ?')
    .bind(body.developerBadgeUrl || null, body.userId).run();

  return c.json({ ok: true });
});

export default profiles;
