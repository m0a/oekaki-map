import type {
  DrawingTile,
  TileCoordinate,
  Env,
} from '../types/index';
import { StorageService } from './storage';

// Tile database and storage operations
export class TileService {
  private db: D1Database;
  private storage: StorageService;

  constructor(db: D1Database, storage: StorageService) {
    this.db = db;
    this.storage = storage;
  }

  // Save or update a tile
  async saveTile(
    canvasId: string,
    z: number,
    x: number,
    y: number,
    imageData: ArrayBuffer
  ): Promise<DrawingTile> {
    const tileId = `${canvasId}/${z}/${x}/${y}`;
    const r2Key = StorageService.generateKey(canvasId, z, x, y);
    const now = new Date().toISOString();

    // Upload to R2
    await this.storage.uploadTile(canvasId, z, x, y, imageData);

    // Check if tile exists
    const existing = await this.db
      .prepare(`SELECT id FROM drawing_tile WHERE id = ?`)
      .bind(tileId)
      .first();

    if (existing) {
      // Update existing tile
      await this.db
        .prepare(`UPDATE drawing_tile SET updated_at = ? WHERE id = ?`)
        .bind(now, tileId)
        .run();
    } else {
      // Insert new tile
      await this.db
        .prepare(
          `INSERT INTO drawing_tile (id, canvas_id, z, x, y, r2_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(tileId, canvasId, z, x, y, r2Key, now, now)
        .run();
    }

    return {
      id: tileId,
      canvasId,
      z,
      x,
      y,
      r2Key,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Save multiple tiles
  async saveTiles(
    canvasId: string,
    tiles: Array<{ z: number; x: number; y: number; data: ArrayBuffer }>
  ): Promise<{ saved: TileCoordinate[]; newCount: number }> {
    // Check current tile count
    const countResult = await this.db
      .prepare(`SELECT tile_count FROM canvas WHERE id = ?`)
      .bind(canvasId)
      .first<{ tile_count: number }>();

    if (!countResult) {
      throw new Error('Canvas not found');
    }

    const currentCount = countResult.tile_count;
    let newTilesAdded = 0;

    const saved: TileCoordinate[] = [];

    for (const tile of tiles) {
      // Check if this is a new tile
      const tileId = `${canvasId}/${tile.z}/${tile.x}/${tile.y}`;
      const existing = await this.db
        .prepare(`SELECT id FROM drawing_tile WHERE id = ?`)
        .bind(tileId)
        .first();

      if (!existing) {
        // Check limit before adding new tile
        if (currentCount + newTilesAdded >= 1000) {
          throw new Error('Tile limit exceeded');
        }
        newTilesAdded++;
      }

      await this.saveTile(canvasId, tile.z, tile.x, tile.y, tile.data);
      saved.push({ z: tile.z, x: tile.x, y: tile.y });
    }

    // Update tile count
    if (newTilesAdded > 0) {
      await this.db
        .prepare(
          `UPDATE canvas SET tile_count = tile_count + ?, updated_at = ? WHERE id = ?`
        )
        .bind(newTilesAdded, new Date().toISOString(), canvasId)
        .run();
    }

    return { saved, newCount: currentCount + newTilesAdded };
  }

  // Get tile image from R2
  async getTileImage(
    canvasId: string,
    z: number,
    x: number,
    y: number
  ): Promise<ArrayBuffer | null> {
    const r2Key = StorageService.generateKey(canvasId, z, x, y);
    const object = await this.storage.getTile(r2Key);

    if (!object) return null;
    return object.arrayBuffer();
  }

  // Delete a tile
  async deleteTile(
    canvasId: string,
    z: number,
    x: number,
    y: number
  ): Promise<void> {
    const tileId = `${canvasId}/${z}/${x}/${y}`;
    const r2Key = StorageService.generateKey(canvasId, z, x, y);

    await this.storage.deleteTile(r2Key);
    await this.db
      .prepare(`DELETE FROM drawing_tile WHERE id = ?`)
      .bind(tileId)
      .run();
  }

  // Check if tile exists
  async tileExists(
    canvasId: string,
    z: number,
    x: number,
    y: number
  ): Promise<boolean> {
    const tileId = `${canvasId}/${z}/${x}/${y}`;
    const result = await this.db
      .prepare(`SELECT id FROM drawing_tile WHERE id = ?`)
      .bind(tileId)
      .first();

    return result !== null;
  }

  // Get tiles in visible area (with optional layer filter)
  async getTilesInArea(
    canvasId: string,
    z: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    layerId?: string
  ): Promise<TileCoordinate[]> {
    let query: string;
    let params: (string | number)[];

    if (layerId) {
      query = `SELECT z, x, y FROM drawing_tile
               WHERE canvas_id = ? AND z = ? AND x >= ? AND x <= ? AND y >= ? AND y <= ?
               AND (layer_id = ? OR layer_id IS NULL)`;
      params = [canvasId, z, minX, maxX, minY, maxY, layerId];
    } else {
      query = `SELECT z, x, y FROM drawing_tile
               WHERE canvas_id = ? AND z = ? AND x >= ? AND x <= ? AND y >= ? AND y <= ?`;
      params = [canvasId, z, minX, maxX, minY, maxY];
    }

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all<{ z: number; x: number; y: number }>();

    return results.results.map((row) => ({
      z: row.z,
      x: row.x,
      y: row.y,
    }));
  }

  // Save tile with layer association
  async saveTileWithLayer(
    canvasId: string,
    layerId: string | null,
    z: number,
    x: number,
    y: number,
    imageData: ArrayBuffer
  ): Promise<DrawingTile> {
    const tileId = `${canvasId}/${z}/${x}/${y}`;
    const r2Key = StorageService.generateKey(canvasId, z, x, y);
    const now = new Date().toISOString();

    // Upload to R2
    await this.storage.uploadTile(canvasId, z, x, y, imageData);

    // Check if tile exists
    const existing = await this.db
      .prepare(`SELECT id FROM drawing_tile WHERE id = ?`)
      .bind(tileId)
      .first();

    if (existing) {
      // Update existing tile
      await this.db
        .prepare(`UPDATE drawing_tile SET layer_id = ?, updated_at = ? WHERE id = ?`)
        .bind(layerId, now, tileId)
        .run();
    } else {
      // Insert new tile with layer_id
      await this.db
        .prepare(
          `INSERT INTO drawing_tile (id, canvas_id, layer_id, z, x, y, r2_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(tileId, canvasId, layerId, z, x, y, r2Key, now, now)
        .run();
    }

    return {
      id: tileId,
      canvasId,
      z,
      x,
      y,
      r2Key,
      createdAt: now,
      updatedAt: now,
    };
  }
}

// Factory function
export function createTileService(env: Env): TileService {
  const storage = new StorageService(env.TILES);
  return new TileService(env.DB, storage);
}
