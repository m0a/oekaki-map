# Tasks: Data Cleanup Mechanism

**Input**: Design documents from `/home/m0a/oekaki-map/specs/010-data-cleanup/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED per constitution Principle I (Test-First Development). Tests must be written and fail before implementation begins.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a web application (backend + frontend monorepo). All tasks are backend-only.
- Backend code: `backend/src/`
- Backend tests: `backend/tests/`
- Migrations: `backend/migrations/`
- Configuration: `backend/wrangler.toml`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and database schema setup

- [x] T001 Create database migration file at backend/migrations/0007_add_deletion_record.sql with deletion_record and cleanup_lock table DDL per data-model.md
- [x] T002 Apply database migration to local D1 database using `wrangler d1 migrations apply DB --local`
- [x] T003 [P] Add TypeScript type definitions (DeletionRecord, CleanupLock, CleanupResult, CleanupStats) to backend/src/types/index.ts per data-model.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Configure Cloudflare Workers Cron Trigger in backend/wrangler.toml with schedule "0 2 * * *" (daily at 2:00 AM UTC) per research.md
- [x] T005 Add scheduled handler export to backend/src/index.ts with CleanupService invocation structure per quickstart.md
- [x] T006 [P] Create CleanupService class skeleton in backend/src/services/cleanup.ts with method signatures per contracts/CleanupService.md
- [x] T007 [P] Create test file backend/tests/cleanup.test.ts with test structure and mock setup utilities (createMockD1, createMockR2) per quickstart.md

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Automatic cleanup of unused canvases (Priority: P1) 🎯 MVP

**Goal**: System automatically removes canvas data for canvases that are either empty (no tiles drawn) or have never been shared, after 30 days from creation

**Independent Test**: Create test canvases (empty or unshared), backdate their created_at to 31+ days ago, run cleanup process, and verify that only qualifying canvases and their data are removed

### Tests for User Story 1 ⚠️ WRITE FIRST - MUST FAIL BEFORE IMPLEMENTATION

- [ ] T008 [P] [US1] Write test "should identify empty canvases older than 30 days" in backend/tests/cleanup.test.ts (mock canvas with tile_count=0, created_at=31 days ago) - MUST FAIL initially
- [ ] T009 [P] [US1] Write test "should identify unshared canvases older than 30 days" in backend/tests/cleanup.test.ts (mock canvas with share_lat/lng/zoom=NULL, created_at=31 days ago) - MUST FAIL initially
- [ ] T010 [P] [US1] Write test "should NOT delete canvases younger than 30 days" in backend/tests/cleanup.test.ts (mock canvas with tile_count=0, created_at=29 days ago) - MUST FAIL initially
- [ ] T011 [P] [US1] Write test "should NOT delete canvases with tiles AND shared" in backend/tests/cleanup.test.ts (mock canvas with tile_count>0 and share fields set) - MUST FAIL initially
- [ ] T012 [P] [US1] Write test "should delete all associated data (tiles, layers, OGP)" in backend/tests/cleanup.test.ts (verify deletion order: tiles → OGP → layers → canvas) - MUST FAIL initially
- [ ] T013 [P] [US1] Write test "should process in batches of 100 canvases" in backend/tests/cleanup.test.ts (mock 250 qualifying canvases, verify 3 batches) - MUST FAIL initially
- [ ] T014 [P] [US1] Write test "should stop at 1000 canvas safety limit" in backend/tests/cleanup.test.ts (mock 1500 qualifying canvases, verify only 1000 processed) - MUST FAIL initially

**Checkpoint**: All US1 tests written and FAILING - ready for implementation

### Implementation for User Story 1

- [ ] T015 [US1] Implement cleanupUnusedCanvases method in backend/src/services/cleanup.ts: query canvas table with deletion criteria (tile_count=0 OR share_lat/lng/zoom=NULL) AND created_at>=30 days
- [ ] T016 [US1] Implement batch processing logic in cleanupUnusedCanvases: LIMIT 100, iterative OFFSET, safety limit of 1000 canvases per data-model.md
- [ ] T017 [US1] Implement deleteCanvasData helper method in backend/src/services/cleanup.ts: delete drawing_tiles from D1 → delete tiles from R2 with retry → delete OGP from R2 with retry → delete canvas record per contracts/CleanupService.md
- [ ] T018 [US1] Implement R2 deletion with retry logic in backend/src/services/cleanup.ts: immediate retry on first failure, log and continue on second failure per research.md Q6
- [ ] T019 [US1] Implement storage size calculation in backend/src/services/cleanup.ts: use R2 head() to get object sizes, sum for storage_reclaimed_bytes per research.md Q4
- [ ] T020 [US1] Add error accumulation in cleanupUnusedCanvases: collect R2 deletion failures in errors array without failing entire cleanup per contracts/CleanupService.md

**Checkpoint**: Run tests T008-T014 - all should PASS. User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Orphaned data cleanup (Priority: P2)

**Goal**: System identifies and removes orphaned records - drawing tiles without a parent canvas, or OGP images without corresponding canvas records

**Independent Test**: Manually create orphaned records in the database (e.g., inserting drawing_tile records with non-existent canvas_id), run cleanup process, and verify that orphaned records are removed while valid records remain

### Tests for User Story 2 ⚠️ WRITE FIRST - MUST FAIL BEFORE IMPLEMENTATION

- [ ] T021 [P] [US2] Write test "should identify orphaned tiles" in backend/tests/cleanup.test.ts (mock tile with non-existent canvas_id, verify deletion from DB and R2) - MUST FAIL initially
- [ ] T022 [P] [US2] Write test "should identify orphaned OGP images" in backend/tests/cleanup.test.ts (mock R2 ogp/{id}.png without matching canvas.ogp_image_key, verify deletion) - MUST FAIL initially
- [ ] T023 [P] [US2] Write test "should NOT delete valid data references" in backend/tests/cleanup.test.ts (mock tile with valid canvas_id, verify NOT deleted) - MUST FAIL initially

**Checkpoint**: All US2 tests written and FAILING - ready for implementation

### Implementation for User Story 2

- [ ] T024 [P] [US2] Implement cleanupOrphanedData method in backend/src/services/cleanup.ts: LEFT JOIN query for orphaned tiles per research.md Q5
- [ ] T025 [US2] Implement orphaned tile deletion in cleanupOrphanedData: delete from drawing_tile table → delete from R2 storage with retry per data-model.md orphaned tile query
- [ ] T026 [US2] Implement orphaned OGP image detection in cleanupOrphanedData: R2.list(prefix='ogp/') → compare with canvas.ogp_image_key → delete unmatched per research.md Q5
- [ ] T027 [US2] Add orphan deletion statistics tracking in cleanupOrphanedData: return counts for orphaned_tiles_deleted and orphaned_ogp_deleted per contracts/CleanupService.md

**Checkpoint**: Run tests T021-T023 - all should PASS. User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Deletion records and statistics (Priority: P2)

**Goal**: System maintains persistent deletion records showing cleanup history, including deleted canvas counts, tile counts before/after cleanup, and storage space reclaimed

**Independent Test**: Run cleanup with test data, then query deletion records to verify all statistics are accurately captured including: deleted canvas count, deleted tile count, system-wide tile count before/after, storage reclaimed, and timestamp

### Tests for User Story 3 ⚠️ WRITE FIRST - MUST FAIL BEFORE IMPLEMENTATION

- [ ] T028 [P] [US3] Write test "should create deletion record with accurate statistics" in backend/tests/cleanup.test.ts (run cleanup with 5 canvases, verify deletion_record has correct counts) - MUST FAIL initially
- [ ] T029 [P] [US3] Write test "should calculate total_tiles_before and total_tiles_after correctly" in backend/tests/cleanup.test.ts (verify total_tiles_after = total_tiles_before - tiles_deleted - orphaned_tiles_deleted) - MUST FAIL initially
- [ ] T030 [P] [US3] Write test "should create deletion record with zero counts when no deletions" in backend/tests/cleanup.test.ts (run cleanup with no qualifying canvases, verify record created with all zeros) - MUST FAIL initially
- [ ] T031 [P] [US3] Write test "should persist errors_encountered as JSON array" in backend/tests/cleanup.test.ts (simulate R2 deletion failure, verify errors logged in deletion_record) - MUST FAIL initially

**Checkpoint**: All US3 tests written and FAILING - ready for implementation

### Implementation for User Story 3

- [ ] T032 [US3] Implement getTotalTileCount helper method in backend/src/services/cleanup.ts: SELECT COUNT(*) FROM drawing_tile per data-model.md
- [ ] T033 [US3] Implement recordCleanupExecution method in backend/src/services/cleanup.ts: INSERT INTO deletion_record with all CleanupStats fields per contracts/CleanupService.md
- [ ] T034 [US3] Add duration_ms tracking in executeCleanup: capture startTime, calculate Date.now() - startTime before recording per data-model.md DeletionRecord schema
- [ ] T035 [US3] Add errors_encountered JSON serialization in recordCleanupExecution: convert errors array to JSON string or NULL per data-model.md validation rules
- [ ] T036 [US3] Generate unique deletion record ID in recordCleanupExecution: use format "dr_YYYY-MM-DD_HHMMSS" or UUID per data-model.md

**Checkpoint**: Run tests T028-T031 - all should PASS. All three user stories should now be independently functional.

---

## Phase 6: Concurrency Control & Main Execution Flow

**Purpose**: Lock mechanism and top-level cleanup orchestration

### Tests for Concurrency Control ⚠️ WRITE FIRST - MUST FAIL BEFORE IMPLEMENTATION

- [ ] T037 [P] Write test "should acquire and release lock successfully" in backend/tests/cleanup.test.ts (verify lock INSERT → cleanup runs → lock DELETE) - MUST FAIL initially
- [ ] T038 [P] Write test "should throw LockAcquisitionError if already locked" in backend/tests/cleanup.test.ts (simulate UNIQUE constraint failure on lock INSERT) - MUST FAIL initially
- [ ] T039 [P] Write test "should force release stale lock" in backend/tests/cleanup.test.ts (mock lock older than 30 minutes, verify DELETE and re-acquire) - MUST FAIL initially
- [ ] T040 Write integration test "should perform full cleanup end-to-end" in backend/tests/cleanup.test.ts (create test data with backdated timestamps, run executeCleanup, verify all data deleted and deletion_record created) - MUST FAIL initially

**Checkpoint**: All concurrency tests written and FAILING - ready for implementation

### Implementation for Concurrency Control

- [ ] T041 Implement acquireLock method in backend/src/services/cleanup.ts: INSERT INTO cleanup_lock with id=1, throw LockAcquisitionError if fails per data-model.md cleanup_lock usage
- [ ] T042 Implement releaseLock method in backend/src/services/cleanup.ts: DELETE FROM cleanup_lock WHERE id=1 per data-model.md
- [ ] T043 Implement stale lock detection in acquireLock: query lock with datetime check, force DELETE if >30 minutes old per research.md Q2
- [ ] T044 Create LockAcquisitionError class in backend/src/services/cleanup.ts with locked_by and locked_at properties per contracts/CleanupService.md
- [ ] T045 Implement executeCleanup main orchestration in backend/src/services/cleanup.ts: acquire lock → capture before stats → cleanup canvases → cleanup orphans → capture after stats → record execution → release lock in finally block per contracts/CleanupService.md

**Checkpoint**: Run tests T037-T040 - all should PASS. Full cleanup system is functional.

---

## Phase 7: Integration & Deployment

**Purpose**: Wire up cron trigger and deploy to environments

- [ ] T046 Complete scheduled handler implementation in backend/src/index.ts: call cleanupService.executeCleanup(env), handle LockAcquisitionError gracefully, log results per contracts/CleanupService.md usage example
- [ ] T047 Add structured logging to scheduled handler in backend/src/index.ts: log cleanup_started, cleanup_completed events with JSON format per contracts/CleanupService.md monitoring section
- [ ] T048 Test local cron trigger: run `pnpm dev` then `curl http://localhost:8787/__scheduled?cron=0+2+*+*+*` and verify cleanup executes per quickstart.md
- [ ] T049 Apply database migration to remote D1: `wrangler d1 migrations apply DB --remote` per quickstart.md
- [ ] T050 Deploy to preview environment: `wrangler deploy --env preview` and monitor logs with `wrangler tail --env preview` per quickstart.md

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T051 [P] Add JSDoc comments to CleanupService public methods in backend/src/services/cleanup.ts per TypeScript best practices
- [ ] T052 [P] Verify all TypeScript strict mode compliance: no `any` types, all parameters properly typed per constitution Principle III
- [ ] T053 Run full test suite and verify 100% pass rate: `pnpm test backend/tests/cleanup.test.ts`
- [ ] T054 Run type checking: `cd backend && pnpm type-check` and resolve any errors per constitution Principle III
- [ ] T055 Run lint: `cd backend && pnpm lint` and resolve any warnings per quickstart.md deployment checklist
- [ ] T056 [P] Update CLAUDE.md with cleanup feature context if needed (agent context already updated by speckit.plan)
- [ ] T057 Validate quickstart.md examples: manually follow all code examples and verify they work per quickstart.md validation requirement
- [ ] T058 Create test data script in backend/tests/ for manual validation: generate backdated canvases for easy testing per quickstart.md manual testing section

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T003) completion
- **User Story 1 (Phase 3)**: Depends on Foundational (T004-T007) completion
- **User Story 2 (Phase 4)**: Depends on Foundational (T004-T007) completion - CAN run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Foundational (T004-T007) completion - CAN run in parallel with US1/US2
- **Concurrency Control (Phase 6)**: Depends on US1, US2, US3 completion
- **Integration (Phase 7)**: Depends on Phase 6 completion
- **Polish (Phase 8)**: Depends on Phase 7 completion

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories - can start after Foundational
- **User Story 2 (P2)**: No dependencies on other stories - can start after Foundational - runs independently
- **User Story 3 (P2)**: Uses statistics from US1 and US2 but independently testable - can develop in parallel

