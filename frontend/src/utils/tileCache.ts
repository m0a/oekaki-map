/**
 * TileCache - メモリ内タイル画像キャッシュ
 *
 * タイル画像をメモリにキャッシュし、Canvas再描画時に
 * 毎回サーバーから取得することなく即座に描画できるようにする。
 * LRU（Least Recently Used）方式で古いタイルを削除。
 */

export interface CachedTile {
  /** タイル画像（HTMLImageElement） */
  image: HTMLImageElement;
  /** ズームレベル */
  z: number;
  /** X座標（タイル座標系） */
  x: number;
  /** Y座標（タイル座標系） */
  y: number;
  /** キャッシュに追加された時刻（Date.now()） */
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
