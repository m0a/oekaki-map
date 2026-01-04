# Quickstart: タイル表示安定性の修正

**Feature**: 007-tile-display-stability | **Date**: 2026-01-04

## Prerequisites

- Node.js 20+
- pnpm（monorepo）
- 開発サーバー起動可能

## 実装手順

### Step 1: TileCacheクラスの作成

**ファイル**: `frontend/src/utils/tileCache.ts`

```typescript
export interface CachedTile {
  image: HTMLImageElement;
  z: number;
  x: number;
  y: number;
  loadedAt: number;
}

export class TileCache {
  private cache: Map<string, CachedTile> = new Map();
  private maxSize: number;

  constructor(maxSize = 150) {
    this.maxSize = maxSize;
  }

  private getKey(canvasId: string, z: number, x: number, y: number): string {
    return `${canvasId}:${z}:${x}:${y}`;
  }

  get(canvasId: string, z: number, x: number, y: number): CachedTile | undefined {
    return this.cache.get(this.getKey(canvasId, z, x, y));
  }

  set(canvasId: string, z: number, x: number, y: number, image: HTMLImageElement): void {
    const key = this.getKey(canvasId, z, x, y);

    // LRU: 最大サイズ超過時に古いエントリを削除
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = [...this.cache.entries()].sort(
        ([, a], [, b]) => a.loadedAt - b.loadedAt
      )[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }

    this.cache.set(key, {
      image,
      z,
      x,
      y,
      loadedAt: Date.now(),
    });
  }

  clear(canvasId?: string): void {
    if (canvasId) {
      const prefix = `${canvasId}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  getAllForCanvas(canvasId: string): CachedTile[] {
    const prefix = `${canvasId}:`;
    return [...this.cache.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, tile]) => tile);
  }

  size(): number {
    return this.cache.size;
  }
}

// シングルトンインスタンス
export const tileCache = new TileCache();
```

### Step 2: バックエンド - タイルメタデータAPIにupdatedAt追加

**ファイル**: `backend/src/services/tiles.ts`

`getTilesInArea`メソッドを修正して`updated_at`を返すように変更：

```typescript
// getTilesInAreaメソッドを修正
async getTilesInArea(
  canvasId: string,
  z: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  layerId?: string
): Promise<Array<{ z: number; x: number; y: number; updatedAt: string }>> {
  let query: string;
  let params: (string | number)[];

  if (layerId) {
    query = `SELECT z, x, y, updated_at FROM drawing_tile
             WHERE canvas_id = ? AND z = ? AND x >= ? AND x <= ? AND y >= ? AND y <= ?
             AND (layer_id = ? OR layer_id IS NULL)`;
    params = [canvasId, z, minX, maxX, minY, maxY, layerId];
  } else {
    query = `SELECT z, x, y, updated_at FROM drawing_tile
             WHERE canvas_id = ? AND z = ? AND x >= ? AND x <= ? AND y >= ? AND y <= ?`;
    params = [canvasId, z, minX, maxX, minY, maxY];
  }

  const results = await this.db
    .prepare(query)
    .bind(...params)
    .all<{ z: number; x: number; y: number; updated_at: string }>();

  return results.results.map((row) => ({
    z: row.z,
    x: row.x,
    y: row.y,
    updatedAt: row.updated_at,  // 追加
  }));
}
```

### Step 3: バックエンド - タイル画像のCache-Controlヘッダー変更

**ファイル**: `backend/src/routes/tiles.ts`

```typescript
// GET /tiles/:canvasId/:z/:x/:filename のレスポンスを修正
return new Response(imageData, {
  headers: {
    'Content-Type': 'image/webp',
    'Cache-Control': 'public, max-age=31536000, immutable',  // 1年キャッシュ
  },
});
```

### Step 4: useTileCacheフックの作成

**ファイル**: `frontend/src/hooks/useTileCache.ts`

```typescript
import { useState, useCallback } from 'react';
import { tileCache, type CachedTile } from '../utils/tileCache';
import type { TileInfo } from '../types';
import { api } from '../services/api';

