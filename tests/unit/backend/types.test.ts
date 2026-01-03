import { describe, it, expect } from 'vitest';
import type { Canvas, DrawingTile, TileCoordinate } from '../../../backend/src/types/index';

describe('Canvas type', () => {
  it('should have required fields', () => {
    const canvas: Canvas = {
      id: 'V1StGXR8_Z5jdHi6B-myT',
      centerLat: 35.6812,
      centerLng: 139.7671,
      zoom: 14,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      tileCount: 0,
    };

    expect(canvas.id).toHaveLength(21);
    expect(canvas.centerLat).toBeGreaterThanOrEqual(-90);
    expect(canvas.centerLat).toBeLessThanOrEqual(90);
    expect(canvas.centerLng).toBeGreaterThanOrEqual(-180);
    expect(canvas.centerLng).toBeLessThanOrEqual(180);
    expect(canvas.zoom).toBeGreaterThanOrEqual(1);
    expect(canvas.zoom).toBeLessThanOrEqual(19);
    expect(canvas.tileCount).toBeGreaterThanOrEqual(0);
    expect(canvas.tileCount).toBeLessThanOrEqual(1000);
  });
});

describe('TileCoordinate type', () => {
  it('should have z, x, y fields', () => {
    const tile: TileCoordinate = {
      z: 14,
      x: 14354,
      y: 6451,
    };

    expect(tile.z).toBeGreaterThanOrEqual(1);
    expect(tile.z).toBeLessThanOrEqual(19);
    expect(tile.x).toBeGreaterThanOrEqual(0);
    expect(tile.y).toBeGreaterThanOrEqual(0);
  });

  it('should validate x and y are within zoom bounds', () => {
    const zoom = 14;
    const maxTileIndex = Math.pow(2, zoom) - 1;

    const tile: TileCoordinate = {
      z: zoom,
      x: 14354,
      y: 6451,
    };

    expect(tile.x).toBeLessThanOrEqual(maxTileIndex);
    expect(tile.y).toBeLessThanOrEqual(maxTileIndex);
  });
});

describe('DrawingTile type', () => {
  it('should have required fields with R2 key', () => {
    const tile: DrawingTile = {
      id: 'V1StGXR8_Z5jdHi6B-myT/14/14354/6451',
      canvasId: 'V1StGXR8_Z5jdHi6B-myT',
      z: 14,
      x: 14354,
      y: 6451,
      r2Key: 'V1StGXR8_Z5jdHi6B-myT/14/14354/6451.webp',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    expect(tile.id).toContain(tile.canvasId);
    expect(tile.r2Key).toContain('.webp');
    expect(tile.r2Key).toContain(`${tile.z}/${tile.x}/${tile.y}`);
  });
});
