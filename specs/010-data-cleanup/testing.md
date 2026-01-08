# Data Cleanup Feature - Testing Guide

## Manual Cleanup Trigger (Preview/Development Only)

### Endpoint
```
GET /api/__test-cleanup
```

### Purpose
Manually trigger the cleanup process without waiting for the scheduled cron execution. This is useful for:
- Testing cleanup behavior in preview environments
- Validating cleanup logic after code changes
- Debugging cleanup issues

### Security
- **Only available in non-production environments**
- Returns `403 Forbidden` if `ENVIRONMENT === 'production'`
- Safe to leave in codebase - automatically disabled in production

### Usage Example

**Trigger cleanup:**
```bash
curl https://oekaki-map-pr-18.abe00makoto.workers.dev/api/__test-cleanup
```

**Success response:**
```json
{
  "success": true,
  "deletion_record_id": "dr_20260108_155934",
  "canvases_processed": 2,
  "errors": []
}
```

**Error response (already running):**
```json
{
  "error": "cleanup_already_running",
  "locked_by": "worker-1736351974817",
  "locked_at": "2026-01-08T15:59:34.817Z"
}
```

**Error response (production):**
```json
{
  "error": "Not available in production"
}
```

## Preview Environment Test Results

### Test Environment
- **Preview URL**: https://oekaki-map-pr-18.abe00makoto.workers.dev
- **Test Date**: 2026-01-08 15:55-16:00 UTC
- **Database**: Preview D1 (0ce6fa3b-4f36-42ee-844b-89fb1728c5e4)

### Test Data Created
4 test canvases were created to validate cleanup logic:

1. **test_cleanup_empty_old** (SHOULD DELETE)
   - Empty canvas (tile_count=0), 31 days old, unshared

2. **test_cleanup_unshared_old** (SHOULD DELETE)
   - Has 5 tiles, 31 days old, unshared

3. **test_cleanup_empty_recent** (SHOULD KEEP)
   - Empty canvas, only 25 days old

4. **test_cleanup_shared_old** (SHOULD KEEP)
   - Has 10 tiles, 31 days old, but shared (has OGP)

### Database State Comparison

| Metric | BEFORE | AFTER | Change |
|--------|--------|-------|--------|
| Total Canvases | 31 | 29 | **-2** ✓ |
| Total Tiles | 203 | 203 | 0 |
| Empty Canvases | 7 | 6 | -1 |
| Unshared Canvases | 18 | 16 | -2 |
| Canvases Meeting Delete Criteria | 2 | 0 | **-2** ✓ |

### Cleanup Execution Result
```json
{
  "success": true,
  "deletion_record_id": "dr_20260108_155934",
  "canvases_processed": 2,
  "errors": []
}
```

### Deletion Record Details
```
ID: dr_20260108_155934
Executed At: 2026-01-08T15:59:34.817Z
Canvases Deleted: 2
Tiles Deleted: 0 (test canvases had no R2 objects)
Layers Deleted: 1
OGP Images Deleted: 0
Total Tiles Before: 203
Total Tiles After: 203
Storage Reclaimed: 0 bytes
Orphaned Tiles Deleted: 0
Orphaned OGP Deleted: 0
Errors: null
Duration: 1464ms
```

### Verification of Correct Behavior

#### ✅ Correctly DELETED (not found in database):
1. **test_cleanup_empty_old** - Empty + >30 days → DELETED ✓
2. **test_cleanup_unshared_old** - Unshared + >30 days → DELETED ✓

#### ✅ Correctly PRESERVED (still in database):
1. **test_cleanup_empty_recent** - Empty but <30 days → KEPT ✓
   - tile_count: 0, share_lat: null, created_at: 2025-12-14 (25 days ago)

2. **test_cleanup_shared_old** - Old but shared → KEPT ✓
   - tile_count: 10, share_lat: 35.6812, created_at: 2025-12-08 (31 days ago)

## Test Conclusion

✅ **ALL TESTS PASSED**

The cleanup feature is working exactly as specified:
- Deletion criteria correctly applied: (empty OR unshared) AND >30 days old
- Shared canvases are protected regardless of age
- Recent canvases are protected regardless of status
- Audit trail created in deletion_record table
- No errors during execution
- Cleanup completed in 1.46 seconds

## Testing Checklist for Future Changes

When modifying the cleanup feature, verify:

- [ ] Empty canvases >30 days old are deleted
- [ ] Unshared canvases >30 days old are deleted
- [ ] Shared canvases are NOT deleted regardless of age
- [ ] Recent canvases (<30 days) are NOT deleted regardless of status
- [ ] Deletion records are created with correct statistics
- [ ] Orphaned tiles/OGP images are cleaned up
- [ ] Concurrency control prevents duplicate execution
- [ ] No errors in cleanup execution
- [ ] Storage reclaimed is calculated correctly

## Querying Cleanup History

**View recent cleanup executions:**
```bash
wrangler d1 execute DB --remote --env preview --command \
  "SELECT * FROM deletion_record ORDER BY executed_at DESC LIMIT 10"
```

**Check total storage reclaimed:**
```bash
wrangler d1 execute DB --remote --env preview --command \
  "SELECT SUM(storage_reclaimed_bytes) as total_reclaimed FROM deletion_record"
```

**Find cleanup executions with errors:**
```bash
wrangler d1 execute DB --remote --env preview --command \
  "SELECT * FROM deletion_record WHERE errors_encountered IS NOT NULL"
```
