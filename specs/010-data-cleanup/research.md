# Phase 0: Research - Data Cleanup Mechanism

**Feature**: 010-data-cleanup
**Date**: 2026-01-08
**Status**: Complete

## Research Questions

This phase resolves all NEEDS CLARIFICATION items from the Technical Context and investigates implementation approaches for key technical decisions.

### Q1: Cloudflare Workers Cron Triggers Configuration

**Question**: How to configure and implement Cloudflare Workers Cron Triggers for scheduled cleanup?

**Decision**: Use `wrangler.toml` cron configuration with dedicated scheduled handler

**Rationale**:
- Cloudflare Workers supports cron triggers natively via `wrangler.toml` configuration
- Cron syntax follows standard Unix cron format
- Scheduled handlers execute separately from HTTP requests (no user impact)
- 15-minute wall clock limit for cron handlers (sufficient for our 5-minute target)

**Implementation**:
```toml
# wrangler.toml
[triggers]
crons = ["0 2 * * *"]  # Daily at 2:00 AM UTC
```

**Alternatives Considered**:
- External cron service (rejected: adds infrastructure complexity)
- Cloudflare Durable Objects with alarms (rejected: overkill for daily job)

### Q2: Concurrency Control Mechanism

**Question**: How to prevent concurrent cleanup operations in Cloudflare Workers environment?

**Decision**: Use D1 database row-level locking with a cleanup_lock table

**Rationale**:
- D1 supports SQLite transaction-based locking
- Simple INSERT with UNIQUE constraint provides atomic lock acquisition
- Lock record includes timestamp for stale lock detection
- No external dependencies (Redis, etc.) required

**Implementation Approach**:
```sql
CREATE TABLE cleanup_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  locked_at TEXT NOT NULL,
  locked_by TEXT
);

-- Acquire lock
INSERT INTO cleanup_lock (id, locked_at, locked_by) VALUES (1, datetime('now'), 'cron-worker');
-- Fails if lock already held

-- Release lock
DELETE FROM cleanup_lock WHERE id = 1;
```

**Alternatives Considered**:
- Durable Objects (rejected: over-engineered for this use case)
- Application-level flag (rejected: not reliable across worker instances)

### Q3: Batch Processing Strategy

**Question**: How to implement batch processing within Cloudflare Workers execution limits?

**Decision**: Iterative LIMIT/OFFSET queries with per-batch processing

**Rationale**:
- Each batch of 100 canvases processed sequentially
- CPU time resets between database operations
- Can break early if approaching time limit
- Simple to implement and test

**Implementation Pattern**:
```typescript
const BATCH_SIZE = 100;
let offset = 0;
let processedCount = 0;

while (true) {
  const batch = await db.query(`
    SELECT * FROM canvas
    WHERE ...
    LIMIT ${BATCH_SIZE} OFFSET ${offset}
  `);

  if (batch.length === 0) break;

  for (const canvas of batch) {
    await deleteCanvas(canvas);
    processedCount++;
  }

  offset += BATCH_SIZE;

  // Safety check: exit if approaching time limit
  if (processedCount >= 1000) break;
}
```

