import profileRoutes from './routes/profiles';
import friendRoutes from './routes/friends';
import dmRoutes from './routes/dm';
import voiceRoutes from './routes/voice';
import moderationRoutes from './routes/moderation';
import mediaRoutes from './routes/media';
import giphyRoutes from './routes/giphy';
import channelCategoriesRoutes from './routes/channel-categories';
import serverCategoriesRoutes from './routes/server-categories';

// Add to protected routes (after auth check):
protectedApi.route('/profiles', profileRoutes);
protectedApi.route('/friends', friendRoutes);
protectedApi.route('/dm', dmRoutes);
protectedApi.route('/voice', voiceRoutes);
protectedApi.route('/moderation', moderationRoutes);
protectedApi.route('/media', mediaRoutes);
protectedApi.route('/giphy', giphyRoutes);
protectedApi.route('/channel-categories', channelCategoriesRoutes);
protectedApi.route('/server-categories', serverCategoriesRoutes);
