import { TILE_DIMENSION } from '../types';
import type { TileData } from './tileUtils';
import { normalizeToFullTile } from './tileUtils';

// WebP quality setting (0.0 to 1.0)
const WEBP_QUALITY = 0.85;

// Maximum tile size in bytes (from spec)
const MAX_TILE_SIZE_BYTES = 100 * 1024;

/**
 * Convert ImageData to WebP Blob
 */
export async function imageDataToWebP(imageData: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create WebP blob'));
        }
      },
      'image/webp',
      WEBP_QUALITY
    );
  });
}

/**
 * Convert a tile to a WebP blob, ensuring it meets size requirements
 */
export async function tileToWebP(tile: TileData): Promise<Blob> {
  // Normalize to full tile size
  const normalizedData = normalizeToFullTile(tile.imageData);

  // Convert to WebP
  let blob = await imageDataToWebP(normalizedData);

  // If blob is too large, try reducing quality
  let quality = WEBP_QUALITY;
  while (blob.size > MAX_TILE_SIZE_BYTES && quality > 0.3) {
    quality -= 0.1;
    blob = await imageDataToWebPWithQuality(normalizedData, quality);
  }

  if (blob.size > MAX_TILE_SIZE_BYTES) {
    console.warn(`Tile ${tile.x},${tile.y} exceeds max size even at low quality`);
  }

  return blob;
}

/**
 * Convert ImageData to WebP Blob with specific quality
 */
async function imageDataToWebPWithQuality(imageData: ImageData, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create WebP blob'));
        }
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Convert multiple tiles to WebP blobs
 */
export async function tilesToWebP(
  tiles: TileData[],
  zoom: number
): Promise<Array<{ z: number; x: number; y: number; blob: Blob }>> {
  const results = await Promise.all(
    tiles.map(async (tile) => {
      const blob = await tileToWebP(tile);
      return {
        z: zoom,
        x: tile.x,
        y: tile.y,
        blob,
      };
    })
  );

  return results;
}

/**
 * Check if browser supports WebP
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob(
      (blob) => {
        resolve(blob !== null);
      },
      'image/webp',
      0.5
    );
  });
}

/**
 * Load a WebP image from URL and return as ImageData
 */
export async function loadWebPAsImageData(url: string): Promise<ImageData> {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = TILE_DIMENSION;
  canvas.height = TILE_DIMENSION;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(img, 0, 0, TILE_DIMENSION, TILE_DIMENSION);
  return ctx.getImageData(0, 0, TILE_DIMENSION, TILE_DIMENSION);
}
