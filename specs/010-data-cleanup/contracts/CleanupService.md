# CleanupService Contract

**Feature**: 010-data-cleanup
**Date**: 2026-01-08
**Type**: Service Interface

## Overview

The `CleanupService` provides methods for executing automated cleanup of unused canvas data and orphaned records. This service is invoked by a Cloudflare Workers Cron Trigger and operates independently of user-facing requests.

## Interface Definition

```typescript
interface CleanupService {
  /**
   * Execute full cleanup process: canvas cleanup, orphan cleanup, and statistics recording.
   *
   * This is the primary entry point called by the cron trigger handler.
   *
   * @param env - Cloudflare Workers environment bindings (DB, TILES bucket)
   * @returns CleanupResult with execution statistics and errors
   *
   * @throws {LockAcquisitionError} If cleanup is already running
   * @throws {DatabaseError} If critical database operations fail
   */
  executeCleanup(env: Env): Promise<CleanupResult>;

  /**
   * Identify and delete canvases meeting deletion criteria.
   *
   * Deletion criteria: (tile_count = 0 OR share_lat/lng/zoom all NULL) AND created >= 30 days ago
   *
   * @param db - D1 database binding
   * @param bucket - R2 bucket binding for tile/OGP deletion
   * @param batchSize - Number of canvases to process per batch (default: 100)
   * @returns Statistics about deleted canvases and associated data
   */
  cleanupUnusedCanvases(
    db: D1Database,
    bucket: R2Bucket,
    batchSize?: number
  ): Promise<CleanupStats>;

  /**
   * Identify and delete orphaned tiles and OGP images.
   *
   * Orphaned data: records that reference non-existent canvases
   *
   * @param db - D1 database binding
   * @param bucket - R2 bucket binding for orphaned data deletion
   * @returns Count of orphaned tiles and OGP images deleted
   */
  cleanupOrphanedData(
    db: D1Database,
    bucket: R2Bucket
  ): Promise<{ orphaned_tiles: number; orphaned_ogp: number }>;

  /**
   * Record cleanup execution statistics to deletion_record table.
   *
   * @param db - D1 database binding
   * @param stats - Aggregated cleanup statistics
   * @param duration_ms - Execution duration in milliseconds
   * @param errors - Array of error messages encountered during cleanup
   * @returns ID of created deletion_record
   */
  recordCleanupExecution(
    db: D1Database,
    stats: CleanupStats,
    duration_ms: number,
    errors: string[]
  ): Promise<string>;
}
```

## Type Definitions

### CleanupResult

```typescript
interface CleanupResult {
  /** Whether cleanup completed successfully */
  success: boolean;

  /** ID of created deletion_record (null if failed before recording) */
  deletion_record_id: string | null;

  /** Total number of canvases processed (deleted or skipped) */
  canvases_processed: number;

  /** Array of error messages encountered during execution */
  errors: string[];
}
```

### CleanupStats

```typescript
interface CleanupStats {
  /** Number of canvases deleted */
  canvases_deleted: number;

  /** Number of tiles deleted (including from deleted canvases) */
  tiles_deleted: number;

  /** Number of layers deleted */
  layers_deleted: number;

  /** Number of OGP images deleted from R2 */
  ogp_images_deleted: number;

  /** Number of orphaned tiles deleted */
  orphaned_tiles_deleted: number;

  /** Number of orphaned OGP images deleted */
  orphaned_ogp_deleted: number;

  /** Total bytes reclaimed from R2 storage */
  storage_reclaimed_bytes: number;

  /** System-wide tile count before cleanup */
  total_tiles_before: number;

  /** System-wide tile count after cleanup */
  total_tiles_after: number;
}
```

### LockAcquisitionError

```typescript
class LockAcquisitionError extends Error {
  constructor(
    message: string,
    public locked_by: string,
    public locked_at: string
  ) {
    super(message);
    this.name = 'LockAcquisitionError';
  }
}
```

## Behavior Specifications

### Lock Acquisition

