import { TILE_DIMENSION } from '../types';

export interface TileData {
  x: number;
  y: number;
  imageData: ImageData;
}

/**
 * Extract tiles from a canvas based on dirty tile coordinates
 * @param canvas - The source canvas element
 * @param dirtyTiles - Set of tile keys in "x,y" format
 * @param zoom - Current map zoom level
 * @returns Array of tile data with coordinates and ImageData
 */
export function extractDirtyTiles(
  canvas: HTMLCanvasElement,
  dirtyTiles: Set<string>,
  _zoom: number
): TileData[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const tiles: TileData[] = [];

  for (const key of dirtyTiles) {
    const [xStr, yStr] = key.split(',');
    const tileX = parseInt(xStr ?? '0', 10);
    const tileY = parseInt(yStr ?? '0', 10);

    // Calculate pixel coordinates for this tile
    const pixelX = tileX * TILE_DIMENSION;
    const pixelY = tileY * TILE_DIMENSION;

    // Ensure we don't read outside canvas bounds
    const width = Math.min(TILE_DIMENSION, canvas.width - pixelX);
    const height = Math.min(TILE_DIMENSION, canvas.height - pixelY);

    if (width <= 0 || height <= 0) continue;

    // Extract tile image data
    const imageData = ctx.getImageData(pixelX, pixelY, width, height);

    // Only include tiles that have actual content (not empty)
    if (hasTileContent(imageData)) {
      tiles.push({
        x: tileX,
        y: tileY,
        imageData,
      });
    }
  }

  return tiles;
}

/**
 * Check if an ImageData contains any non-transparent pixels
 */
export function hasTileContent(imageData: ImageData): boolean {
  const data = imageData.data;
  // Check alpha channel (every 4th byte starting from index 3)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true;
  }
  return false;
}

/**
 * Convert pixel coordinates to tile coordinates
 */
export function pixelToTile(pixelX: number, pixelY: number): { x: number; y: number } {
  return {
    x: Math.floor(pixelX / TILE_DIMENSION),
    y: Math.floor(pixelY / TILE_DIMENSION),
  };
}

/**
 * Convert tile coordinates to pixel coordinates (top-left corner)
 */
export function tileToPixel(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: tileX * TILE_DIMENSION,
    y: tileY * TILE_DIMENSION,
  };
}

/**
 * Calculate which tiles are visible in the viewport
 */
export function getVisibleTiles(
  viewportWidth: number,
  viewportHeight: number,
  offsetX: number,
  offsetY: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  const minX = Math.floor(offsetX / TILE_DIMENSION);
  const minY = Math.floor(offsetY / TILE_DIMENSION);
  const maxX = Math.ceil((offsetX + viewportWidth) / TILE_DIMENSION);
  const maxY = Math.ceil((offsetY + viewportHeight) / TILE_DIMENSION);

  return { minX, maxX, minY, maxY };
}

/**
 * Create a full-size tile ImageData from a possibly smaller one
 * (for tiles at canvas edges that may be smaller than TILE_DIMENSION)
 */
export function normalizeToFullTile(imageData: ImageData): ImageData {
  if (imageData.width === TILE_DIMENSION && imageData.height === TILE_DIMENSION) {
    return imageData;
  }

  // Create a new canvas to handle the conversion
  const canvas = document.createElement('canvas');
  canvas.width = TILE_DIMENSION;
  canvas.height = TILE_DIMENSION;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // Put the original image data
  ctx.putImageData(imageData, 0, 0);

  // Get the full-size image data
  return ctx.getImageData(0, 0, TILE_DIMENSION, TILE_DIMENSION);
}
