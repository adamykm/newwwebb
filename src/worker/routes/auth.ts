import { Hono } from 'hono';
import type { Env } from '../../shared/types';
import { createSessionToken, getSession, sessionCookie, clearSessionCookie } from '../auth';
import { hashPassword, verifyPassword, id, now, randomColor, rowToUser } from '../../shared/utils';

const auth = new Hono<{ Bindings: Env }>();

auth.post('/register', async (c) => {
  const { email, username, password } = await c.req.json<{ email?: string; username?: string; password?: string }>();
  if (!email?.trim() || !username?.trim() || !password || password.length < 6) {
    return c.json({ error: 'Email, username, and password (6+ chars) required' }, 400);
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanUser = username.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return c.json({ error: 'Invalid email' }, 400);
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUser)) return c.json({ error: 'Username must be 3-20 alphanumeric chars' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? OR username = ?').bind(cleanEmail, cleanUser).first();
  if (existing) return c.json({ error: 'Email or username already taken' }, 409);

  let role: 'user' | 'admin' = 'user';
  const adminEmail = c.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = c.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword && cleanEmail === adminEmail && password === adminPassword) role = 'admin';

  const userId = id();
  const passwordHash = await hashPassword(password);
  const avatarColor = randomColor();
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, username, password_hash, role, avatar_color, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, cleanEmail, cleanUser, passwordHash, role, avatarColor, now()).run();

  const token = await createSessionToken({ userId, role }, c.env);
  const secure = c.req.url.startsWith('https');
  return c.json({
    user: {
      id: userId, email: cleanEmail, username: cleanUser, displayName: null,
      role, avatarColor, avatarUrl: null, bio: null, bioExpiresAt: null,
      status: 'online', themeColor: '#5865f2', themeMode: 'dark',
      nexusRole: null, nexusBadgeUrl: null, developerBadgeUrl: null,
    },
  }, 201, { 'Set-Cookie': sessionCookie(token, secure) });
});

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  if (!email?.trim() || !password) return c.json({ error: 'Email and password required' }, 400);

  const row = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.trim().toLowerCase()).first();
  if (!row) return c.json({ error: 'Invalid credentials' }, 401);

  const valid = await verifyPassword(password, row.password_hash as string);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  const user = rowToUser(row as Record<string, unknown>);
  const token = await createSessionToken({ userId: user.id, role: user.role }, c.env);
  const secure = c.req.url.startsWith('https');

  const now2 = Date.now();
  const bio = (user.bioExpiresAt && user.bioExpiresAt < now2) ? null : user.bio;

  return c.json({
    user: {
      id: user.id, email: user.email, username: user.username, displayName: user.displayName,
      role: user.role, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl,
      bio, bioExpiresAt: user.bioExpiresAt, status: user.status || 'online',
      themeColor: user.themeColor || '#5865f2', themeMode: user.themeMode || 'dark',
      nexusRole: user.nexusRole, nexusBadgeUrl: user.nexusBadgeUrl, developerBadgeUrl: user.developerBadgeUrl,
    },
  }, 200, { 'Set-Cookie': sessionCookie(token, secure) });
});

auth.post('/logout', (c) => c.json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() }));

auth.get('/me', async (c) => {
  const session = await getSession(c.req.raw, c.env);
  if (!session) return c.json({ user: null });
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.userId).first();
  if (!row) return c.json({ user: null });

  const user = rowToUser(row as Record<string, unknown>);
  const now2 = Date.now();
  const bio = (user.bioExpiresAt && user.bioExpiresAt < now2) ? null : user.bio;

  return c.json({
    user: {
      id: user.id, email: user.email, username: user.username, displayName: user.displayName,
      role: user.role, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl,
      bio, bioExpiresAt: user.bioExpiresAt, status: user.status || 'online',
      themeColor: user.themeColor || '#5865f2', themeMode: user.themeMode || 'dark',
      nexusRole: user.nexusRole, nexusBadgeUrl: user.nexusBadgeUrl, developerBadgeUrl: user.developerBadgeUrl,
    },
  });
});

export default auth;
