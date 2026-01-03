import type { Env } from '../types/index';

export class OGPStorageService {
  private bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  static generateKey(canvasId: string): string {
    return `ogp/${canvasId}.png`;
  }

  async uploadImage(canvasId: string, imageData: ArrayBuffer): Promise<string> {
    const key = OGPStorageService.generateKey(canvasId);

    await this.bucket.put(key, imageData, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=86400',
      },
    });

    return key;
  }

  async getImage(canvasId: string): Promise<R2ObjectBody | null> {
    const key = OGPStorageService.generateKey(canvasId);
    return this.bucket.get(key);
  }

  async deleteImage(canvasId: string): Promise<void> {
    const key = OGPStorageService.generateKey(canvasId);
    await this.bucket.delete(key);
  }

  async imageExists(canvasId: string): Promise<boolean> {
    const key = OGPStorageService.generateKey(canvasId);
    const head = await this.bucket.head(key);
    return head !== null;
  }
}

export function createOGPStorageService(env: Env): OGPStorageService {
  return new OGPStorageService(env.TILES);
}
