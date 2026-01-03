-- Initial schema: canvas and drawing_tile tables

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
