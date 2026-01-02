import L from 'leaflet';
import { TILE_DIMENSION } from '../types';

// Convert lat/lng to tile coordinates at given zoom
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

// Convert tile coordinates to lat/lng (northwest corner of tile)
export function tileToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

// Get tile bounds in lat/lng
export function getTileBounds(x: number, y: number, zoom: number): L.LatLngBounds {
  const nw = tileToLatLng(x, y, zoom);
  const se = tileToLatLng(x + 1, y + 1, zoom);
  return L.latLngBounds([se.lat, nw.lng], [nw.lat, se.lng]);
}

// Extract tiles from canvas that overlap with visible bounds
export async function extractTilesFromCanvas(
  canvas: HTMLCanvasElement,
  canvasOrigin: L.LatLng,
  canvasZoom: number,
  targetZoom: number,
  bounds: L.LatLngBounds
): Promise<Array<{ z: number; x: number; y: number; blob: Blob }>> {
  const tiles: Array<{ z: number; x: number; y: number; blob: Blob }> = [];

  // Get tile range for the visible bounds at target zoom
  const nw = bounds.getNorthWest();
  const se = bounds.getSouthEast();
  const tileNW = latLngToTile(nw.lat, nw.lng, targetZoom);
  const tileSE = latLngToTile(se.lat, se.lng, targetZoom);

  // This is an approximation - we need to check if each tile has any drawing
  for (let ty = tileNW.y; ty <= tileSE.y; ty++) {
    for (let tx = tileNW.x; tx <= tileSE.x; tx++) {
      const tileBounds = getTileBounds(tx, ty, targetZoom);

      // Check if this tile intersects with canvas content
      const tileBlob = await extractTileFromCanvas(
        canvas,
        canvasOrigin,
        canvasZoom,
        targetZoom,
        tx,
        ty,
        tileBounds
      );

      if (tileBlob) {
        tiles.push({ z: targetZoom, x: tx, y: ty, blob: tileBlob });
      }
    }
  }

  return tiles;
}

// Extract a single tile from canvas
async function extractTileFromCanvas(
  canvas: HTMLCanvasElement,
  canvasOrigin: L.LatLng,
  canvasZoom: number,
  targetZoom: number,
  _tileX: number,
  _tileY: number,
  tileBounds: L.LatLngBounds
): Promise<Blob | null> {
  const canvasSize = canvas.width;

  // Create a temporary canvas for the tile
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = TILE_DIMENSION;
  tileCanvas.height = TILE_DIMENSION;
  const tileCtx = tileCanvas.getContext('2d');
  if (!tileCtx) return null;

  // Calculate scale factor between canvas zoom and target zoom
  const scale = Math.pow(2, targetZoom - canvasZoom);

  // Get the tile corners in lat/lng
  const tileCenterLat = (tileBounds.getNorth() + tileBounds.getSouth()) / 2;
  const tileCenterLng = (tileBounds.getWest() + tileBounds.getEast()) / 2;

  // Calculate the pixel offset from canvas center to tile center at canvas zoom
  const canvasCenterX = canvasSize / 2;
  const canvasCenterY = canvasSize / 2;

  // Project both origins to get pixel offset at canvas zoom
  // Using Web Mercator projection
  const originPoint = projectToPixel(canvasOrigin.lat, canvasOrigin.lng, canvasZoom);
  const tileCenterPoint = projectToPixel(tileCenterLat, tileCenterLng, canvasZoom);

  const offsetX = tileCenterPoint.x - originPoint.x;
  const offsetY = tileCenterPoint.y - originPoint.y;

  // The source area on the original canvas
  // Tile is TILE_DIMENSION pixels at targetZoom, so at canvasZoom it's TILE_DIMENSION/scale
  const srcTileSize = TILE_DIMENSION / scale;
  const srcX = canvasCenterX + offsetX - srcTileSize / 2;
  const srcY = canvasCenterY + offsetY - srcTileSize / 2;

  // Check if source area is within canvas bounds and has content
  if (srcX + srcTileSize < 0 || srcX > canvasSize ||
      srcY + srcTileSize < 0 || srcY > canvasSize) {
    return null;
  }

  // Check if the source area has any non-transparent pixels
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const checkX = Math.max(0, Math.floor(srcX));
  const checkY = Math.max(0, Math.floor(srcY));
  const checkWidth = Math.min(Math.ceil(srcTileSize), canvasSize - checkX);
  const checkHeight = Math.min(Math.ceil(srcTileSize), canvasSize - checkY);

  if (checkWidth <= 0 || checkHeight <= 0) return null;

  const imageData = ctx.getImageData(checkX, checkY, checkWidth, checkHeight);
  let hasContent = false;
  const data = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if ((data[i] ?? 0) > 0) {
      hasContent = true;
      break;
    }
  }

  if (!hasContent) return null;

  // Draw the portion of the canvas onto the tile
  tileCtx.drawImage(
    canvas,
    srcX, srcY, srcTileSize, srcTileSize,
    0, 0, TILE_DIMENSION, TILE_DIMENSION
  );

  // Convert to WebP blob
  return new Promise<Blob | null>((resolve) => {
    tileCanvas.toBlob(
      (blob) => resolve(blob),
      'image/webp',
      0.8
    );
  });
}

// Project lat/lng to pixel coordinates at given zoom (Web Mercator)
function projectToPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = Math.pow(2, zoom) * 256;
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

// Load tiles onto canvas
export function loadTilesToCanvas(
  canvas: HTMLCanvasElement,
  canvasOrigin: L.LatLng,
  canvasZoom: number,
  tileImages: Array<{ z: number; x: number; y: number; image: HTMLImageElement }>
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const canvasSize = canvas.width;
  const canvasCenterX = canvasSize / 2;
  const canvasCenterY = canvasSize / 2;

  const originPoint = projectToPixel(canvasOrigin.lat, canvasOrigin.lng, canvasZoom);

  for (const tile of tileImages) {
    const scale = Math.pow(2, tile.z - canvasZoom);

    // Get tile center position
    const tileBounds = getTileBounds(tile.x, tile.y, tile.z);
    const tileCenterLat = (tileBounds.getNorth() + tileBounds.getSouth()) / 2;
    const tileCenterLng = (tileBounds.getWest() + tileBounds.getEast()) / 2;

    const tileCenterPoint = projectToPixel(tileCenterLat, tileCenterLng, canvasZoom);

    const offsetX = tileCenterPoint.x - originPoint.x;
    const offsetY = tileCenterPoint.y - originPoint.y;

    // Destination size on canvas
    const destTileSize = TILE_DIMENSION / scale;
    const destX = canvasCenterX + offsetX - destTileSize / 2;
    const destY = canvasCenterY + offsetY - destTileSize / 2;

    ctx.drawImage(
      tile.image,
      0, 0, TILE_DIMENSION, TILE_DIMENSION,
      destX, destY, destTileSize, destTileSize
    );
  }
}