### Within Each User Story

1. **Tests FIRST** (T008-T014 for US1, T021-T023 for US2, T028-T031 for US3)
   - All tests for a story can be written in parallel [P]
   - Tests MUST FAIL before implementation begins
2. **Implementation** (follows test completion)
   - Core logic before integration
   - Error handling and edge cases last
3. **Verify tests PASS** after implementation

### Parallel Opportunities

**Phase 1 (Setup)**:
- T003 can run in parallel with T001-T002

**Phase 2 (Foundational)**:
- T006 and T007 can run in parallel after T004-T005

**Phase 3-5 (User Stories)**:
- Once Foundational complete, all three user stories can start in parallel
- Within each story:
  - All tests marked [P] can run in parallel
  - US1: T008-T014 (all tests)
  - US2: T021-T023 (all tests)
  - US3: T028-T031 (all tests)

**Phase 6 (Concurrency)**:
- T037-T039 (lock tests) can run in parallel

**Phase 8 (Polish)**:
- T051, T052, T056 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (MUST write these first):
Task: "Write test for empty canvases in backend/tests/cleanup.test.ts"
Task: "Write test for unshared canvases in backend/tests/cleanup.test.ts"
Task: "Write test for young canvases in backend/tests/cleanup.test.ts"
Task: "Write test for shared canvases with tiles in backend/tests/cleanup.test.ts"
Task: "Write test for data deletion order in backend/tests/cleanup.test.ts"
Task: "Write test for batch processing in backend/tests/cleanup.test.ts"
Task: "Write test for safety limit in backend/tests/cleanup.test.ts"

