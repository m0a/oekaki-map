-- Migration: Add layers support
-- Date: 2026-01-03
-- Feature: 003-layer-structure

-- Layer table: drawing layers within a canvas
CREATE TABLE IF NOT EXISTS layer (
  id TEXT PRIMARY KEY,
  canvas_id TEXT NOT NULL REFERENCES canvas(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) <= 50),
  "order" INTEGER NOT NULL CHECK ("order" >= 0),
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (canvas_id, "order")
);

-- Index for loading layers by canvas
CREATE INDEX IF NOT EXISTS idx_layer_canvas ON layer(canvas_id);

-- Add layer_id to drawing_tile for layer association
-- NULL means "default layer" for backward compatibility
ALTER TABLE drawing_tile ADD COLUMN layer_id TEXT REFERENCES layer(id) ON DELETE CASCADE;

-- Index for loading tiles by layer
CREATE INDEX IF NOT EXISTS idx_tile_layer ON drawing_tile(layer_id);