export interface UseTileCacheResult {
  loadTile: (canvasId: string, tile: TileInfo) => Promise<HTMLImageElement>;
  loadTiles: (canvasId: string, tiles: TileInfo[]) => Promise<HTMLImageElement[]>;
  getCachedTiles: (canvasId: string) => CachedTile[];
  clearCache: (canvasId?: string) => void;
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
          .filter((r): r is PromiseFulfilledResult<HTMLImageElement> =>
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
```

### Step 5: フロントエンド - API呼び出しにupdatedAt追加

**ファイル**: `frontend/src/services/api.ts`

```typescript
// getImageUrlメソッドを修正
getImageUrl(canvasId: string, z: number, x: number, y: number, updatedAt?: string): string {
  const base = `${API_BASE}/tiles/${canvasId}/${z}/${x}/${y}.webp`;
  return updatedAt ? `${base}?v=${updatedAt}` : base;
}
```

### Step 6: MapWithDrawing.tsxの修正

**修正箇所**:

1. **useTileCacheフックのインポートと使用**
2. **redrawAll関数の作成**
3. **既存useEffectの修正**

```typescript
// インポート追加
import { useTileCache } from '../../hooks/useTileCache';
import { loadTilesToCanvas } from '../../utils/tiles';

// コンポーネント内
const { loadTiles, getCachedTiles, clearCache, isLoading } = useTileCache();

// redrawAll関数（redrawStrokesを置換）
const redrawAll = useCallback(() => {
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || !canvasId) return;

  // 1. キャンバス全消去
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. キャッシュからタイルを描画
  const cachedTiles = getCachedTiles(canvasId);
  const canvasOrigin = getCanvasOrigin(); // 既存関数

  for (const tile of cachedTiles) {
    // loadTilesToCanvasのロジックを使用してタイルを描画
    const tilePixelSize = TILE_DIMENSION / Math.pow(2, canvasOrigin.zoom - tile.z);
    const destX = (tile.x - canvasOrigin.x * Math.pow(2, tile.z - canvasOrigin.zoom)) * tilePixelSize;
    const destY = (tile.y - canvasOrigin.y * Math.pow(2, tile.z - canvasOrigin.zoom)) * tilePixelSize;

    ctx.drawImage(tile.image, destX, destY, tilePixelSize, tilePixelSize);
  }

  // 3. ストロークを描画（既存のredrawStrokesロジック）
  const strokesToRedraw = strokes.filter(
    (s) => !visibleLayerIds || visibleLayerIds.includes(s.layerId)
  );

  for (const stroke of strokesToRedraw) {
    // 既存のストローク描画ロジック
    // ...
  }
}, [canvasId, strokes, visibleLayerIds, getCachedTiles]);

// useEffectの修正
useEffect(() => {
  if (strokes !== undefined) {
    redrawAll(); // redrawStrokes → redrawAll
  }
}, [strokes, visibleLayerIds, redrawAll]);

// タイル読み込みuseEffectの修正
useEffect(() => {
  if (!tiles || !canvasId) return;

  const loadAndRender = async () => {
    await loadTiles(canvasId, tiles);
    redrawAll(); // 読み込み後に再描画
  };

  loadAndRender();
}, [tiles, canvasId, loadTiles, redrawAll]);
```

### Step 7: テストの作成

**ファイル**: `frontend/src/utils/tileCache.test.ts`

```typescript
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
  });

  it('should clear tiles for specific canvas', () => {
    const img = new Image();
    cache.set('canvas1', 17, 100, 200, img);
    cache.set('canvas2', 17, 100, 200, img);

    cache.clear('canvas1');

    expect(cache.get('canvas1', 17, 100, 200)).toBeUndefined();
    expect(cache.get('canvas2', 17, 100, 200)).toBeDefined();
  });

  it('should get all tiles for canvas', () => {
    const img = new Image();
    cache.set('canvas1', 17, 100, 200, img);
    cache.set('canvas1', 17, 101, 200, img);
    cache.set('canvas2', 17, 100, 200, img);

    const tiles = cache.getAllForCanvas('canvas1');
    expect(tiles).toHaveLength(2);
  });
});
```

## 確認コマンド

```bash
# 開発サーバー起動
cd frontend && pnpm dev

# テスト実行
pnpm test

# 型チェック
pnpm tsc --noEmit
```

## Manual Testing Checklist

**表示安定性**:
1. [ ] キャンバスを開いてタイルが表示される
2. [ ] ページを10回リロードし、毎回タイルが表示される
3. [ ] Undo/Redoを10回実行し、タイルが消えない
4. [ ] ナビゲート⇔描画モードを20回切替え、タイルが消えない
5. [ ] 地図をパン/ズームしてもタイルが追従する

**HTTPキャッシュ**:
6. [ ] DevTools Networkタブで地図を移動→戻る、タイルリクエストが「disk cache」になる
7. [ ] タイル画像URLに`?v=`パラメータが付いている
8. [ ] 描画を保存後、保存したタイルのURLの`?v=`値が更新されている
9. [ ] 保存後リロードして新しい描画内容が表示される
