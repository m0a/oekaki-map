import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/index';
import { MAX_LAYER_NAME_LENGTH } from '../types/index';
import { createLayerService } from '../services/layers';
import { createCanvasService } from '../services/canvas';
import { isValidCanvasId, isValidLayerId } from '../utils/validation';

// Validation schemas
const createLayerSchema = z.object({
  name: z.string().max(MAX_LAYER_NAME_LENGTH).optional(),
});

const updateLayerSchema = z.object({
  name: z.string().max(MAX_LAYER_NAME_LENGTH).optional(),
  order: z.number().int().min(0).optional(),
  visible: z.boolean().optional(),
});

// Layer routes (nested under /canvas/:canvasId/layers)
const layersRoutes = new Hono<{ Bindings: Env }>();

// GET /canvas/:canvasId/layers - Get all layers for a canvas
layersRoutes.get('/:canvasId/layers', async (c) => {
  const canvasId = c.req.param('canvasId');

  if (!isValidCanvasId(canvasId)) {
    return c.json(
      { error: 'INVALID_ID', message: 'Invalid canvas ID format' },
      400
    );
  }

  const canvasService = createCanvasService(c.env);
  const canvas = await canvasService.get(canvasId);

  if (!canvas) {
    return c.json({ error: 'NOT_FOUND', message: 'Canvas not found' }, 404);
  }

  const layerService = createLayerService(c.env);
  const layers = await layerService.getByCanvasId(canvasId);

  return c.json({ layers });
});

// POST /canvas/:canvasId/layers - Create a new layer
layersRoutes.post(
  '/:canvasId/layers',
  zValidator('json', createLayerSchema),
  async (c) => {
    const canvasId = c.req.param('canvasId');
    const data = c.req.valid('json');

    if (!isValidCanvasId(canvasId)) {
      return c.json(
        { error: 'INVALID_ID', message: 'Invalid canvas ID format' },
        400
      );
    }

    const canvasService = createCanvasService(c.env);
    const canvas = await canvasService.get(canvasId);

    if (!canvas) {
      return c.json({ error: 'NOT_FOUND', message: 'Canvas not found' }, 404);
    }

    const layerService = createLayerService(c.env);

    try {
      const layer = await layerService.create(canvasId, data.name);
      return c.json({ layer }, 201);
    } catch (error) {
      if (error instanceof Error && error.message === 'MAX_LAYERS_EXCEEDED') {
        return c.json(
          {
            error: 'MAX_LAYERS_EXCEEDED',
            message: 'レイヤー数の上限（10）に達しています',
          },
          400
        );
      }
      console.error('Failed to create layer:', error);
      return c.json(
        { error: 'CREATE_FAILED', message: 'Failed to create layer' },
        500
      );
    }
  }
);

// PATCH /canvas/:canvasId/layers/:id - Update a layer
layersRoutes.patch(
  '/:canvasId/layers/:id',
  zValidator('json', updateLayerSchema),
  async (c) => {
    const canvasId = c.req.param('canvasId');
    const layerId = c.req.param('id');
    const data = c.req.valid('json');

    if (!isValidCanvasId(canvasId) || !isValidLayerId(layerId)) {
      return c.json({ error: 'INVALID_ID', message: 'Invalid ID format' }, 400);
    }

    const layerService = createLayerService(c.env);

    // Filter out undefined values to satisfy exactOptionalPropertyTypes
    const updates: { name?: string; order?: number; visible?: boolean } = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.order !== undefined) updates.order = data.order;
    if (data.visible !== undefined) updates.visible = data.visible;

    try {
      const layer = await layerService.update(canvasId, layerId, updates);

      if (!layer) {
        return c.json(
          { error: 'NOT_FOUND', message: 'Layer not found' },
          404
        );
      }

      return c.json({ layer });
    } catch (error) {
      console.error('Failed to update layer:', error);
      return c.json(
        { error: 'UPDATE_FAILED', message: 'Failed to update layer' },
        500
      );
    }
  }
);

// DELETE /canvas/:canvasId/layers/:id - Delete a layer
layersRoutes.delete('/:canvasId/layers/:id', async (c) => {
  const canvasId = c.req.param('canvasId');
  const layerId = c.req.param('id');

  if (!isValidCanvasId(canvasId) || !isValidLayerId(layerId)) {
    return c.json({ error: 'INVALID_ID', message: 'Invalid ID format' }, 400);
  }

  const layerService = createLayerService(c.env);

  try {
    const deleted = await layerService.delete(canvasId, layerId);

    if (!deleted) {
      return c.json({ error: 'NOT_FOUND', message: 'Layer not found' }, 404);
    }

    return c.body(null, 204);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'CANNOT_DELETE_LAST_LAYER'
    ) {
      return c.json(
        {
          error: 'CANNOT_DELETE_LAST_LAYER',
          message: '最後のレイヤーは削除できません',
        },
        400
      );
    }
    console.error('Failed to delete layer:', error);
    return c.json(
      { error: 'DELETE_FAILED', message: 'Failed to delete layer' },
      500
    );
  }
});

export { layersRoutes };
