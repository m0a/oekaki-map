import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/index';
import { createCanvasService } from '../services/canvas';

// Validation schemas
const createCanvasSchema = z.object({
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  zoom: z.number().int().min(1).max(19),
});

const updateCanvasSchema = z.object({
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  zoom: z.number().int().min(1).max(19).optional(),
});

// Canvas ID format: 21 characters (nanoid)

// Canvas routes
const canvasRoutes = new Hono<{ Bindings: Env }>();

// POST /canvas - Create a new canvas
canvasRoutes.post(
  '/',
  zValidator('json', createCanvasSchema),
  async (c) => {
    const data = c.req.valid('json');
    const service = createCanvasService(c.env);

    try {
      const canvas = await service.create(data);
      return c.json({ canvas }, 201);
    } catch (error) {
      console.error('Failed to create canvas:', error);
      return c.json(
        { error: 'CREATE_FAILED', message: 'Failed to create canvas' },
        500
      );
    }
  }
);

// GET /canvas/:id - Get canvas with tile list
canvasRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  if (id.length !== 21) {
    return c.json(
      { error: 'INVALID_ID', message: 'Invalid canvas ID format' },
      400
    );
  }

  const service = createCanvasService(c.env);

  try {
    const canvas = await service.get(id);

    if (!canvas) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Canvas not found' },
        404
      );
    }

    const tiles = await service.getTileCoordinates(id);
    return c.json({ canvas, tiles });
  } catch (error) {
    console.error('Failed to get canvas:', error);
    return c.json(
      { error: 'GET_FAILED', message: 'Failed to get canvas' },
      500
    );
  }
});

// PATCH /canvas/:id - Update canvas metadata
canvasRoutes.patch(
  '/:id',
  zValidator('json', updateCanvasSchema),
  async (c) => {
    const id = c.req.param('id');
    const data = c.req.valid('json');
    const service = createCanvasService(c.env);

    try {
      const canvas = await service.update(id, data);

      if (!canvas) {
        return c.json(
          { error: 'NOT_FOUND', message: 'Canvas not found' },
          404
        );
      }

      return c.json(canvas);
    } catch (error) {
      console.error('Failed to update canvas:', error);
      return c.json(
        { error: 'UPDATE_FAILED', message: 'Failed to update canvas' },
        500
      );
    }
  }
);

export { canvasRoutes };
