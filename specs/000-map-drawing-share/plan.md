# Implementation Plan: 地図お絵かき共有サービス

**Branch**: `001-map-drawing-share` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-map-drawing-share/spec.md`

## Summary

地図上にお絵かきができ、URLで共有できるWebサービス。アカウント不要で、描いた内容はタイルベースのWebP画像として永続保存。Leaflet + OpenStreetMap（白黒）で地図表示、Hono RPC + Cloudflare D1/R2でバックエンド。

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React 18+, Vite, Hono, Leaflet, Hono RPC
**Storage**: Cloudflare D1 (canvas metadata), Cloudflare R2 (tile images as WebP)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Web (Mobile-first: iOS Safari, Android Chrome, Desktop browsers)
**Project Type**: Web application (frontend + backend on Cloudflare Workers)
**Performance Goals**: 3s initial load, 50ms stroke latency, 5s shared URL load on 3G
**Constraints**: No authentication, URL-based sharing only, max 1000 tiles/canvas
**Scale/Scope**: 100 concurrent users, permanent storage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | Vitest + Playwright configured, TDD workflow planned |
| II. Simplicity & YAGNI | ✅ PASS | Minimal features for MVP, no real-time sync |
| III. Type Safety | ✅ PASS | TypeScript strict, Hono RPC for typed API, D1 typed queries |
| IV. Mobile-First Design | ✅ PASS | Touch-first UI, Leaflet touch support, 320px+ responsive |

**Technology Stack Compliance**:
- ✅ React + Vite (frontend)
- ✅ Hono + Hono RPC (backend API)
- ✅ TypeScript strict mode
- ✅ Cloudflare D1 (metadata)
- ✅ Cloudflare R2 (tile storage)
- ✅ Leaflet + OpenStreetMap (map - confirmed in spec)

## Project Structure

### Documentation (this feature)

```text
specs/001-map-drawing-share/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI)
│   └── api.yaml
├── checklists/
│   └── requirements.md  # Spec validation checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── Map/              # Leaflet map wrapper
│   │   ├── DrawingCanvas/    # Canvas overlay for drawing
│   │   ├── Toolbar/          # Color, thickness, tools
│   │   └── ShareButton/      # URL copy functionality
│   ├── hooks/
│   │   ├── useDrawing.ts     # Drawing state management
│   │   ├── useCanvas.ts      # Canvas/tile operations
│   │   └── useMap.ts         # Map state and events
│   ├── services/
│   │   └── api.ts            # Hono RPC client
│   ├── types/
│   │   └── index.ts          # Shared type definitions
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json

backend/
├── src/
│   ├── routes/
│   │   ├── canvas.ts         # Canvas CRUD endpoints
│   │   └── tiles.ts          # Tile upload/download
│   ├── services/
│   │   ├── canvas.ts         # Canvas business logic
│   │   └── storage.ts        # R2 operations
│   ├── db/
│   │   └── schema.ts         # D1 schema definitions
│   ├── types/
│   │   └── index.ts          # Shared types (exported to frontend)
│   └── index.ts              # Hono app entry
├── wrangler.toml             # Cloudflare Workers config
├── tsconfig.json
└── package.json

tests/
├── unit/
│   ├── frontend/
│   └── backend/
├── integration/
│   └── api/
└── e2e/
    └── drawing.spec.ts
```

**Structure Decision**: Web application structure with separate frontend (Vite + React) and backend (Hono on Cloudflare Workers). Frontend deployed to Cloudflare Pages, backend to Cloudflare Workers. Shared types exported from backend to frontend via Hono RPC.

## Complexity Tracking

> No constitution violations. All requirements met with standard patterns.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | - | - |
