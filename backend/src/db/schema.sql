-- Oekaki Map Database Schema
-- Storage: Cloudflare D1 (SQLite-compatible)

-- Canvas table: shareable drawing surface
CREATE TABLE IF NOT EXISTS canvas (
  id TEXT PRIMARY KEY,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  zoom INTEGER NOT NULL CHECK (zoom >= 1 AND zoom <= 19),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  tile_count INTEGER NOT NULL DEFAULT 0 CHECK (tile_count >= 0 AND tile_count <= 1000)
);

-- Index for potential cleanup queries
CREATE INDEX IF NOT EXISTS idx_canvas_updated ON canvas(updated_at);

-- DrawingTile table: references to R2 stored WebP images
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

-- Index for loading tiles by canvas
CREATE INDEX IF NOT EXISTS idx_tile_canvas ON drawing_tile(canvas_id);

-- Prevent duplicate tiles at same coordinates
CREATE UNIQUE INDEX IF NOT EXISTS idx_tile_coords ON drawing_tile(canvas_id, z, x, y);
