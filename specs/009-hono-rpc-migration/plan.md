# Implementation Plan: Hono RPC Migration

**Branch**: `009-hono-rpc-migration` | **Date**: 2026-01-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/m0a/oekaki-map/specs/009-hono-rpc-migration/spec.md`

## Summary

既存のフロントエンド手動fetch実装をHono RPCに移行し、バックエンドとフロントエンド間の型安全なAPI通信を実現する。`hono/client`の`hc()`関数を使用してバックエンドの`AppType`から型安全なクライアントを生成し、既存の200行の`frontend/src/services/api.ts`を30%以上削減しながら、全機能（Canvas、Tiles、Layers、OGP）の動作を維持する。

## Technical Context

**Language/Version**: TypeScript 5.6.3 (strict mode)
**Primary Dependencies**:
- Backend: Hono 4.6.0, @hono/zod-validator 0.4.2
- Frontend: Hono 4.6.0 (RPC client用), React 18.3.1, Vite 6.0.3
- Shared: Zod 3.24.1 (validation)

**Storage**: Cloudflare D1 (SQLite), Cloudflare R2 (object storage)
**Testing**: Vitest 2.1.8 (both frontend and backend)
**Target Platform**:
- Backend: Cloudflare Workers
- Frontend: Modern browsers (ES2020+), mobile-first

**Project Type**: Web application (separate frontend/backend)
**Performance Goals**:
- RPC overhead < 5ms vs direct fetch
- Type inference time < 100ms in IDE
- No runtime performance degradation

**Constraints**:
- Must maintain existing API URL structure (`/api/*`)
- Must support FormData for image uploads (tiles, OGP)
- Must work with Cloudflare Workers environment
- Must maintain 100% backward compatibility during migration

**Scale/Scope**:
- 5 API domains (Canvas, Tiles, Layers, OGP, Logs)
- ~20 endpoints total
- ~200 LOC in current `api.ts` to be migrated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Test-First Development

**Compliance**: PASS with plan
- Plan includes test migration strategy in Phase 1
- Existing tests will be updated to use RPC client
- New integration tests will verify type safety
- TDD cycle will be followed for RPC client wrapper functions

**Evidence**:
- Backend has Vitest setup: `"test": "vitest"` in package.json
- Frontend has Vitest setup: `"test": "vitest"` in package.json
- Migration will write tests first, verify failure, then implement RPC

### ✅ Principle II: Simplicity & YAGNI

**Compliance**: PASS
- Using standard `hono/client` without additional abstraction layers
- No custom RPC framework - leveraging built-in Hono RPC
- Removing boilerplate code (30%+ reduction target)
- Not adding API versioning or mock generation (explicitly out of scope)

**Evidence**:
- Spec explicitly excludes GraphQL, tRPC, API versioning, mocking
- Using existing `AppType` export from backend (already present)
- No new build tools or codegen beyond standard Hono RPC

### ✅ Principle III: Type Safety

**Compliance**: PASS - this feature enhances type safety
- Migrating from `as Promise<Canvas>` casts to inferred types
- RPC provides end-to-end type safety from backend to frontend
- TypeScript strict mode already enabled (both package.json)
- Success criteria SC-002: 100% type error detection rate

**Evidence**:
- Current code uses manual type casts: `return res.json() as Promise<Canvas>`
- Post-migration will use automatic type inference from `AppType`
- Existing: `@hono/zod-validator` for runtime validation at boundaries

### ✅ Principle IV: Mobile-First Design

**Compliance**: PASS - no UI changes
- This is an internal API migration
- No changes to touch interactions or responsive design
- Performance constraint ensures no mobile degradation

**Evidence**:
- Constraint: "No runtime performance degradation"
- Success criteria SC-005: Response time must be equal or better
- Mobile users unaffected - purely backend communication change

### Technology Stack Compliance

**Compliance**: PASS
- ✅ React + Vite (frontend) - maintained
- ✅ Hono (backend) - enhanced with RPC
- ✅ TypeScript strict - maintained
- ✅ Cloudflare D1 - unchanged
- ✅ Cloudflare R2 - unchanged

**New addition**: `hono/client` package (part of standard Hono)
- Rationale: Enables type-safe RPC without new framework
- Alternative rejected: tRPC would require new dependency and patterns

## Project Structure

### Documentation (this feature)

```text
specs/009-hono-rpc-migration/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (hono/client best practices)
├── data-model.md        # Phase 1 output (API type mappings)
├── quickstart.md        # Phase 1 output (RPC client usage guide)
├── contracts/           # Phase 1 output (API endpoint mappings)
│   └── rpc-api.md       # RPC endpoint documentation
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Web application structure (Option 2)
backend/
├── src/
│   ├── index.ts         # MODIFIED: Export AppType for RPC
│   ├── routes/          # UNCHANGED: Existing Hono routes
│   │   ├── canvas.ts    # Canvas CRUD endpoints
│   │   ├── tiles.ts     # Tile endpoints
│   │   ├── layers.ts    # Layer endpoints
│   │   ├── ogp.ts       # OGP endpoints
│   │   └── logs.ts      # Logging endpoints
│   ├── services/        # UNCHANGED: Business logic
│   └── types/           # UNCHANGED: Type definitions
│       └── index.ts     # Exported types shared with frontend
└── tests/               # MODIFIED: Update to test RPC compliance

frontend/
├── src/
│   ├── services/
│   │   ├── api.ts       # REPLACED: Manual fetch → Hono RPC client
│   │   └── rpc.ts       # NEW: RPC client initialization
│   ├── hooks/           # MODIFIED: Use new RPC client
│   │   ├── useCanvas.ts
│   │   ├── useLayers.ts
│   │   └── useAutoSave.ts
│   ├── components/      # UNCHANGED: UI components
│   └── types/           # REMOVED: Import from backend instead
└── tests/
    ├── integration/     # MODIFIED: Test RPC integration
    └── unit/            # MODIFIED: Mock RPC client

shared/                  # NOT CREATED: Using backend/src/types exports
```

**Structure Decision**: Web application (separate frontend/backend)
- Backend already at `backend/` with Hono routes and types export
- Frontend already at `frontend/` with React/Vite
- No monorepo tools needed - using direct TypeScript imports from backend
- Backend `package.json` already exports `"./types": "./src/types/index.ts"`

## Complexity Tracking

> **No violations - table not needed**

Constitution check passed with no violations. This migration:
- Maintains existing technology stack
- Simplifies code (reduces boilerplate)
- Enhances type safety (core principle)
- Requires no new abstractions beyond standard Hono RPC
