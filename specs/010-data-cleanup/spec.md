# Feature Specification: Data Cleanup Mechanism

**Feature Branch**: `010-data-cleanup`
**Created**: 2026-01-08
**Updated**: 2026-01-08
**Status**: Draft - Updated Requirements
**Input**: User description: "ゴミ掃除の検討 - 内部的に不要なレコードや画像が溜まっていくのでそれを掃除する仕組みを作りたい。空のキャンバスまたは一度も共有していないキャンバスを作成後30日で削除。削除記録を保持。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automatic cleanup of unused canvases (Priority: P1)

The system automatically removes canvas data for canvases that are either empty (no tiles drawn) or have never been shared, after 30 days from creation, preventing storage from growing indefinitely with abandoned or test canvases.

**Why this priority**: This is the core value proposition - preventing storage costs from escalating due to unused canvases. Empty canvases and unshared canvases indicate no real user engagement, making them safe to remove after a grace period.

**Independent Test**: Can be fully tested by creating test canvases (empty or unshared), backdating their created_at to 31+ days ago, running the cleanup process, and verifying that only qualifying canvases and their data are removed.

**Acceptance Scenarios**:

1. **Given** an empty canvas (tile_count = 0) created 31 days ago, **When** the cleanup process runs, **Then** the canvas record, all associated layers, and OGP images are permanently deleted
2. **Given** a canvas with share_lat/lng/zoom = NULL created 31 days ago, **When** the cleanup process runs, **Then** the canvas and all associated data are permanently deleted
3. **Given** an empty canvas created 29 days ago, **When** the cleanup process runs, **Then** the canvas remains untouched
4. **Given** a canvas with tiles (tile_count > 0) that has been shared (share_lat/lng/zoom not NULL), **When** the cleanup process runs, **Then** the canvas remains untouched regardless of age
5. **Given** multiple canvases with mixed conditions, **When** the cleanup process runs, **Then** only canvases meeting deletion criteria (empty OR unshared) AND created 30+ days ago are deleted

---

### User Story 2 - Orphaned data cleanup (Priority: P2)

The system identifies and removes orphaned records - drawing tiles without a parent canvas, or OGP images without corresponding canvas records - that may have been created due to failed transactions or partial deletions.

**Why this priority**: Orphaned data represents wasted storage but is typically a smaller issue than abandoned canvases. This is important for data integrity but less critical than P1 since orphaned records accumulate more slowly.

**Independent Test**: Can be fully tested by manually creating orphaned records in the database (e.g., inserting drawing_tile records with non-existent canvas_id), running the cleanup process, and verifying that orphaned records are removed while valid records remain.

**Acceptance Scenarios**:

1. **Given** drawing tiles exist with canvas_id pointing to a non-existent canvas, **When** orphaned data cleanup runs, **Then** those tiles are deleted from both database and object storage
2. **Given** OGP images exist in R2 storage but the canvas record has no ogp_image_key or the canvas doesn't exist, **When** orphaned data cleanup runs, **Then** those OGP images are deleted from object storage
3. **Given** all data references are valid, **When** orphaned data cleanup runs, **Then** no data is deleted

---

### User Story 3 - Deletion records and statistics (Priority: P2)

System maintains persistent deletion records showing cleanup history, including deleted canvas counts, tile counts before/after cleanup, and storage space reclaimed, enabling administrators to track cleanup effectiveness and system health over time.

**Why this priority**: Deletion records provide accountability and operational insight. Unlike transient logs, persistent records enable trend analysis and capacity planning. This is elevated to P2 because it's crucial for production monitoring.

**Independent Test**: Can be fully tested by running cleanup with test data, then querying deletion records to verify all statistics are accurately captured including: deleted canvas count, deleted tile count, system-wide tile count before/after, storage reclaimed, and timestamp.

**Acceptance Scenarios**:

1. **Given** cleanup process deletes 5 canvases with 150 total tiles, **When** cleanup completes, **Then** a deletion record is created showing: 5 canvases deleted, 150 tiles deleted, total tile count before cleanup, total tile count after cleanup, storage reclaimed, and execution timestamp
2. **Given** the system had 10,000 total tiles before cleanup and deleted 150 tiles, **When** querying deletion records, **Then** the record shows total_tiles_before = 10000, tiles_deleted = 150, total_tiles_after = 9850
3. **Given** no data qualifies for deletion, **When** cleanup runs, **Then** a deletion record is created with all counts set to zero and a note indicating no cleanup performed
4. **Given** multiple cleanup runs over time, **When** querying deletion records, **Then** all historical records are available for trend analysis

---

### Edge Cases