**Precondition**: No existing lock in `cleanup_lock` table

**Postcondition**: Single row exists in `cleanup_lock` with current timestamp

**Error Handling**:
- If lock exists and is recent (<30 min): throw `LockAcquisitionError`
- If lock is stale (>30 min): force release and re-acquire
- Always release lock in finally block

### Canvas Deletion Order

**Required Sequence** (per FR-003):
1. Delete drawing_tile records from D1
2. Delete tile images from R2 (with retry)
3. Delete OGP image from R2 (if exists, with retry)
4. Delete layer records from D1 (CASCADE handles this automatically)
5. Delete canvas record from D1

**Rationale**: Database foreign keys maintain referential integrity. R2 deletions can fail transiently without breaking database consistency.

### Batch Processing

**Behavior**:
- Process canvases in batches of `batchSize` (default 100)
- Continue until no more qualifying canvases found OR safety limit reached (1000)
- Each batch is a separate database query + deletion cycle

**Safety Limits**:
- Maximum 1000 canvases per execution (prevents infinite loops)
- Exit early if approaching Cloudflare Workers CPU time limit

### Retry Logic (R2 Deletions)

**Behavior** (per FR-012):
1. Attempt R2 deletion
2. If fails: immediate retry (no delay)
3. If still fails: log error, continue with next item
4. Failed deletions become orphaned data, cleaned in next run

**Error Handling**:
- R2 deletion failures do NOT fail entire cleanup
- Errors are accumulated in `errors` array
- Partial success is acceptable (logged in deletion_record)

## Usage Example

### Cron Trigger Handler

```typescript
// backend/src/index.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cleanupService = new CleanupServiceImpl();

    try {
      const result = await cleanupService.executeCleanup(env);

      if (result.success) {
        console.log(`Cleanup completed successfully. Record ID: ${result.deletion_record_id}`);
        console.log(`Processed ${result.canvases_processed} canvases`);
      } else {
        console.error(`Cleanup failed with ${result.errors.length} errors:`, result.errors);
      }
    } catch (error) {
      if (error instanceof LockAcquisitionError) {
        console.warn(`Cleanup skipped - already running (locked by ${error.locked_by})`);
      } else {
        console.error('Cleanup failed with unexpected error:', error);
        throw error;
      }
    }
  }
};
```

### Manual Invocation (Testing)

```typescript
// Test helper
async function runCleanupManually(env: Env) {
  const service = new CleanupServiceImpl();
  const result = await service.executeCleanup(env);
  return result;
}
```

## Performance Requirements

| Metric | Target | Rationale |
|--------|--------|-----------|
| Execution Time | <5 minutes | Per SC-005 (1000 canvases) |
| Batch Size | 100 canvases | Balances throughput and time limits |
| R2 Retry Overhead | <100ms per failure | Single immediate retry only |
| Database Queries | <10 per batch | Minimize D1 query count |
| Memory Usage | <50MB | Standard Workers limit is 128MB |

## Error Scenarios

### Scenario 1: Lock Acquisition Failure

**Cause**: Another cleanup process is running

**Response**:
- Throw `LockAcquisitionError`
- Cron trigger logs warning and exits
- Next scheduled run will retry

### Scenario 2: Database Query Failure

**Cause**: D1 unavailability or query error

**Response**:
- Release lock (if acquired)
- Throw `DatabaseError`
- No deletion_record created (operation aborted)

### Scenario 3: R2 Deletion Failure

**Cause**: R2 transient error or network issue

**Response**:
- Retry once immediately
- If still fails: log error, continue with next item
- Failed deletions tracked in `errors_encountered` field
- Orphan cleanup in next run will retry

### Scenario 4: Time Limit Approaching

**Cause**: Processing more canvases than expected

**Response**:
- Exit batch loop early after 1000 canvases
- Record partial results in deletion_record
- Next scheduled run will process remaining canvases

## Testing Strategy

### Unit Tests

