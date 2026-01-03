import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types/index';
import { canvasRoutes } from './routes/canvas';
import { tilesRoutes } from './routes/tiles';
import { logsRoutes } from './routes/logs';
import { layersRoutes } from './routes/layers';
import { ogpRoutes } from './routes/ogp';
import { isCrawler } from './utils/crawler';
import { createOGPService } from './services/ogp';
import { generateOGPHtml, generateTopPageOGPHtml } from './templates/ogp-html';

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
app.route('/api/canvas', layersRoutes); // /api/canvas/:id/layers
app.route('/api/tiles', tilesRoutes);  // /api/tiles/:canvasId/:z/:x/:y.webp
app.route('/api/logs', logsRoutes);    // /api/logs/error, /api/logs/debug
app.route('/api/ogp', ogpRoutes);     // /api/ogp/:canvasId, /api/ogp/image/:filename

// Serve static files for SPA
// Handle canvas routes for SPA (client-side routing)
app.get('/c/:id', async (c) => {
  const canvasId = c.req.param('id');
  const userAgent = c.req.header('User-Agent');

  // Check if request is from a crawler (SNS bot)
  if (isCrawler(userAgent)) {
    try {
      const ogpService = createOGPService(c.env);
      const canvas = await ogpService.getCanvasOGPData(canvasId);

      const url = new URL(c.req.url);
      const baseUrl = `${url.protocol}//${url.host}`;

      if (canvas) {
        // Generate OGP HTML with canvas-specific metadata
        const metadata = ogpService.generateMetadata(
          canvasId,
          canvas.ogpPlaceName,
          canvas.ogpImageKey,
          baseUrl
        );
        const html = generateOGPHtml(metadata);
        return c.html(html);
      } else {
        // Canvas not found - return default OGP for crawlers
        const html = generateTopPageOGPHtml(baseUrl);
        return c.html(html);
      }
    } catch (error) {
      console.error('Failed to generate OGP for crawler:', error);
      // Fall through to SPA shell on error
    }
  }

  // Serve index.html for browser requests (SPA)
  const res = await c.env.ASSETS.fetch(new URL('/index.html', c.req.url));
  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
});

// Handle top page with OGP for crawlers
app.get('/', async (c) => {
  const userAgent = c.req.header('User-Agent');

  // Check if request is from a crawler (SNS bot)
  if (isCrawler(userAgent)) {
    const url = new URL(c.req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const html = generateTopPageOGPHtml(baseUrl);
    return c.html(html);
  }

  // Serve index.html for browser requests (SPA)
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
