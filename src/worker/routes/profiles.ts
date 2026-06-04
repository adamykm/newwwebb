import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { id, now } from '../../shared/utils';

const profiles = new Hono<{ Bindings: Env }>();

// Get user profile
profiles.get('/:userId', async (c) => {
  const { userId } = c.req.param();
  const row = await c.env.DB.prepare(
    'SELECT id, email, username, role, avatar_url, banner_url, bio, avatar_color, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!row) return c.json({ error: 'User not found' }, 404);

  return c.json({
    user: {
      id: row.id,
      email: row.email,
      username: row.username,
      role: row.role,
      avatarUrl: row.avatar_url,
      bannerUrl: row.banner_url,
      bio: row.bio,
      avatarColor: row.avatar_color,
      createdAt: row.created_at,
    },
  });
});

// Update profile
profiles.patch('/update', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  const { bio, avatarUrl, bannerUrl } = await c.req.json<{
    bio?: string;
    avatarUrl?: string;
    bannerUrl?: string;
  }>();

  await c.env.DB.prepare(
    'UPDATE users SET bio = ?, avatar_url = ?, banner_url = ? WHERE id = ?'
  )
    .bind(bio || null, avatarUrl || null, bannerUrl || null, session.userId)
    .run();

  return c.json({ ok: true });
});

// Upload avatar
profiles.post('/avatar/upload', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  if (!c.env.R2) return c.json({ error: 'File upload not configured' }, 500);

  const formData = await c.req.formData();
  const file = formData.get('file') as File;

  if (!file) return c.json({ error: 'No file provided' }, 400);

  const fileName = `avatars/${session.userId}-${Date.now()}`;
  await c.env.R2.put(fileName, file);

  const url = `https://cdn.yourdomain.com/${fileName}`;
  await c.env.DB.prepare('UPDATE users SET avatar_url = ? WHERE id = ?')
    .bind(url, session.userId)
    .run();

  return c.json({ avatarUrl: url });
});

export default profiles;
