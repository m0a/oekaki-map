import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types/index';
import { canvasRoutes } from './routes/canvas';
import { tilesRoutes } from './routes/tiles';
import { logsRoutes } from './routes/logs';

// Extended environment with static assets
interface ExtendedEnv extends Env {
  ASSETS: Fetcher;
}

// Create Hono app with typed environment
const app = new Hono<{ Bindings: ExtendedEnv }>();

// Middleware
app.use('*', logger());
app.use(
  '/api/*',
  cors({
    origin: '*', // Allow all origins in production
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
  })
);

// API health check endpoint
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'oekaki-map-api' });
});

// API routes
app.route('/api/canvas', canvasRoutes);
app.route('/api/canvas', tilesRoutes); // /api/canvas/:id/tiles
app.route('/api/tiles', tilesRoutes);  // /api/tiles/:canvasId/:z/:x/:y.webp
app.route('/api/logs', logsRoutes);    // /api/logs/error, /api/logs/debug

// Serve static files for SPA
// Handle canvas routes for SPA (client-side routing)
app.get('/c/:id', async (c) => {
  // Serve index.html for canvas routes
  const res = await c.env.ASSETS.fetch(new URL('/index.html', c.req.url));
  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
});

// Serve static assets
app.get('/*', async (c) => {
  try {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404) {
      // For SPA, serve index.html for non-asset routes
      const indexRes = await c.env.ASSETS.fetch(new URL('/index.html', c.req.url));
      return new Response(indexRes.body, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }
    return res;
  } catch {
    return c.text('Not found', 404);
  }
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    500
  );
});

export default app;

// Export type for RPC client
export type AppType = typeof app;
