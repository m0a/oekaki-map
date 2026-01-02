// Canvas entity - shareable drawing surface
export interface Canvas {
  id: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
  tileCount: number;
}

// Drawing tile - stored in R2 as WebP image
export interface DrawingTile {
  id: string;
  canvasId: string;
  z: number;
  x: number;
  y: number;
  r2Key: string;
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
}

// Tile coordinate without metadata
export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

// Map position
export interface MapPosition {
  lat: number;
  lng: number;
  zoom: number;
}

// API Request types
export interface CreateCanvasRequest {
  centerLat: number;
  centerLng: number;
  zoom: number;
}

export interface UpdateCanvasRequest {
  centerLat?: number | undefined;
  centerLng?: number | undefined;
  zoom?: number | undefined;
}

export interface GetTilesQuery {
  z: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// API Response types
export interface CreateCanvasResponse {
  canvas: Canvas;
}

export interface GetCanvasResponse {
  canvas: Canvas;
  tiles: TileCoordinate[];
}

export interface GetTilesResponse {
  tiles: TileCoordinate[];
}

export interface SaveTilesResponse {
  saved: TileCoordinate[];
  canvas: Canvas;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

// Cloudflare Workers environment bindings
export interface Env {
  DB: D1Database;
  TILES: R2Bucket;
  ENVIRONMENT: string;
}

// Validation constants
export const CANVAS_ID_LENGTH = 21;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 19;
export const MAX_TILES_PER_CANVAS = 1000;
export const MAX_TILE_SIZE_BYTES = 100 * 1024; // 100KB
export const TILE_DIMENSION = 256; // 256x256 pixels
