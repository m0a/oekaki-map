import { describe, it, expect, beforeEach } from 'vitest';
import { TileCache } from './tileCache';

describe('TileCache', () => {
  let cache: TileCache;

  beforeEach(() => {
    cache = new TileCache(3); // テスト用に小さいサイズ
  });

  it('should store and retrieve tiles', () => {
    const img = new Image();
    cache.set('canvas1', 17, 100, 200, img);

    const result = cache.get('canvas1', 17, 100, 200);
    expect(result?.image).toBe(img);
    expect(result?.z).toBe(17);
    expect(result?.x).toBe(100);
    expect(result?.y).toBe(200);
  });

  it('should return undefined for non-existent tiles', () => {
    expect(cache.get('canvas1', 17, 100, 200)).toBeUndefined();
  });

  it('should evict oldest tile when max size exceeded', () => {
    const img1 = new Image();
    const img2 = new Image();
    const img3 = new Image();
    const img4 = new Image();

    cache.set('c', 1, 0, 0, img1);
    cache.set('c', 1, 0, 1, img2);
    cache.set('c', 1, 0, 2, img3);
    cache.set('c', 1, 0, 3, img4); // img1 should be evicted

    expect(cache.get('c', 1, 0, 0)).toBeUndefined();
    expect(cache.get('c', 1, 0, 3)).toBeDefined();
    expect(cache.size()).toBe(3);
  });

  it('should not evict when updating existing key', () => {
    const img1 = new Image();
    const img2 = new Image();
    const img3 = new Image();
    const img1Updated = new Image();

    cache.set('c', 1, 0, 0, img1);
    cache.set('c', 1, 0, 1, img2);
    cache.set('c', 1, 0, 2, img3);
    cache.set('c', 1, 0, 0, img1Updated); // Update existing key

    expect(cache.get('c', 1, 0, 0)?.image).toBe(img1Updated);
    expect(cache.size()).toBe(3);
  });

  it('should clear tiles for specific canvas', () => {
    const img = new Image();
    cache.set('canvas1', 17, 100, 200, img);
    cache.set('canvas2', 17, 100, 200, img);

    cache.clear('canvas1');

    expect(cache.get('canvas1', 17, 100, 200)).toBeUndefined();
    expect(cache.get('canvas2', 17, 100, 200)).toBeDefined();
  });

  it('should clear all tiles when no canvasId provided', () => {
    const img = new Image();
    cache.set('canvas1', 17, 100, 200, img);
    cache.set('canvas2', 17, 100, 200, img);

    cache.clear();

    expect(cache.size()).toBe(0);
  });

  it('should get all tiles for canvas', () => {
    const img = new Image();
    cache.set('canvas1', 17, 100, 200, img);
    cache.set('canvas1', 17, 101, 200, img);
    cache.set('canvas2', 17, 100, 200, img);

    const tiles = cache.getAllForCanvas('canvas1');
    expect(tiles).toHaveLength(2);
  });

  it('should return empty array for canvas with no tiles', () => {
    const tiles = cache.getAllForCanvas('nonexistent');
    expect(tiles).toHaveLength(0);
  });

  it('should track loadedAt timestamp', () => {
    const img = new Image();
    const before = Date.now();
    cache.set('canvas1', 17, 100, 200, img);
    const after = Date.now();

    const result = cache.get('canvas1', 17, 100, 200);
    expect(result?.loadedAt).toBeGreaterThanOrEqual(before);
    expect(result?.loadedAt).toBeLessThanOrEqual(after);
  });
});
