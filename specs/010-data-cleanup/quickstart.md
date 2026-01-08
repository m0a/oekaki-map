# Developer Quickstart: Data Cleanup Mechanism

**Feature**: 010-data-cleanup
**Date**: 2026-01-08
**Audience**: Developers implementing or maintaining the cleanup feature

## Overview

This guide helps developers quickly understand and work with the data cleanup system. Follow these steps to set up, develop, test, and deploy the cleanup mechanism.

## Prerequisites

- Node.js 20+ installed
- pnpm package manager
- Cloudflare account with Workers/D1/R2 access
- Wrangler CLI configured (`wrangler login`)
- Local development environment set up (see main README)

## Quick Start (5 minutes)

### 1. Apply Database Migration

```bash
cd backend

# Local development
pnpm exec wrangler d1 migrations apply DB --local

# Production (after testing)
pnpm exec wrangler d1 migrations apply DB --remote
```

**What this does**: Creates `deletion_record` and `cleanup_lock` tables.

### 2. Run Tests

```bash
cd backend
pnpm test tests/cleanup.test.ts
```

**Expected output**: All tests pass (unit + integration tests for CleanupService).

### 3. Test Locally with Manual Trigger

```bash
cd backend

# Start local dev server
pnpm dev

# In another terminal, trigger cleanup manually
curl http://localhost:8787/__scheduled?cron=0+2+*+*+*
```

**What this does**: Simulates cron trigger in local environment.

### 4. Deploy to Preview

```bash
cd backend
pnpm exec wrangler deploy --env preview
```

**What this does**: Deploys to preview environment with cron triggers active.

## Project Structure

```
specs/010-data-cleanup/
├── spec.md              # Feature requirements
├── plan.md              # Implementation plan
├── research.md          # Technical research and decisions
├── data-model.md        # Database schema and types
├── contracts/           # Service interface definitions
│   └── CleanupService.md
└── quickstart.md        # This file

backend/
├── migrations/
│   └── 0007_add_deletion_record.sql    # NEW
├── src/
│   ├── services/
│   │   └── cleanup.ts                   # NEW: CleanupService implementation
│   ├── types/
│   │   └── index.ts                     # UPDATED: Add cleanup types
│   └── index.ts                         # UPDATED: Add scheduled handler
├── wrangler.toml                        # UPDATED: Add cron trigger
└── tests/
    └── cleanup.test.ts                  # NEW: CleanupService tests
```

## Development Workflow

### Step 1: Write Tests First (TDD)

```typescript
// backend/tests/cleanup.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CleanupService } from '../src/services/cleanup';

describe('CleanupService', () => {
  let service: CleanupService;
  let mockDb: D1Database;
  let mockBucket: R2Bucket;

  beforeEach(() => {
    // Setup mocks
    mockDb = createMockD1();
    mockBucket = createMockR2();
    service = new CleanupService();
  });

  it('should identify empty canvases older than 30 days', async () => {
    // Arrange: Mock canvas data
    mockDb.prepare = vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({
        results: [
          { id: 'canvas1', tile_count: 0, created_at: '2025-12-01T00:00:00Z' }
        ]
      })
    });

    // Act: Run cleanup
    const stats = await service.cleanupUnusedCanvases(mockDb, mockBucket, 100);

    // Assert: Canvas marked for deletion
    expect(stats.canvases_deleted).toBe(1);
  });
});
```

### Step 2: Implement Service

```typescript
// backend/src/services/cleanup.ts
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { CleanupResult, CleanupStats } from '../types';

export class CleanupService {
  async executeCleanup(env: Env): Promise<CleanupResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // 1. Acquire lock
      await this.acquireLock(env.DB);

      // 2. Capture before statistics
      const totalTilesBefore = await this.getTotalTileCount(env.DB);

      // 3. Cleanup unused canvases
      const canvasStats = await this.cleanupUnusedCanvases(env.DB, env.TILES);

      // 4. Cleanup orphaned data
      const orphanStats = await this.cleanupOrphanedData(env.DB, env.TILES);

      // 5. Capture after statistics
      const totalTilesAfter = await this.getTotalTileCount(env.DB);

      // 6. Record execution
      const stats: CleanupStats = {
        ...canvasStats,
        ...orphanStats,
        total_tiles_before: totalTilesBefore,
        total_tiles_after: totalTilesAfter,
      };

      const duration_ms = Date.now() - startTime;
      const deletion_record_id = await this.recordCleanupExecution(
        env.DB,
        stats,
        duration_ms,
        errors
      );

      return {
        success: true,
        deletion_record_id,
        canvases_processed: stats.canvases_deleted,
        errors,
      };
    } catch (error) {
      errors.push(error.message);
      return {
        success: false,
        deletion_record_id: null,
        canvases_processed: 0,
        errors,
      };
    } finally {
      // Always release lock
      await this.releaseLock(env.DB);
    }
  }

  // Additional methods...
}
```

### Step 3: Add Cron Trigger Handler

```typescript
// backend/src/index.ts (add to existing file)
import { CleanupService } from './services/cleanup';

export default {
  // Existing fetch handler
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // ...existing code...
  },

  // NEW: Scheduled handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('Cleanup cron trigger fired:', event.cron);

    const cleanupService = new CleanupService();

    try {
      const result = await cleanupService.executeCleanup(env);

      if (result.success) {
        console.log('Cleanup completed successfully:', {
          deletion_record_id: result.deletion_record_id,
          canvases_processed: result.canvases_processed,
        });
      } else {
        console.error('Cleanup failed:', result.errors);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      // Don't throw - let cron continue
    }
  },
};
```

### Step 4: Configure Cron Trigger

```toml
# backend/wrangler.toml (add to existing file)
[triggers]
crons = ["0 2 * * *"]  # Daily at 2:00 AM UTC
```

### Step 5: Update Types

```typescript
// backend/src/types/index.ts (add to existing file)
export interface DeletionRecord {
  id: string;
  executed_at: string;
  canvases_deleted: number;
  tiles_deleted: number;
  layers_deleted: number;
  ogp_images_deleted: number;
  total_tiles_before: number;
  total_tiles_after: number;
  storage_reclaimed_bytes: number;
  orphaned_tiles_deleted: number;
  orphaned_ogp_deleted: number;
  errors_encountered: string | null;
  duration_ms: number | null;
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
  total_tiles_before: number;
  total_tiles_after: number;
}
```

## Testing Guide

### Unit Tests

**Mock D1 and R2**:

```typescript
function createMockD1(): D1Database {
  const queries = new Map<string, any>();

  return {
    prepare: (sql: string) => ({
      bind: (...params: any[]) => ({
        all: async () => queries.get(sql) || { results: [] },
        run: async () => ({ success: true }),
        first: async () => queries.get(sql)?.[0] || null,
      }),
    }),
    exec: async (sql: string) => ({ count: 1, duration: 0 }),
  } as any;
}

function createMockR2(): R2Bucket {
  const storage = new Map<string, ArrayBuffer>();

  return {
    delete: async (key: string) => storage.delete(key),
    list: async (options?: R2ListOptions) => ({
      objects: Array.from(storage.keys())
        .filter(k => !options?.prefix || k.startsWith(options.prefix))
        .map(key => ({ key, size: storage.get(key)!.byteLength })),
    }),
    head: async (key: string) => ({
      key,
      size: storage.get(key)?.byteLength || 0,
    }),
  } as any;
}
```

### Integration Tests (Local D1/R2)

```typescript
// Use --local flag for wrangler dev
describe('CleanupService Integration', () => {
  it('should delete canvases and record statistics', async () => {
    // Setup: Insert test canvas with backdated timestamp
    await db.prepare(`
      INSERT INTO canvas (id, created_at, tile_count, center_lat, center_lng, zoom)
      VALUES ('test-canvas', '2025-12-01T00:00:00Z', 0, 0, 0, 10)
    `).run();

    // Execute cleanup
    const service = new CleanupService();
    const result = await service.executeCleanup({ DB: db, TILES: bucket });

    // Assert
    expect(result.success).toBe(true);
    expect(result.canvases_processed).toBe(1);

    // Verify deletion_record created
    const record = await db.prepare(`
      SELECT * FROM deletion_record WHERE id = ?
    `).bind(result.deletion_record_id).first();

    expect(record.canvases_deleted).toBe(1);
  });
});
```

### Manual Testing with Backdated Data

```sql
-- Insert test canvas (created 31 days ago, empty)
INSERT INTO canvas (id, created_at, tile_count, share_lat, share_lng, share_zoom, center_lat, center_lng, zoom)
VALUES ('test-empty', datetime('now', '-31 days'), 0, NULL, NULL, NULL, 0, 0, 10);

-- Insert test canvas (created 31 days ago, unshared)
INSERT INTO canvas (id, created_at, tile_count, share_lat, share_lng, share_zoom, center_lat, center_lng, zoom)
VALUES ('test-unshared', datetime('now', '-31 days'), 10, NULL, NULL, NULL, 0, 0, 10);

-- Insert test canvas (should NOT be deleted - recent)
INSERT INTO canvas (id, created_at, tile_count, share_lat, share_lng, share_zoom, center_lat, center_lng, zoom)
VALUES ('test-recent', datetime('now', '-5 days'), 0, NULL, NULL, NULL, 0, 0, 10);

-- Run cleanup manually
-- Then query to verify
SELECT COUNT(*) as remaining FROM canvas WHERE id LIKE 'test-%';
-- Expected: 1 (test-recent)

SELECT * FROM deletion_record ORDER BY executed_at DESC LIMIT 1;
-- Expected: canvases_deleted = 2
```

