// Shared types (mirrored from backend for type safety without cross-project compilation)

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

// API Response types
export interface GetCanvasResponse {
  canvas: Canvas;
  tiles: TileCoordinate[];
}

export interface SaveTilesResponse {
  saved: TileCoordinate[];
  canvas: Canvas;
}

// Validation constants
export const CANVAS_ID_LENGTH = 21;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 19;
export const MAX_TILES_PER_CANVAS = 1000;
export const TILE_DIMENSION = 256; // 256x256 pixels

// Frontend-specific types
export interface DrawingState {
  isDrawing: boolean;
  color: string;
  thickness: number;
  mode: 'draw' | 'erase' | 'navigate';
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  thickness: number;
  timestamp: number;
}

export type ToolType = 'pen' | 'eraser';

export const DEFAULT_COLORS = [
  '#000000', // Black
  '#FF0000', // Red
  '#0000FF', // Blue
  '#00FF00', // Green
  '#FFFF00', // Yellow
  '#FF8000', // Orange
  '#8000FF', // Purple
  '#FFFFFF', // White
] as const;

export const LINE_THICKNESSES = {
  thin: 2,
  medium: 4,
  thick: 8,
} as const;

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

// Layer state management
export interface LayersState {
  layers: Layer[];
  activeLayerId: string | null;
  isLoading: boolean;
  error: string | null;
}

// Layer constants
export const MAX_LAYERS_PER_CANVAS = 10;
export const DEFAULT_LAYER_NAME_PREFIX = 'レイヤー';

// Toolbar popup types
export type PopupType = 'none' | 'color' | 'thickness';

// Undo/Redo types
export interface StrokeData {
  /** Unique identifier for the stroke */
  id: string;
  /** Layer this stroke belongs to */
  layerId: string;
  /** Points that make up this stroke (Geographic coordinates for position independence) */
  points: Array<{ lat: number; lng: number }>;
  /** Stroke color (HEX format, e.g., "#000000") */
  color: string;
  /** Stroke thickness in pixels at the original zoom level */
  thickness: number;
  /** Drawing mode when stroke was created */
  mode: 'draw' | 'erase';
  /** Timestamp when stroke was created (Unix timestamp) */
  timestamp: number;
  /** Zoom level when stroke was drawn (used for thickness scaling) */
  zoom: number;
}
