# Data Model: Data Cleanup Mechanism

**Feature**: 010-data-cleanup
**Date**: 2026-01-08
**Status**: Phase 1 Complete

## Overview

This document defines the data entities, relationships, and validation rules for the cleanup mechanism. The primary new entity is `deletion_record`, which stores historical cleanup execution data. Additionally, we document the existing entities that the cleanup process interacts with.

## Entities

### DeletionRecord (NEW)

**Purpose**: Persistent audit trail of cleanup executions with statistics for monitoring and capacity planning.

**Table**: `deletion_record`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | Unique identifier (UUID or timestamp-based) |
| executed_at | TEXT | NOT NULL | ISO 8601 timestamp of cleanup execution |
| canvases_deleted | INTEGER | NOT NULL, >= 0 | Number of canvases deleted in this run |
| tiles_deleted | INTEGER | NOT NULL, >= 0 | Number of tiles deleted in this run |
| layers_deleted | INTEGER | NOT NULL, >= 0 | Number of layers deleted in this run |
| ogp_images_deleted | INTEGER | NOT NULL, >= 0 | Number of OGP images deleted from R2 |
| total_tiles_before | INTEGER | NOT NULL, >= 0 | System-wide tile count before cleanup |
| total_tiles_after | INTEGER | NOT NULL, >= 0 | System-wide tile count after cleanup |
| storage_reclaimed_bytes | INTEGER | NOT NULL, >= 0 | Total bytes reclaimed from R2 storage |
| orphaned_tiles_deleted | INTEGER | NOT NULL DEFAULT 0, >= 0 | Number of orphaned tiles removed |
| orphaned_ogp_deleted | INTEGER | NOT NULL DEFAULT 0, >= 0 | Number of orphaned OGP images removed |
| errors_encountered | TEXT | NULL | JSON array of error messages, if any |
| duration_ms | INTEGER | NULL, >= 0 | Execution duration in milliseconds |

**Indexes**:
```sql
CREATE INDEX idx_deletion_record_executed_at ON deletion_record(executed_at DESC);
```

**Validation Rules**:
- `executed_at` MUST be ISO 8601 format
- `total_tiles_after` MUST equal `total_tiles_before - tiles_deleted - orphaned_tiles_deleted`
- All count fields MUST be >= 0
- `errors_encountered` MUST be valid JSON array or NULL

**Relationships**:
- None (deletion records are independent audit logs)

### CleanupLock (NEW)

**Purpose**: Prevents concurrent cleanup operations using database-level locking.

**Table**: `cleanup_lock`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY CHECK (id = 1) | Always 1 (single-row table) |
| locked_at | TEXT | NOT NULL | ISO 8601 timestamp when lock was acquired |
| locked_by | TEXT | NOT NULL | Identifier of worker that acquired lock |

**Usage**:
- INSERT to acquire lock (fails if already locked)
- DELETE to release lock
- Query `locked_at` to detect stale locks (>30 minutes old)

**Validation Rules**:
- Only one row can exist (enforced by PRIMARY KEY CHECK constraint)
- `locked_at` MUST be recent (within 30 minutes) to be valid

### Canvas (EXISTING)

**Interactions**: Cleanup queries canvas table to identify deletion candidates.

**Deletion Criteria Query**:
```sql
SELECT * FROM canvas
WHERE (
  tile_count = 0
  OR (share_lat IS NULL AND share_lng IS NULL AND share_zoom IS NULL)
)
AND datetime(created_at) <= datetime('now', '-30 days')
ORDER BY created_at ASC
LIMIT 100;
```

**Referenced Fields**:
- `id` - Canvas identifier for deletion
- `created_at` - Age check for 30-day retention
- `tile_count` - Empty canvas detection
- `share_lat`, `share_lng`, `share_zoom` - Unshared canvas detection
- `ogp_image_key` - OGP image cleanup

### DrawingTile (EXISTING)

**Interactions**: Cleanup deletes tiles associated with qualifying canvases and identifies orphaned tiles.

**Referenced Fields**:
- `canvas_id` - Foreign key for cascade deletion
- `r2_key` - R2 storage key for tile deletion
- `layer_id` - Associated layer (optional)

**Orphaned Tile Query**:
```sql
SELECT dt.* FROM drawing_tile dt
LEFT JOIN canvas c ON dt.canvas_id = c.id
WHERE c.id IS NULL;
```

### Layer (EXISTING)

**Interactions**: Cleanup deletes layers associated with qualifying canvases.

**Referenced Fields**:
- `canvas_id` - Foreign key for cascade deletion

**Note**: Database CASCADE DELETE handles layer cleanup automatically.

### OGP Images (EXISTING - R2 Storage)

**Interactions**: Cleanup deletes OGP images from R2 storage.

**Storage Pattern**:
- Key format: `ogp/{canvasId}.png`
- Referenced by `canvas.ogp_image_key`