## Debugging

### Enable Verbose Logging

```typescript
// backend/src/services/cleanup.ts
const DEBUG = true; // Toggle for detailed logs

if (DEBUG) {
  console.log('Processing canvas:', canvas.id, {
    tile_count: canvas.tile_count,
    created_at: canvas.created_at,
    share_state: canvas.share_lat ? 'shared' : 'unshared',
  });
}
```

### Check Cleanup Lock Status

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

### View Recent Cleanup History

```sql
SELECT
  executed_at,
  canvases_deleted,
  tiles_deleted,
  storage_reclaimed_bytes,
  duration_ms,
  errors_encountered
FROM deletion_record
ORDER BY executed_at DESC
LIMIT 10;
```

## Common Issues

### Issue 1: "Lock acquisition failed"

**Cause**: Another cleanup process is running (or crashed without releasing lock)

**Solution**:
```sql
-- Check lock status
SELECT * FROM cleanup_lock;

-- Force release if stale (>30 minutes old)
DELETE FROM cleanup_lock WHERE datetime(locked_at) < datetime('now', '-30 minutes');
```

### Issue 2: "R2 deletion timeout"

**Cause**: Many large tiles causing R2 operations to exceed time limit

**Solution**:
- Reduce batch size in config (100 → 50)
- Add early exit logic if approaching time limit
- Failed deletions will be retried as orphans in next run

### Issue 3: "Tests fail with 'DB is not defined'"

**Cause**: Missing Vitest environment configuration

**Solution**:
```typescript
// vitest.config.ts
export default {
  test: {
    environment: 'miniflare', // Use Miniflare for Workers testing
  },
};
```

## Deployment Checklist

- [ ] Database migration applied to target environment
- [ ] All tests passing (`pnpm test`)
- [ ] Type checking passing (`pnpm type-check`)
- [ ] Lint passing (`pnpm lint`)
- [ ] Cron trigger configured in `wrangler.toml`
- [ ] Preview deployment tested with manual trigger
- [ ] Deletion records queryable in target D1 database
- [ ] Lock mechanism tested (try running cleanup twice concurrently)

## Monitoring

### Check if Cleanup is Running

```bash
# View Cloudflare Workers logs
wrangler tail --env production
```

### Query Cleanup Statistics

```sql
-- Daily cleanup volume (last 30 days)
SELECT
  DATE(executed_at) as date,
  canvases_deleted,
  storage_reclaimed_bytes / 1024 / 1024 as storage_mb
FROM deletion_record
WHERE executed_at >= datetime('now', '-30 days')
ORDER BY date DESC;

-- Error rate
SELECT
  COUNT(*) as total_runs,
  SUM(CASE WHEN errors_encountered IS NOT NULL THEN 1 ELSE 0 END) as runs_with_errors,
  ROUND(100.0 * SUM(CASE WHEN errors_encountered IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as error_rate_pct
FROM deletion_record
WHERE executed_at >= datetime('now', '-30 days');
```

## Performance Tuning

### Adjust Batch Size

```typescript
// backend/src/services/cleanup.ts
const BATCH_SIZE = 50; // Reduce if timeouts occur
```

### Add Early Exit for Time Limit

```typescript
const MAX_DURATION_MS = 4 * 60 * 1000; // 4 minutes (leave 1 minute buffer)

if (Date.now() - startTime > MAX_DURATION_MS) {
  console.warn('Approaching time limit, exiting early');
  break;
}
```

## Related Documentation

- [Feature Specification](./spec.md) - Requirements and success criteria
- [Implementation Plan](./plan.md) - Architecture and technical decisions
- [Data Model](./data-model.md) - Database schema and types
- [Service Contract](./contracts/CleanupService.md) - Interface specification
- [Research](./research.md) - Technical research and alternatives

## Support

If you encounter issues:

1. Check Cloudflare Workers logs: `wrangler tail`
2. Query deletion_record for error messages
3. Review cleanup_lock for stale locks
4. Refer to contracts/CleanupService.md for expected behavior

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-08 | Initial quickstart guide |