# After all tests FAIL, implement US1 sequentially (T015-T020)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T007) ⚠️ CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1
   - Write ALL tests (T008-T014) - ensure they FAIL
   - Implement (T015-T020) - ensure tests PASS
4. **STOP and VALIDATE**: Test User Story 1 independently with backdated data
5. Consider deploying/demoing if ready (basic cleanup working)

### Incremental Delivery

1. Setup + Foundational → Foundation ready (T001-T007)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: unused canvas cleanup working!)
3. Add User Story 2 → Test independently → Deploy/Demo (orphan cleanup added)
4. Add User Story 3 → Test independently → Deploy/Demo (deletion records for monitoring)
5. Add Concurrency Control → Deploy/Demo (production-ready with lock mechanism)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T007)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (T008-T020)
   - **Developer B**: User Story 2 (T021-T027)
   - **Developer C**: User Story 3 (T028-T036)
3. Stories complete independently, then Developer A integrates in Phase 6

---

## TDD Compliance (Constitution Principle I)

This task list follows **Test-First Development** as required by the constitution:

✅ **Red Phase**: Tests written first (T008-T014, T021-T023, T028-T031, T037-T040) and MUST FAIL
✅ **Green Phase**: Implementation tasks (T015-T020, T024-T027, T032-T036, T041-T045) make tests PASS
✅ **Refactor Phase**: Polish tasks (Phase 8) for cleanup and optimization after tests pass

**Test Coverage**:
- User Story 1: 7 tests covering deletion criteria, batch processing, safety limits
- User Story 2: 3 tests covering orphaned tile and OGP detection
- User Story 3: 4 tests covering deletion record accuracy and edge cases
- Concurrency: 4 tests covering lock acquisition, conflicts, stale locks, end-to-end flow

**Total**: 18 comprehensive tests covering all functional requirements

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story (US1, US2, US3)
- Each user story is independently testable and deployable
- **Tests MUST be written first and FAIL** before implementation (TDD requirement)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- constitution Principle II (Simplicity): No premature abstractions, single CleanupService class, direct D1 queries
- constitution Principle III (Type Safety): All tasks maintain TypeScript strict mode compliance
