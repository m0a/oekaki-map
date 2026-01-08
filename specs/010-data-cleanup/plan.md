# Implementation Plan: Data Cleanup Mechanism

**Branch**: `010-data-cleanup` | **Date**: 2026-01-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/m0a/oekaki-map/specs/010-data-cleanup/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement an automated cleanup system that removes unused canvas data (empty or unshared canvases older than 30 days) and orphaned records, while maintaining persistent deletion records for audit trail and capacity planning. The system will run as a scheduled Cloudflare Workers Cron job, processing canvases in batches to avoid timeout, with retry logic for failed R2 deletions.

## Technical Context

**Language/Version**: TypeScript 5.6.3 (strict mode)
**Primary Dependencies**:
- Hono (backend framework)
- Cloudflare Workers (runtime environment)
- Cloudflare D1 (SQLite database)
- Cloudflare R2 (object storage)

**Storage**:
- D1 database (existing tables: canvas, drawing_tile, layer)
- R2 bucket (existing: tile images, OGP images)
- New table: deletion_record

**Testing**: Vitest (existing test infrastructure)
**Target Platform**: Cloudflare Workers (edge compute)
**Project Type**: Web application (backend + frontend monorepo)
**Performance Goals**:
- Cleanup completes in <5 minutes for 1000 canvases
- Batch size: 100 canvases per iteration
- Works within Cloudflare Workers 30-second CPU time limit

**Constraints**:
- Cloudflare Workers execution time limits (30s CPU, 15 min wall clock for Cron)
- Must not block user-facing requests
- No external dependencies beyond Cloudflare platform
- Scheduled execution via Workers Cron Triggers

**Scale/Scope**:
- Expected cleanup frequency: daily
- Expected deletion volume: variable (depends on user behavior)
- Deletion records: ~365/year (permanent retention acceptable)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Test-First Development ✅ PASS

**Compliance**: This feature WILL follow TDD:
- Unit tests for cleanup service logic (canvas identification, deletion statistics)
- Integration tests for D1 database operations (queries, deletions, record creation)
- Integration tests for R2 storage operations (deletion, orphan detection)
- Tests will be written before implementation per constitution requirement

**Test Strategy**:
1. **Red**: Write tests for canvas cleanup logic with mocked data
2. **Green**: Implement minimal cleanup service to pass tests
3. **Refactor**: Optimize batch processing and error handling

### Principle II: Simplicity & YAGNI ✅ PASS

**Compliance**: Implementation follows YAGNI:
- ✅ No premature abstractions - single CleanupService class
- ✅ No unused features - implements only P1/P2 requirements
- ✅ Batch processing chosen for necessity (timeout prevention), not speculation
- ✅ Locking mechanism only to prevent concurrent execution (explicit requirement)
- ✅ No configuration layer - constants defined inline (retention period, batch size)

**Simplicity Decisions**:
- Direct D1 queries (no ORM/query builder beyond Drizzle if already in use)
- Linear batch processing (no complex scheduling or priority queues)
- Simple retry logic (1 immediate retry, then defer)

### Principle III: Type Safety ✅ PASS

**Compliance**: Full type safety maintained:
- ✅ TypeScript strict mode (already enabled project-wide)
- ✅ Explicit types for deletion_record table schema
- ✅ Typed service interfaces (CleanupService, CleanupResult, DeletionStats)
- ✅ No `any` types - all D1/R2 operations properly typed
- ✅ Validation at boundaries (cron trigger input validation if any)

**Type Coverage**:
- Database schema types for deletion_record
- Service method return types (CleanupResult with success/error counts)
- Statistics types (DeletionStats with before/after counts)

### Principle IV: Mobile-First Design ⚠️ NOT APPLICABLE

**Status**: This is a backend-only feature (scheduled cleanup job)
- No UI components
- No user interaction
- No mobile considerations needed

**Post-Phase-1 Check Required**: ❌ No (backend-only feature)

### Summary

**Status**: ✅ **GATE PASSED** - All applicable principles satisfied
- Test-first approach planned
- Simple, focused implementation
- Full type safety maintained
- Mobile-first not applicable (backend feature)

**Violations requiring justification**: None

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── migrations/
│   └── 0007_add_deletion_record.sql     # NEW: deletion_record table DDL
├── src/
│   ├── services/
│   │   └── cleanup.ts                   # NEW: CleanupService implementation
│   ├── types/
│   │   └── index.ts                     # UPDATED: Add DeletionRecord, CleanupResult types
│   └── index.ts                         # UPDATED: Add cron trigger handler
├── wrangler.toml                        # UPDATED: Add cron trigger configuration
└── tests/
    └── cleanup.test.ts                  # NEW: CleanupService tests

frontend/
└── [NO CHANGES - backend-only feature]
```

**Structure Decision**: Web application (Option 2) - This is a backend-only feature. All implementation occurs in the `backend/` directory. The cleanup service will be triggered via Cloudflare Workers Cron Triggers, configured in `wrangler.toml`. No frontend changes are required since this is an automated background job with no user interface.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Constitution check passed without requiring complexity justifications.
