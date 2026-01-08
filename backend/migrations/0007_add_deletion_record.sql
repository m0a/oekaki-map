-- Migration: Add deletion tracking tables
-- Feature: 010-data-cleanup

-- Deletion record audit table
CREATE TABLE IF NOT EXISTS deletion_record (
  id TEXT PRIMARY KEY,
  executed_at TEXT NOT NULL,
  canvases_deleted INTEGER NOT NULL CHECK (canvases_deleted >= 0),
  tiles_deleted INTEGER NOT NULL CHECK (tiles_deleted >= 0),
  layers_deleted INTEGER NOT NULL CHECK (layers_deleted >= 0),
  ogp_images_deleted INTEGER NOT NULL CHECK (ogp_images_deleted >= 0),
  total_tiles_before INTEGER NOT NULL CHECK (total_tiles_before >= 0),
  total_tiles_after INTEGER NOT NULL CHECK (total_tiles_after >= 0),
  storage_reclaimed_bytes INTEGER NOT NULL CHECK (storage_reclaimed_bytes >= 0),
  orphaned_tiles_deleted INTEGER NOT NULL DEFAULT 0 CHECK (orphaned_tiles_deleted >= 0),
  orphaned_ogp_deleted INTEGER NOT NULL DEFAULT 0 CHECK (orphaned_ogp_deleted >= 0),
  errors_encountered TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_deletion_record_executed_at ON deletion_record(executed_at DESC);

-- Cleanup lock table (single-row for concurrency control)
CREATE TABLE IF NOT EXISTS cleanup_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  locked_at TEXT NOT NULL,
  locked_by TEXT NOT NULL
);