**Alternatives Considered**:
- Cursor-based pagination (rejected: SQLite doesn't support efficient keyset pagination for complex queries)
- Single large query (rejected: may exceed memory/time limits)

### Q4: Storage Size Calculation for Deletion Records

**Question**: How to calculate storage_reclaimed for deletion records?

**Decision**: Estimate based on tile count and average tile size, with actual R2 size if available from metadata

**Rationale**:
- R2 list operations return object size
- Average WebP tile size: ~10-50KB (can be measured from existing tiles)
- OGP images: fixed ~100KB
- Approximation acceptable for monitoring purposes (SC-004 allows 5% margin)

**Implementation**:
```typescript
// During deletion, sum tile sizes
let storageReclaimed = 0;
for (const tile of tilesToDelete) {
  const object = await r2.head(tile.r2_key);
  if (object) storageReclaimed += object.size;
}
// Add OGP image size if exists
if (ogpKey) {
  const ogp = await r2.head(ogpKey);
  if (ogp) storageReclaimed += ogp.size;
}
```

**Alternatives Considered**:
- Estimate only (rejected: actual size available with minimal overhead)
- Skip size tracking (rejected: required for SC-004 success criteria)

### Q5: Orphaned Data Detection

**Question**: How to efficiently identify orphaned tiles and OGP images?

**Decision**: Two-phase approach - SQL LEFT JOIN for tiles, R2 list comparison for OGP images

**Rationale**:
- Orphaned tiles: SQL query is efficient for database-level orphans
- Orphaned OGP images: Requires comparing R2 list against database records
- Run after canvas cleanup to catch newly orphaned data

**Implementation**:
```sql
-- Orphaned tiles (canvas_id doesn't exist)
SELECT dt.* FROM drawing_tile dt
LEFT JOIN canvas c ON dt.canvas_id = c.id
WHERE c.id IS NULL;

-- Orphaned OGP images (programmatically)
const ogpKeys = await r2.list({ prefix: 'ogp/' });
for (const key of ogpKeys.objects) {
  const canvasId = extractCanvasId(key.key);
  const exists = await db.query('SELECT 1 FROM canvas WHERE ogp_image_key = ?', key.key);
  if (!exists) await r2.delete(key.key);
}
```

**Alternatives Considered**:
- Full R2 inventory (rejected: expensive and slow)
- Skip orphan cleanup (rejected: explicit requirement FR-007/FR-008)

### Q6: Error Handling and Retry Logic

**Question**: How to implement retry logic for R2 deletions within Workers constraints?

**Decision**: Immediate retry on first failure, log and skip on second failure

**Rationale**:
- Transient errors (network, R2 availability) often resolve on retry
- Two-phase deletion: database record remains if R2 deletion fails
- Next cleanup run will attempt orphan cleanup
- Avoids complex retry queue infrastructure

**Implementation**:
```typescript
async function deleteWithRetry(key: string): Promise<boolean> {
  try {
    await r2.delete(key);
    return true;
  } catch (error) {
    // Immediate retry
    try {
      await r2.delete(key);
      return true;
    } catch (retryError) {
      // Log and defer to next run
      console.error(`Failed to delete ${key}:`, retryError);
      return false;
    }
  }
}
```

**Alternatives Considered**:
- Exponential backoff (rejected: adds complexity, Workers time limit makes this impractical)
- Queue for failed deletions (rejected: over-engineered for daily cleanup)

## Technology Stack Confirmation

**Backend**: Hono + Cloudflare Workers + D1 + R2 (confirmed, already in use)
**Language**: TypeScript 5.6.3 strict mode (confirmed)
**Testing**: Vitest (confirmed, existing test infrastructure)
**Scheduling**: Cloudflare Workers Cron Triggers (confirmed, native support)

## Implementation Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cleanup exceeds time limit | High | Batch processing with early exit, 1000 canvas safety limit |
| Concurrent execution | Medium | Database-level locking with cleanup_lock table |
| R2 deletion failures | Medium | Retry logic + orphan cleanup in next run |
| False positive deletions | Critical | Extensive test coverage for deletion criteria logic |
| Lock stale after crash | Low | Implement lock timeout (e.g., 30 minutes), allow force release |

## Best Practices

1. **Database Migrations**: Use sequential migration files (0007_add_deletion_record.sql)
2. **Testing**: Mock D1/R2 in unit tests, use local D1/R2 for integration tests
3. **Logging**: Structured logging for all cleanup operations (canvas IDs, counts, errors)
4. **Monitoring**: Deletion records table serves as monitoring data source
5. **Safety**: Always test with backdated test data before deploying to production

## Next Steps (Phase 1)

- Define deletion_record table schema in data-model.md
- Define CleanupService interface in contracts/
- Document developer quickstart in quickstart.md
- Update CLAUDE.md with cleanup feature context
