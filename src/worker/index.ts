import { Hono } from 'hono';
import type { Env, SessionPayload } from '../shared/types';
import { getSession } from './auth';
import authRoutes from './routes/auth';
import tasksRoutes from './routes/tasks';
import notesRoutes from './routes/notes';
import eventsRoutes from './routes/events';
import serversRoutes from './routes/servers';
import adminRoutes from './routes/admin';
import profileRoutes from './routes/profiles';
import friendRoutes from './routes/friends';
import dmRoutes from './routes/dm';
import voiceRoutes from './routes/voice';
import moderationRoutes from './routes/moderation';
import mediaRoutes from './routes/media';
import giphyRoutes from './routes/giphy';
import channelCategoriesRoutes from './routes/channel-categories';
import serverCategoriesRoutes from './routes/server-categories';

type Variables = { session: SessionPayload; userId: string };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ✅ DEBUG ROUTE
app.get('/api/debug', (c) => {
  return c.json({
    ok: true,
    db: typeof c.env.DB,
    hasDB: !!c.env.DB
  });
});

// CORS
app.use('/api/*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type');

  if (c.req.method === 'OPTIONS') return c.body(null, 204);

  await next();
});

// ROUTES
app.route('/api/auth', authRoutes);

const protectedApi = new Hono<{ Bindings: Env; Variables: Variables }>();

protectedApi.use('*', async (c, next) => {
  const session = await getSession(c.req.raw, c.env);

  if (!session) return c.json({ error: 'Unauthorized' }, 401);

  c.set('session', session);
  c.set('userId', session.userId);

  await next();
});

// Original routes
protectedApi.route('/tasks', tasksRoutes);
protectedApi.route('/notes', notesRoutes);
protectedApi.route('/events', eventsRoutes);
protectedApi.route('/servers', serversRoutes);
protectedApi.route('/admin', adminRoutes);

// New Discord feature routes
protectedApi.route('/profiles', profileRoutes);
protectedApi.route('/friends', friendRoutes);
protectedApi.route('/dm', dmRoutes);
protectedApi.route('/voice', voiceRoutes);
protectedApi.route('/moderation', moderationRoutes);
protectedApi.route('/media', mediaRoutes);
protectedApi.route('/giphy', giphyRoutes);
protectedApi.route('/channel-categories', channelCategoriesRoutes);
protectedApi.route('/server-categories', serverCategoriesRoutes);

app.route('/api', protectedApi);

// fallback
app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