- What happens when a cleanup process is already running and another cleanup is triggered? (prevent concurrent cleanup operations)
- How does the system handle partial failures during cleanup (e.g., database record deleted but R2 object deletion fails)?
- What happens if the 30-day retention period is changed after the system has been running? (applies to all future cleanup runs, does not retroactively protect or delete data)
- How does the system handle very large numbers of canvases to delete in a single cleanup run? (process in batches to avoid timeout)
- What happens when object storage is temporarily unavailable during cleanup? (retry mechanism or defer cleanup to next run)
- What happens if a user adds tiles to an empty canvas just before the 30-day mark? (tile_count is updated, canvas is preserved)
- What happens if a user shares a canvas (sets share_lat/lng/zoom) just before the 30-day mark? (canvas is preserved)
- What happens if deletion record table grows very large over many years? (accepted as historical audit trail, no automatic cleanup)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST identify canvases for deletion using the following criteria: (tile_count = 0 OR share_lat IS NULL AND share_lng IS NULL AND share_zoom IS NULL) AND created_at >= 30 days ago
- **FR-002**: System MUST capture system-wide tile count before beginning any deletions for statistical recording
- **FR-003**: System MUST delete all data associated with a qualifying canvas in this order: drawing tiles (from both database and R2 storage), OGP images (from R2 storage), layer records, and finally the canvas record
- **FR-004**: System MUST track deletion statistics during cleanup including: number of canvases deleted, number of tiles deleted, and storage space reclaimed
- **FR-005**: System MUST capture system-wide tile count after completing all deletions for statistical recording
- **FR-006**: System MUST persist deletion records to a dedicated table with fields: execution timestamp, canvases_deleted, tiles_deleted, total_tiles_before, total_tiles_after, storage_reclaimed, errors_encountered
- **FR-007**: System MUST identify orphaned drawing_tile records (where canvas_id references a non-existent canvas) and delete them from both database and object storage
- **FR-008**: System MUST identify orphaned OGP images in R2 storage (where the image key exists in storage but is not referenced by any canvas record) and delete them
- **FR-009**: System MUST prevent concurrent cleanup operations from running simultaneously using a locking mechanism
- **FR-010**: System MUST execute cleanup operations on a scheduled basis (e.g., daily batch job)
- **FR-011**: System MUST process cleanup in batches of 100 canvases to prevent timeout issues
- **FR-012**: System MUST implement retry logic for failed R2 deletions with 1 immediate retry, then defer remaining failures to the next scheduled cleanup run

### Key Entities

- **Canvas**: Represents a drawing session with metadata including created_at timestamp (for cleanup eligibility), tile_count (to identify empty canvases), and share_lat/lng/zoom (to identify shared canvases)
- **DrawingTile**: Represents individual map tiles with drawing data, stored in both database (metadata with r2_key) and R2 storage (WebP image), associated with a canvas via canvas_id foreign key
- **Layer**: Represents drawing layers within a canvas, associated with canvas via canvas_id foreign key
- **OGP Image**: PNG images stored in R2 for social media sharing previews, referenced by canvas.ogp_image_key
- **DeletionRecord**: Persistent record of each cleanup execution containing: execution timestamp, counts of deleted items (canvases, tiles, OGP images), system-wide tile counts before/after cleanup, storage space reclaimed, and any errors encountered

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cleanup process successfully identifies and deletes all canvases that are (empty OR unshared) AND created 30+ days ago, along with all associated data (100% success rate for valid deletions)
- **SC-002**: Orphaned records are reduced to zero within 24 hours of cleanup execution
- **SC-003**: Deletion records accurately capture system-wide tile counts before and after cleanup (verified against actual database counts)
- **SC-004**: Storage usage decrease matches the storage_reclaimed value in deletion records (within 5% margin)
- **SC-005**: Cleanup process completes within 5 minutes for up to 1000 qualifying canvases
- **SC-006**: Zero data loss occurs for canvases that should be retained (no false positives in cleanup logic - canvases with tiles AND shared, or canvases younger than 30 days)
- **SC-007**: Deletion records are permanently retained and queryable to provide complete historical audit trail for capacity planning and compliance

## Assumptions

- **Retention Period**: 30 days from canvas creation (based on created_at timestamp) provides sufficient grace period for users to engage with their canvases before cleanup.
- **Empty Canvas Definition**: A canvas with tile_count = 0 is considered empty and unused. This assumes tile_count is accurately maintained by the tile upload process.
- **Unshared Canvas Definition**: A canvas with share_lat = NULL AND share_lng = NULL AND share_zoom = NULL has never been shared. This assumes these fields are only set when a user explicitly shares the canvas.
- **Deletion Criteria**: Using OR logic (empty OR unshared) ensures we capture test canvases and abandoned sessions while preserving any canvas with user engagement (either drawing or sharing).
- **Batch Size**: Processing in batches of 100 canvases balances performance and timeout prevention, suitable for Cloudflare Workers 30-second CPU time limit.
- **Execution Method**: Cleanup runs on a scheduled basis (e.g., daily batch job) for fully automated operation without manual intervention.
- **Retry Strategy**: Failed R2 deletions are retried once immediately to handle transient errors, then deferred to the next scheduled cleanup run if still failing.
- **Concurrent Execution**: Only one cleanup process should run at a time to prevent race conditions and resource contention.
- **Error Handling**: Partial failures during cleanup (e.g., database deletion succeeds but R2 deletion fails) are logged and retried once, then deferred to next run, ensuring cleanup continues with remaining items.
- **Deletion Record Retention**: Deletion records are permanently retained as a historical audit trail. The table is expected to grow slowly (one record per daily cleanup run = ~365 records per year) making indefinite retention feasible.
