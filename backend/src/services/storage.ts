import type { Env } from '../types/index';

// R2 Storage service for tile images
export class StorageService {
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  // Generate R2 key for a tile
  static generateKey(canvasId: string, z: number, x: number, y: number): string {
    return `${canvasId}/${z}/${x}/${y}.webp`;
  }

  // Upload a tile image to R2
  async uploadTile(
    canvasId: string,
    z: number,
    x: number,
    y: number,
    data: ArrayBuffer
  ): Promise<string> {
    const key = StorageService.generateKey(canvasId, z, x, y);

    await this.bucket.put(key, data, {
      httpMetadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000', // 1 year, immutable
      },
    });

    return key;
  }

  // Get a tile image from R2
  async getTile(key: string): Promise<R2ObjectBody | null> {
    const object = await this.bucket.get(key);
    return object;
  }

  // Delete a tile image from R2
  async deleteTile(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  // Delete all tiles for a canvas
  async deleteCanvasTiles(canvasId: string): Promise<void> {
    const prefix = `${canvasId}/`;
    const listed = await this.bucket.list({ prefix });

    if (listed.objects.length > 0) {
      const keys = listed.objects.map((obj) => obj.key);
      await Promise.all(keys.map((key) => this.bucket.delete(key)));
    }
  }

  // Check if a tile exists
  async tileExists(key: string): Promise<boolean> {
    const object = await this.bucket.head(key);
    return object !== null;
  }
}

// Factory function for creating storage service
export function createStorageService(env: Env): StorageService {
  return new StorageService(env.TILES);
}
