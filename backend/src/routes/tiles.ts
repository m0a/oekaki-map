import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/index';
import { createTileService } from '../services/tiles';
import { createCanvasService } from '../services/canvas';

// Validation schemas
const getTilesQuerySchema = z.object({
  z: z.coerce.number().int().min(1).max(19),
  minX: z.coerce.number().int().min(0),
  maxX: z.coerce.number().int().min(0),
  minY: z.coerce.number().int().min(0),
  maxY: z.coerce.number().int().min(0),
  layerId: z.string().optional(), // Optional layer filter
});

// Tiles routes
const tilesRoutes = new Hono<{ Bindings: Env }>();

// GET /canvas/:canvasId/tiles - Get tiles in visible area
tilesRoutes.get('/:canvasId/tiles', async (c) => {
  const canvasId = c.req.param('canvasId');
  const query = c.req.query();

  // Validate query params
  const parseResult = getTilesQuerySchema.safeParse(query);
  if (!parseResult.success) {
    return c.json(
      { error: 'INVALID_QUERY', message: 'Invalid query parameters' },
      400
    );
  }

  const { z, minX, maxX, minY, maxY, layerId } = parseResult.data;
  const canvasService = createCanvasService(c.env);
  const tileService = createTileService(c.env);

  try {
    // Check canvas exists
    const canvas = await canvasService.get(canvasId);
    if (!canvas) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Canvas not found' },
        404
      );
    }

    const tiles = await tileService.getTilesInArea(
      canvasId,
      z,
      minX,
      maxX,
      minY,
      maxY,
      layerId
    );

    return c.json({ tiles });
  } catch (error) {
    console.error('Failed to get tiles:', error);
    return c.json(
      { error: 'GET_FAILED', message: 'Failed to get tiles' },
      500
    );
  }
});

// POST /canvas/:canvasId/tiles - Save tiles
tilesRoutes.post('/:canvasId/tiles', async (c) => {
  const canvasId = c.req.param('canvasId');
  const canvasService = createCanvasService(c.env);
  const tileService = createTileService(c.env);

  try {
    // Check canvas exists
    const canvas = await canvasService.get(canvasId);
    if (!canvas) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Canvas not found' },
        404
      );
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const count = parseInt(formData.get('count') as string, 10);

    if (isNaN(count) || count <= 0) {
      return c.json(
        { error: 'INVALID_DATA', message: 'Invalid tile count' },
        400
      );
    }

    const tiles: Array<{ z: number; x: number; y: number; data: ArrayBuffer }> = [];

    for (let i = 0; i < count; i++) {
      const z = parseInt(formData.get(`tile_${i}_z`) as string, 10);
      const x = parseInt(formData.get(`tile_${i}_x`) as string, 10);
      const y = parseInt(formData.get(`tile_${i}_y`) as string, 10);
      const image = formData.get(`tile_${i}_image`) as File | null;

      if (isNaN(z) || isNaN(x) || isNaN(y) || !image) {
        return c.json(
          { error: 'INVALID_DATA', message: `Invalid tile data at index ${i}` },
          400
        );
      }

      const data = await image.arrayBuffer();
      tiles.push({ z, x, y, data });
    }

    const { saved } = await tileService.saveTiles(canvasId, tiles);

    // Get updated canvas
    const updatedCanvas = await canvasService.get(canvasId);

    return c.json({
      saved,
      canvas: updatedCanvas,
    });
  } catch (error) {
    console.error('Failed to save tiles:', error);

    if (error instanceof Error && error.message === 'Tile limit exceeded') {
      return c.json(
        { error: 'LIMIT_EXCEEDED', message: 'Maximum tile limit reached' },
        400
      );
    }

    return c.json(
      { error: 'SAVE_FAILED', message: 'Failed to save tiles' },
      500
    );
  }
});

// GET /tiles/:canvasId/:z/:x/:filename - Get tile image
tilesRoutes.get('/:canvasId/:z/:x/:filename', async (c) => {
  const canvasId = c.req.param('canvasId');
  const zParam = c.req.param('z');
  const xParam = c.req.param('x');
  const filename = c.req.param('filename');

  // Parse y from filename (e.g., "103226.webp" -> 103226)
  const yMatch = filename.match(/^(\d+)\.webp$/);
  if (!zParam || !xParam || !yMatch) {
    return c.json(
      { error: 'INVALID_PARAMS', message: 'Missing or invalid tile coordinates' },
      400
    );
  }

  const z = parseInt(zParam, 10);
  const x = parseInt(xParam, 10);
  const y = parseInt(yMatch[1] ?? '', 10);

  if (isNaN(z) || isNaN(x) || isNaN(y)) {
    return c.json(
      { error: 'INVALID_PARAMS', message: 'Invalid tile coordinates' },
      400
    );
  }

  const tileService = createTileService(c.env);

  try {
    const imageData = await tileService.getTileImage(canvasId, z, x, y);

    if (!imageData) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Tile not found' },
        404
      );
    }

    return new Response(imageData, {
      headers: {
        'Content-Type': 'image/webp',
        // Long-term cache with version query param for cache busting
        // ?v=updatedAt ensures fresh content after tile updates
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Failed to get tile image:', error);
    return c.json(
      { error: 'GET_FAILED', message: 'Failed to get tile image' },
      500
    );
  }
});

export { tilesRoutes };
