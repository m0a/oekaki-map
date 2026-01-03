# Data Model: 地図お絵かき共有サービス

**Date**: 2026-01-02
**Storage**: Cloudflare D1 (SQLite) + Cloudflare R2 (Object Storage)

## Entity Relationship Diagram

```
┌─────────────────────────────────────┐
│              Canvas                 │
├─────────────────────────────────────┤
│ id: string (PK, nanoid)             │
│ center_lat: number                  │
│ center_lng: number                  │
│ zoom: number                        │
│ created_at: datetime                │
│ updated_at: datetime                │
│ tile_count: number                  │
└─────────────────────────────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────────────────┐
│           DrawingTile               │
├─────────────────────────────────────┤
│ id: string (PK, composite)          │
│ canvas_id: string (FK)              │
│ z: number (zoom level)              │
│ x: number (tile x coordinate)       │
│ y: number (tile y coordinate)       │
│ r2_key: string (R2 object key)      │
│ created_at: datetime                │
│ updated_at: datetime                │
└─────────────────────────────────────┘
```

## Entities

### Canvas

Represents a shareable drawing surface with a unique URL.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | TEXT | PK, nanoid(21) | Unique identifier, URL-safe |
| center_lat | REAL | NOT NULL | Map center latitude |
| center_lng | REAL | NOT NULL | Map center longitude |
| zoom | INTEGER | NOT NULL, 1-19 | Map zoom level |
| created_at | TEXT | NOT NULL, ISO8601 | Creation timestamp |
| updated_at | TEXT | NOT NULL, ISO8601 | Last modification timestamp |
| tile_count | INTEGER | NOT NULL, DEFAULT 0 | Number of tiles (for limit enforcement) |

**Indexes**:
- PRIMARY KEY (id)
- INDEX idx_canvas_updated (updated_at) -- for potential cleanup queries

**Validation Rules**:
- center_lat: -90 to 90
- center_lng: -180 to 180
- zoom: 1 to 19 (OSM zoom levels)
- tile_count: 0 to 1000 (max limit)

### DrawingTile

Represents a single tile of drawing data stored in R2.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | TEXT | PK, generated | Composite: `{canvas_id}/{z}/{x}/{y}` |
| canvas_id | TEXT | FK → Canvas.id, NOT NULL | Parent canvas |
| z | INTEGER | NOT NULL, 1-19 | Tile zoom level |
| x | INTEGER | NOT NULL, >= 0 | Tile X coordinate |
| y | INTEGER | NOT NULL, >= 0 | Tile Y coordinate |
| r2_key | TEXT | NOT NULL, UNIQUE | R2 object key for WebP image |
| created_at | TEXT | NOT NULL, ISO8601 | Creation timestamp |
| updated_at | TEXT | NOT NULL, ISO8601 | Last modification timestamp |

**Indexes**:
- PRIMARY KEY (id)
- INDEX idx_tile_canvas (canvas_id) -- for loading all tiles of a canvas
- UNIQUE INDEX idx_tile_coords (canvas_id, z, x, y) -- prevent duplicates

**Validation Rules**:
- z: 1 to 19
- x: 0 to 2^z - 1
- y: 0 to 2^z - 1

## R2 Storage Structure

```
oekaki-map-tiles/
├── {canvas_id}/
│   ├── {z}/
│   │   ├── {x}/
│   │   │   ├── {y}.webp
│   │   │   └── ...
│   │   └── ...
│   └── ...
└── ...
```

**R2 Key Format**: `{canvas_id}/{z}/{x}/{y}.webp`

**Example**: `V1StGXR8_Z5jdHi6B-myT/14/14354/6451.webp`

**Object Metadata**:
- Content-Type: `image/webp`
- Cache-Control: `public, max-age=31536000` (immutable after creation)

## D1 Schema (SQL)

```sql
-- Canvas table
CREATE TABLE IF NOT EXISTS canvas (
  id TEXT PRIMARY KEY,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  zoom INTEGER NOT NULL CHECK (zoom >= 1 AND zoom <= 19),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  tile_count INTEGER NOT NULL DEFAULT 0 CHECK (tile_count >= 0 AND tile_count <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_canvas_updated ON canvas(updated_at);

-- DrawingTile table
CREATE TABLE IF NOT EXISTS drawing_tile (
  id TEXT PRIMARY KEY,
  canvas_id TEXT NOT NULL REFERENCES canvas(id) ON DELETE CASCADE,
  z INTEGER NOT NULL CHECK (z >= 1 AND z <= 19),
  x INTEGER NOT NULL CHECK (x >= 0),
  y INTEGER NOT NULL CHECK (y >= 0),
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tile_canvas ON drawing_tile(canvas_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tile_coords ON drawing_tile(canvas_id, z, x, y);
```

## TypeScript Types

```typescript
// Shared types (backend/src/types/index.ts)

export interface Canvas {
  id: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  createdAt: string;  // ISO8601
  updatedAt: string;  // ISO8601
  tileCount: number;
}

export interface DrawingTile {
  id: string;
  canvasId: string;
  z: number;
  x: number;
  y: number;
  r2Key: string;
  createdAt: string;  // ISO8601
  updatedAt: string;  // ISO8601
}

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface MapPosition {
  lat: number;
  lng: number;
  zoom: number;
}

// API Request/Response types
export interface CreateCanvasRequest {
  centerLat: number;
  centerLng: number;
  zoom: number;
}

export interface CreateCanvasResponse {
  canvas: Canvas;
}

export interface GetCanvasResponse {
  canvas: Canvas;
  tiles: TileCoordinate[];
}

export interface SaveTilesRequest {
  canvasId: string;
  tiles: Array<{
    z: number;
    x: number;
    y: number;
    // Blob sent as multipart form data
  }>;
}

export interface SaveTilesResponse {
  saved: TileCoordinate[];
  canvas: Canvas;  // Updated tile count
}
```

## State Transitions

### Canvas Lifecycle

```
[New Visit] ──create──▶ [Empty Canvas] ──draw──▶ [Has Drawings]
                              │                        │
                              │                        │
                              ▼                        ▼
                        [Shared via URL]         [Shared via URL]
                              │                        │
                              └────────────────────────┘
                                         │
                              [Anyone can add drawings]
```

### Tile Lifecycle

```
[User draws on tile area]
         │
         ▼
[Local canvas updated]
         │
         ▼ (debounced 500ms)
[Convert to WebP blob]
         │
         ▼
[Upload to R2]
         │
         ▼
[Upsert tile record in D1]
         │
         ▼
[Update canvas tile_count]
```

## Data Retention

- **Canvas**: Permanent (no automatic deletion per FR-014)
- **Tiles**: Permanent (cascade delete if canvas deleted manually)
- **R2 Objects**: Permanent (cleaned up via D1 reference)

## Limits and Constraints

| Resource | Limit | Enforcement |
|----------|-------|-------------|
| Tiles per canvas | 1000 | Check before insert, reject if exceeded |
| Tile file size | 100KB | Client-side compression, server validation |
| Tile dimensions | 256x256 px | Fixed, matches OSM tiles |
| Canvas ID length | 21 chars | nanoid default |
| Zoom levels | 1-19 | Validation on create/save |
