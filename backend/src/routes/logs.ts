import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/index';

const errorLogSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  url: z.string(),
  userAgent: z.string().optional(),
  timestamp: z.string(),
  extra: z.record(z.unknown()).optional(),
});

const debugLogSchema = z.object({
  event: z.string(),
  timestamp: z.string(),
  url: z.string(),
}).passthrough();

const logsRoutes = new Hono<{ Bindings: Env }>();

// POST /logs/error - Receive error logs from frontend
logsRoutes.post('/error', async (c) => {
  try {
    const body: unknown = await c.req.json();
    const result = errorLogSchema.safeParse(body);

    if (!result.success) {
      return c.json({ error: 'Invalid error log format' }, 400);
    }

    console.error('[Frontend Error]', JSON.stringify(result.data, null, 2));
    return c.json({ received: true });
  } catch {
    return c.json({ error: 'Failed to parse error log' }, 400);
  }
});

// POST /logs/debug - Receive debug logs from frontend
logsRoutes.post('/debug', async (c) => {
  try {
    const body: unknown = await c.req.json();
    const result = debugLogSchema.safeParse(body);

    if (!result.success) {
      return c.json({ error: 'Invalid debug log format' }, 400);
    }

    console.log('[Frontend Debug]', JSON.stringify(result.data, null, 2));
    return c.json({ received: true });
  } catch {
    return c.json({ error: 'Failed to parse debug log' }, 400);
  }
});

export { logsRoutes };
