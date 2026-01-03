import { nanoid } from 'nanoid';
import type { Layer, Env } from '../types/index';
import { MAX_LAYERS_PER_CANVAS } from '../types/index';

// Layer database operations
export class LayerService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Get all layers for a canvas
  async getByCanvasId(canvasId: string): Promise<Layer[]> {
    const results = await this.db
      .prepare(
        `SELECT id, canvas_id, name, "order", visible, created_at, updated_at
         FROM layer WHERE canvas_id = ? ORDER BY "order" ASC`
      )
      .bind(canvasId)
      .all<{
        id: string;
        canvas_id: string;
        name: string;
        order: number;
        visible: number;
        created_at: string;
        updated_at: string;
      }>();

    return results.results.map((row) => ({
      id: row.id,
      canvasId: row.canvas_id,
      name: row.name,
      order: row.order,
      visible: row.visible === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // Get layer by ID
  async getById(canvasId: string, layerId: string): Promise<Layer | null> {
    const result = await this.db
      .prepare(
        `SELECT id, canvas_id, name, "order", visible, created_at, updated_at
         FROM layer WHERE id = ? AND canvas_id = ?`
      )
      .bind(layerId, canvasId)
      .first<{
        id: string;
        canvas_id: string;
        name: string;
        order: number;
        visible: number;
        created_at: string;
        updated_at: string;
      }>();

    if (!result) return null;

    return {
      id: result.id,
      canvasId: result.canvas_id,
      name: result.name,
      order: result.order,
      visible: result.visible === 1,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  // Count layers for a canvas
  async countByCanvasId(canvasId: string): Promise<number> {
    const result = await this.db
      .prepare(`SELECT COUNT(*) as count FROM layer WHERE canvas_id = ?`)
      .bind(canvasId)
      .first<{ count: number }>();

    return result?.count ?? 0;
  }

  // Get next order value for new layer
  async getNextOrder(canvasId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT MAX("order") as max_order FROM layer WHERE canvas_id = ?`
      )
      .bind(canvasId)
      .first<{ max_order: number | null }>();

    return (result?.max_order ?? -1) + 1;
  }

  // Create a new layer
  async create(canvasId: string, name?: string): Promise<Layer> {
    const count = await this.countByCanvasId(canvasId);
    if (count >= MAX_LAYERS_PER_CANVAS) {
      throw new Error('MAX_LAYERS_EXCEEDED');
    }

    const id = nanoid(21);
    const now = new Date().toISOString();
    const order = await this.getNextOrder(canvasId);
    const layerName = name ?? `レイヤー ${order + 1}`;

    await this.db
      .prepare(
        `INSERT INTO layer (id, canvas_id, name, "order", visible, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(id, canvasId, layerName, order, now, now)
      .run();

    return {
      id,
      canvasId,
      name: layerName,
      order,
      visible: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Update layer properties
  async update(
    canvasId: string,
    layerId: string,
    updates: { name?: string; order?: number; visible?: boolean }
  ): Promise<Layer | null> {
    const existing = await this.getById(canvasId, layerId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = updates.name ?? existing.name;
    const visible = updates.visible ?? existing.visible;

    // Handle order change separately to avoid UNIQUE constraint violations
    if (updates.order !== undefined && updates.order !== existing.order) {
      await this.reorder(canvasId, layerId, updates.order);
    }

    // Get the potentially updated order
    const currentOrder =
      updates.order !== undefined ? updates.order : existing.order;

    await this.db
      .prepare(
        `UPDATE layer SET name = ?, visible = ?, updated_at = ?
         WHERE id = ? AND canvas_id = ?`
      )
      .bind(name, visible ? 1 : 0, now, layerId, canvasId)
      .run();

    return {
      ...existing,
      name,
      order: currentOrder,
      visible,
      updatedAt: now,
    };
  }

  // Reorder a layer to a new position
  private async reorder(
    canvasId: string,
    layerId: string,
    newOrder: number
  ): Promise<void> {
    const layer = await this.getById(canvasId, layerId);
    if (!layer) return;

    const oldOrder = layer.order;
    if (oldOrder === newOrder) return;

    // Temporarily set to -1 to avoid UNIQUE constraint
    await this.db
      .prepare(`UPDATE layer SET "order" = -1 WHERE id = ?`)
      .bind(layerId)
      .run();

    if (newOrder < oldOrder) {
      // Moving up: shift layers between newOrder and oldOrder-1 down
      await this.db
        .prepare(
          `UPDATE layer SET "order" = "order" + 1
           WHERE canvas_id = ? AND "order" >= ? AND "order" < ?`
        )
        .bind(canvasId, newOrder, oldOrder)
        .run();
    } else {
      // Moving down: shift layers between oldOrder+1 and newOrder up
      await this.db
        .prepare(
          `UPDATE layer SET "order" = "order" - 1
           WHERE canvas_id = ? AND "order" > ? AND "order" <= ?`
        )
        .bind(canvasId, oldOrder, newOrder)
        .run();
    }

    // Set the layer to its new position
    await this.db
      .prepare(`UPDATE layer SET "order" = ? WHERE id = ?`)
      .bind(newOrder, layerId)
      .run();
  }

  // Delete a layer
  async delete(canvasId: string, layerId: string): Promise<boolean> {
    const existing = await this.getById(canvasId, layerId);
    if (!existing) return false;

    // Check if this is the last layer
    const count = await this.countByCanvasId(canvasId);
    if (count <= 1) {
      throw new Error('CANNOT_DELETE_LAST_LAYER');
    }

    const deletedOrder = existing.order;

    // Delete the layer (CASCADE will handle related tiles)
    await this.db
      .prepare(`DELETE FROM layer WHERE id = ? AND canvas_id = ?`)
      .bind(layerId, canvasId)
      .run();

    // Reorder remaining layers to fill the gap
    await this.db
      .prepare(
        `UPDATE layer SET "order" = "order" - 1
         WHERE canvas_id = ? AND "order" > ?`
      )
      .bind(canvasId, deletedOrder)
      .run();

    return true;
  }
}

// Factory function
export function createLayerService(env: Env): LayerService {
  return new LayerService(env.DB);
}
