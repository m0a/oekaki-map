import { nanoid } from 'nanoid';
import type {
  Canvas,
  TileCoordinate,
  TileCoordinateWithVersion,
  CreateCanvasRequest,
  UpdateCanvasRequest,
  Env,
} from '../types/index';

// Canvas database operations
export class CanvasService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Create a new canvas
  async create(data: CreateCanvasRequest): Promise<Canvas> {
    const id = nanoid(21);
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO canvas (id, center_lat, center_lng, zoom, share_lat, share_lng, share_zoom, created_at, updated_at, tile_count)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 0)`
      )
      .bind(id, data.centerLat, data.centerLng, data.zoom, now, now)
      .run();

    return {
      id,
      centerLat: data.centerLat,
      centerLng: data.centerLng,
      zoom: data.zoom,
      shareLat: null,
      shareLng: null,
      shareZoom: null,
      createdAt: now,
      updatedAt: now,
      tileCount: 0,
      ogpImageKey: null,
      ogpPlaceName: null,
      ogpGeneratedAt: null,
    };
  }

  // Get canvas by ID
  async get(id: string): Promise<Canvas | null> {
    const result = await this.db
      .prepare(
        `SELECT id, center_lat, center_lng, zoom, share_lat, share_lng, share_zoom,
                created_at, updated_at, tile_count, ogp_image_key, ogp_place_name, ogp_generated_at
         FROM canvas WHERE id = ?`
      )
      .bind(id)
      .first<{
        id: string;
        center_lat: number;
        center_lng: number;
        zoom: number;
        share_lat: number | null;
        share_lng: number | null;
        share_zoom: number | null;
        created_at: string;
        updated_at: string;
        tile_count: number;
        ogp_image_key: string | null;
        ogp_place_name: string | null;
        ogp_generated_at: string | null;
      }>();

    if (!result) return null;

    return {
      id: result.id,
      centerLat: result.center_lat,
      centerLng: result.center_lng,
      zoom: result.zoom,
      shareLat: result.share_lat,
      shareLng: result.share_lng,
      shareZoom: result.share_zoom,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      tileCount: result.tile_count,
      ogpImageKey: result.ogp_image_key,
      ogpPlaceName: result.ogp_place_name,
      ogpGeneratedAt: result.ogp_generated_at,
    };
  }

  // Update canvas metadata
  async update(
    id: string,
    data: UpdateCanvasRequest
  ): Promise<Canvas | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const centerLat = data.centerLat ?? existing.centerLat;
    const centerLng = data.centerLng ?? existing.centerLng;
    const zoom = data.zoom ?? existing.zoom;

    // Handle share state update
    const hasShareUpdate = data.shareLat !== undefined || data.shareLng !== undefined || data.shareZoom !== undefined;
    const shareLat = hasShareUpdate ? (data.shareLat ?? existing.shareLat) : existing.shareLat;
    const shareLng = hasShareUpdate ? (data.shareLng ?? existing.shareLng) : existing.shareLng;
    const shareZoom = hasShareUpdate ? (data.shareZoom ?? existing.shareZoom) : existing.shareZoom;

    await this.db
      .prepare(
        `UPDATE canvas SET center_lat = ?, center_lng = ?, zoom = ?, share_lat = ?, share_lng = ?, share_zoom = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(centerLat, centerLng, zoom, shareLat, shareLng, shareZoom, now, id)
      .run();

    return {
      ...existing,
      centerLat,
      centerLng,
      zoom,
      shareLat,
      shareLng,
      shareZoom,
      updatedAt: now,
    };
  }

  // Get all tile coordinates for a canvas (with updatedAt for cache versioning)
  async getTileCoordinates(canvasId: string): Promise<TileCoordinateWithVersion[]> {
    const results = await this.db
      .prepare(`SELECT z, x, y, updated_at FROM drawing_tile WHERE canvas_id = ?`)
      .bind(canvasId)
      .all<{ z: number; x: number; y: number; updated_at: string }>();

    return results.results.map((row) => ({
      z: row.z,
      x: row.x,
      y: row.y,
      updatedAt: row.updated_at,
    }));
  }

  // Get tiles in visible area
  async getTilesInArea(
    canvasId: string,
    z: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): Promise<TileCoordinate[]> {
    const results = await this.db
      .prepare(
        `SELECT z, x, y FROM drawing_tile
         WHERE canvas_id = ? AND z = ? AND x >= ? AND x <= ? AND y >= ? AND y <= ?`
      )
      .bind(canvasId, z, minX, maxX, minY, maxY)
      .all<{ z: number; x: number; y: number }>();

    return results.results.map((row) => ({
      z: row.z,
      x: row.x,
      y: row.y,
    }));
  }

  // Increment tile count
  async incrementTileCount(canvasId: string, delta: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE canvas SET tile_count = tile_count + ?, updated_at = ? WHERE id = ?`
      )
      .bind(delta, new Date().toISOString(), canvasId)
      .run();
  }
}

// Factory function
export function createCanvasService(env: Env): CanvasService {
  return new CanvasService(env.DB);
}
