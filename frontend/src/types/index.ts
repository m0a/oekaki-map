// Frontend-specific types only
// Backend types are imported directly from backend/src/types
import type { TileCoordinate } from '../../../backend/src/types';

// Tile info with version for HTTP caching (frontend extension)
export interface TileInfo extends TileCoordinate {
  /** Tile's last update timestamp (ISO8601) for cache versioning */
  updatedAt?: string;
}

// Map position
export interface MapPosition {
  lat: number;
  lng: number;
  zoom: number;
}

// Re-export commonly used backend types
export type { Layer } from '../../../backend/src/types';

// Re-export commonly used constants from backend
export { TILE_DIMENSION, MAX_TILES_PER_CANVAS } from '../../../backend/src/types';

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
  // Row 1: Basic colors
  '#000000', // Black
  '#FFFFFF', // White
  '#808080', // Gray
  '#C0C0C0', // Silver
  '#8B4513', // Brown
  '#D2691E', // Chocolate
  // Row 2: Reds & Pinks
  '#FF0000', // Red
  '#DC143C', // Crimson
  '#FF6347', // Tomato
  '#FF69B4', // Hot Pink
  '#FFB6C1', // Light Pink
  '#FFC0CB', // Pink
  // Row 3: Oranges & Yellows
  '#FF8000', // Orange
  '#FFA500', // Orange (standard)
  '#FFD700', // Gold
  '#FFFF00', // Yellow
  '#FFFFE0', // Light Yellow
  '#F0E68C', // Khaki
  // Row 4: Greens & Blues & Purples
  '#00FF00', // Lime
  '#228B22', // Forest Green
  '#00CED1', // Dark Turquoise
  '#0000FF', // Blue
  '#4169E1', // Royal Blue
  '#8000FF', // Purple
] as const;

export const LINE_THICKNESSES = {
  thin: 2,
  medium: 4,
  thick: 8,
} as const;

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

// OGP types (frontend-specific geocoding)
export interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  state?: string;
  country?: string;
}

export interface ReverseGeocodeResult {
  placeName: string;
  address: NominatimAddress;
}

// Re-export OGP constants from backend
export { OGP_IMAGE_WIDTH, OGP_IMAGE_HEIGHT } from '../../../backend/src/types';
