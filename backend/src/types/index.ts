// Canvas entity - shareable drawing surface
export interface Canvas {
  id: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  shareLat: number | null;
  shareLng: number | null;
  shareZoom: number | null;
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
  tileCount: number;
  ogpImageKey: string | null;
  ogpPlaceName: string | null;
  ogpGeneratedAt: string | null;
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

// Tile coordinate with version info for HTTP caching
export interface TileCoordinateWithVersion extends TileCoordinate {
  /** Tile's last update timestamp (ISO8601) for cache versioning */
  updatedAt: string;
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
  shareLat?: number | undefined;
  shareLng?: number | undefined;
  shareZoom?: number | undefined;
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
  tiles: TileCoordinateWithVersion[];
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

// Layer entity - drawing layer within a canvas
export interface Layer {
  id: string;
  canvasId: string;
  name: string;
  order: number; // 0 is bottom layer
  visible: boolean;
  createdAt: string; // ISO8601
  updatedAt: string; // ISO8601
}

// Layer API Request types
export interface CreateLayerRequest {
  name?: string; // Optional, auto-generated if not provided
}

export interface UpdateLayerRequest {
  name?: string;
  order?: number;
  visible?: boolean;
}

// Layer API Response types
export interface GetLayersResponse {
  layers: Layer[];
}

export interface CreateLayerResponse {
  layer: Layer;
}

export interface UpdateLayerResponse {
  layer: Layer;
}

// Layer constants
export const MAX_LAYERS_PER_CANVAS = 10;
export const MAX_LAYER_NAME_LENGTH = 50;

// OGP types
export interface OGPMetadata {
  title: string;
  description: string;
  imageUrl: string;
  pageUrl: string;
  imageWidth: number;
  imageHeight: number;
  siteName: string;
}

export interface OGPUploadRequest {
  placeName: string;
}

export interface OGPUploadResponse {
  success: boolean;
  imageUrl: string;
  placeName: string;
  generatedAt: string;
}

// OGP constants
export const OGP_IMAGE_WIDTH = 1200;
export const OGP_IMAGE_HEIGHT = 630;
export const OGP_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const OGP_MAX_PLACE_NAME_LENGTH = 100;
