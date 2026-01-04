import { useState, useCallback } from 'react';
import { tileCache, type CachedTile } from '../utils/tileCache';
import type { TileInfo } from '../types';
import { api } from '../services/api';

export interface UseTileCacheResult {
  /** タイルを読み込み、キャッシュに追加 */
  loadTile: (canvasId: string, tile: TileInfo) => Promise<HTMLImageElement>;
  /** 複数タイルを並列読み込み */
  loadTiles: (canvasId: string, tiles: TileInfo[]) => Promise<HTMLImageElement[]>;
  /** キャッシュから指定キャンバスの全タイルを取得 */
  getCachedTiles: (canvasId: string) => CachedTile[];
  /** キャッシュをクリア */
  clearCache: (canvasId?: string) => void;
  /** 読み込み中かどうか */
  isLoading: boolean;
}

export function useTileCache(): UseTileCacheResult {
  const [isLoading, setIsLoading] = useState(false);

  const loadTile = useCallback(
    async (canvasId: string, tile: TileInfo): Promise<HTMLImageElement> => {
      // キャッシュチェック
      const cached = tileCache.get(canvasId, tile.z, tile.x, tile.y);
      if (cached) {
        return cached.image;
      }

      // 新規読み込み
      const img = new Image();
      img.crossOrigin = 'anonymous';

      return new Promise((resolve, reject) => {
        img.onload = () => {
          tileCache.set(canvasId, tile.z, tile.x, tile.y, img);
          resolve(img);
        };
        img.onerror = reject;
        // updatedAtをバージョンパラメータとして付与
        img.src = api.tiles.getImageUrl(canvasId, tile.z, tile.x, tile.y, tile.updatedAt);
      });
    },
    []
  );

  const loadTiles = useCallback(
    async (canvasId: string, tiles: TileInfo[]): Promise<HTMLImageElement[]> => {
      setIsLoading(true);
      try {
        const results = await Promise.allSettled(
          tiles.map((tile) => loadTile(canvasId, tile))
        );
        return results
          .filter(
            (r): r is PromiseFulfilledResult<HTMLImageElement> =>
              r.status === 'fulfilled'
          )
          .map((r) => r.value);
      } finally {
        setIsLoading(false);
      }
    },
    [loadTile]
  );

  const getCachedTiles = useCallback((canvasId: string): CachedTile[] => {
    return tileCache.getAllForCanvas(canvasId);
  }, []);

  const clearCache = useCallback((canvasId?: string): void => {
    tileCache.clear(canvasId);
  }, []);

  return {
    loadTile,
    loadTiles,
    getCachedTiles,
    clearCache,
    isLoading,
  };
}