```typescript
describe('CleanupService', () => {
  describe('executeCleanup', () => {
    it('should acquire and release lock', async () => {
      // Mock: D1 INSERT/DELETE for lock
      // Assert: Lock acquired → cleanup runs → lock released
    });

    it('should throw LockAcquisitionError if already locked', async () => {
      // Mock: D1 INSERT fails (UNIQUE constraint)
      // Assert: LockAcquisitionError thrown
    });

    it('should force release stale lock', async () => {
      // Mock: D1 SELECT returns lock older than 30 minutes
      // Assert: Lock deleted and re-acquired
    });
  });

  describe('cleanupUnusedCanvases', () => {
    it('should identify empty canvases older than 30 days', async () => {
      // Mock: Canvas with tile_count=0, created_at=31 days ago
      // Assert: Canvas marked for deletion
    });

    it('should identify unshared canvases older than 30 days', async () => {
      // Mock: Canvas with share_lat/lng/zoom=NULL, created_at=31 days ago
      // Assert: Canvas marked for deletion
    });

    it('should NOT delete canvases younger than 30 days', async () => {
      // Mock: Canvas with tile_count=0, created_at=29 days ago
      // Assert: Canvas NOT marked for deletion
    });

    it('should process in batches of specified size', async () => {
      // Mock: 250 qualifying canvases, batchSize=100
      // Assert: 3 batches processed (100, 100, 50)
    });
  });

  describe('cleanupOrphanedData', () => {
    it('should identify orphaned tiles', async () => {
      // Mock: Tile with non-existent canvas_id
      // Assert: Tile deleted from DB and R2
    });

    it('should identify orphaned OGP images', async () => {
      // Mock: R2 ogp/{id}.png with no matching canvas.ogp_image_key
      // Assert: OGP image deleted from R2
    });
  });
});
```

### Integration Tests

```typescript
describe('CleanupService Integration', () => {
  it('should perform full cleanup and record statistics', async () => {
    // Setup: Create test canvases with backdated timestamps
    // Execute: Run cleanup
    // Assert: Canvases deleted, deletion_record created with accurate counts
  });

  it('should handle R2 deletion failures gracefully', async () => {
    // Mock: R2.delete() throws error on first call
    // Execute: Run cleanup
    // Assert: Error logged, cleanup continues, orphan cleanup catches failed deletions
  });
});
```

## Security Considerations

### Authentication

**Status**: Not applicable (internal cron job, no external input)

### Authorization

**Status**: Not applicable (system-level operation)

### Data Validation

**Input**: None (cron trigger has no user input)

**Output**: Deletion records are append-only audit log (no user modification)

### Rate Limiting

**Mechanism**: Single cron execution per schedule (daily at 2:00 AM UTC)

**Concurrency**: Lock prevents multiple simultaneous executions

## Monitoring and Observability

### Logs

```typescript
// Structured logging format
console.log(JSON.stringify({
  event: 'cleanup_started',
  timestamp: new Date().toISOString(),
  worker_id: 'cron-worker'
}));

console.log(JSON.stringify({
  event: 'cleanup_completed',
  timestamp: new Date().toISOString(),
  deletion_record_id: 'dr_xxx',
  canvases_deleted: 5,
  duration_ms: 12500
}));
```

### Metrics (from deletion_record)

```sql
-- Daily cleanup volume
SELECT executed_at, canvases_deleted, tiles_deleted, storage_reclaimed_bytes
FROM deletion_record
ORDER BY executed_at DESC
LIMIT 30;

-- Error rate
SELECT
  COUNT(*) as total_runs,
  SUM(CASE WHEN errors_encountered IS NOT NULL THEN 1 ELSE 0 END) as runs_with_errors
FROM deletion_record
WHERE executed_at >= datetime('now', '-30 days');
```

### Alerts

**Potential Alert Conditions**:
- Cleanup duration exceeds 4 minutes (approaching 5-minute target)
- Error rate exceeds 10% of runs
- No cleanup execution for >25 hours (cron failure)
- Lock remains stale for >1 hour (worker crash)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-08 | Initial contract definition |
