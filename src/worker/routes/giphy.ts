import { Hono } from 'hono';
import type { Env } from '../../shared/types';

const giphyRoutes = new Hono<{ Bindings: Env }>();

const GIPHY_API_KEY = 'RDsJHHgv9LP0W4sUEFfG9r6J4IISv0yu';

// Search GIFs
giphyRoutes.get('/search', async (c) => {
  const query = c.req.query('q');
  
  if (!query) return c.json({ error: 'Query required' }, 400);

  try {
    const url = new URL('https://api.giphy.com/v1/gifs/search');
    url.searchParams.append('q', query);
    url.searchParams.append('api_key', GIPHY_API_KEY);
    url.searchParams.append('limit', '20');

    const res = await fetch(url.toString());
    const data = await res.json<{ data: any[] }>();

    return c.json({ gifs: data.data });
  } catch (err) {
    console.error('Giphy error:', err);
    return c.json({ error: 'Failed to fetch GIFs' }, 500);
  }
});

// Get trending GIFs
giphyRoutes.get('/trending', async (c) => {
  try {
    const url = new URL('https://api.giphy.com/v1/gifs/trending');
    url.searchParams.append('api_key', GIPHY_API_KEY);
    url.searchParams.append('limit', '20');

    const res = await fetch(url.toString());
    const data = await res.json<{ data: any[] }>();

    return c.json({ gifs: data.data });
  } catch (err) {
    console.error('Giphy error:', err);
    return c.json({ error: 'Failed to fetch trending GIFs' }, 500);
  }
});

export default giphyRoutes;