**Orphaned OGP Detection**:
- List R2 keys with prefix `ogp/`
- Check each against `canvas.ogp_image_key`
- Delete if not referenced

## Data Flow

### Cleanup Execution Flow

```
1. Acquire Lock
   └─> INSERT INTO cleanup_lock

2. Capture Before Statistics
   └─> SELECT COUNT(*) FROM drawing_tile

3. Identify Candidates (batch of 100)
   └─> SELECT FROM canvas WHERE (empty OR unshared) AND old

4. For each canvas:
   a. Get associated tiles
      └─> SELECT FROM drawing_tile WHERE canvas_id = ?
   b. Delete tiles from R2
      └─> r2.delete(tile.r2_key) [with retry]
   c. Delete tiles from DB
      └─> DELETE FROM drawing_tile WHERE canvas_id = ?
   d. Delete OGP image from R2
      └─> r2.delete(canvas.ogp_image_key) [if exists]
   e. Delete canvas record
      └─> DELETE FROM canvas WHERE id = ?

5. Identify and Clean Orphaned Data
   a. Orphaned tiles
      └─> DELETE FROM drawing_tile WHERE canvas_id NOT IN (SELECT id FROM canvas)
   b. Orphaned OGP images
      └─> R2 list + compare + delete

6. Capture After Statistics
   └─> SELECT COUNT(*) FROM drawing_tile

7. Create Deletion Record
   └─> INSERT INTO deletion_record

8. Release Lock
   └─> DELETE FROM cleanup_lock
```

## State Transitions

### Lock States

```
UNLOCKED
  ├─> [acquire] ──> LOCKED
  └─> [stale detected] ──> FORCE_UNLOCK

LOCKED
  ├─> [release] ──> UNLOCKED
  └─> [timeout] ──> STALE

STALE
  └─> [force release] ──> UNLOCKED
```

### Canvas Lifecycle (from cleanup perspective)

```
ACTIVE (tile_count > 0 OR shared)
  └─> [30 days + (tile_count=0 OR unshared)] ──> ELIGIBLE_FOR_DELETION
        └─> [cleanup runs] ──> DELETED
```

## Migration

**File**: `backend/migrations/0007_add_deletion_record.sql`

```sql
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
```

## Type Definitions

**TypeScript Types** (to be added to `backend/src/types/index.ts`):

```typescript
export interface DeletionRecord {
  id: string;
  executed_at: string; // ISO 8601
  canvases_deleted: number;
  tiles_deleted: number;
  layers_deleted: number;
  ogp_images_deleted: number;
  total_tiles_before: number;
  total_tiles_after: number;
  storage_reclaimed_bytes: number;
  orphaned_tiles_deleted: number;
  orphaned_ogp_deleted: number;
  errors_encountered: string | null; // JSON array
  duration_ms: number | null;
}

export interface CleanupLock {
  id: 1;
  locked_at: string; // ISO 8601
  locked_by: string;
}

export interface CleanupResult {
  success: boolean;
  deletion_record_id: string | null;
  canvases_processed: number;
  errors: string[];
}

export interface CleanupStats {
  canvases_deleted: number;
  tiles_deleted: number;
  layers_deleted: number;
  ogp_images_deleted: number;
  orphaned_tiles_deleted: number;
  orphaned_ogp_deleted: number;
  storage_reclaimed_bytes: number;
}
```

## Validation Examples

### Valid Deletion Record

```json
{
  "id": "dr_2026-01-08_020000",
  "executed_at": "2026-01-08T02:00:00Z",
  "canvases_deleted": 5,
  "tiles_deleted": 150,
  "layers_deleted": 10,
  "ogp_images_deleted": 3,
  "total_tiles_before": 10000,
  "total_tiles_after": 9850,
  "storage_reclaimed_bytes": 7340032,
  "orphaned_tiles_deleted": 0,
  "orphaned_ogp_deleted": 0,
  "errors_encountered": null,
  "duration_ms": 12500
}
```

### Invalid Deletion Record (fails constraint)

```json
{
  "total_tiles_before": 10000,
  "tiles_deleted": 150,
  "orphaned_tiles_deleted": 0,
  "total_tiles_after": 9800  // ❌ Should be 9850 (10000 - 150 - 0)
}
```

## Query Patterns

### Get Recent Cleanup History

```sql
SELECT * FROM deletion_record
ORDER BY executed_at DESC
LIMIT 30;
```

### Calculate Storage Trend

```sql
SELECT
  executed_at,
  total_tiles_after,
  storage_reclaimed_bytes
FROM deletion_record
WHERE executed_at >= datetime('now', '-90 days')
ORDER BY executed_at ASC;
```

### Check if Cleanup is Locked

```sql
SELECT
  CASE
    WHEN id IS NULL THEN 'unlocked'
    WHEN datetime(locked_at) < datetime('now', '-30 minutes') THEN 'stale'
    ELSE 'locked'
  END as lock_status,
  locked_at,
  locked_by
FROM cleanup_lock
WHERE id = 1;
```
