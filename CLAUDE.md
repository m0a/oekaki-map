# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

oekaki-map is a web application for drawing on OpenStreetMap and sharing via URL. Users can draw freehand on a map, and the drawings are saved as 256x256px WebP tiles stored in Cloudflare R2.

**Production URL**: https://oekaki-map.abe00makoto.workers.dev

## Commands

### Development
```bash
# Start both frontend and backend (recommended)
pnpm dev

# Or start separately
cd frontend && pnpm dev      # Vite dev server (port 5173)
cd backend && pnpm dev       # Wrangler local dev (port 8787)
```

### Testing
```bash
# Unit tests
cd frontend && pnpm test     # Vitest with React Testing Library
cd backend && pnpm test      # Vitest

# Single test file
cd frontend && pnpm test src/hooks/useUndoRedo.test.ts

# E2E tests
pnpm test:e2e                # Playwright
```

### Lint & Type Check
```bash
pnpm lint                    # ESLint (root config covers both)
pnpm type-check              # TypeScript strict mode
```

### Database (D1)
```bash
cd backend
pnpm exec wrangler d1 migrations apply DB --local     # Local
pnpm exec wrangler d1 migrations apply DB --remote    # Production
pnpm exec wrangler d1 migrations list DB --local      # Check status
```

### Release
```bash
/release                     # Claude Code command - auto-increments patch version
```

## Architecture

### Data Flow
1. User draws on HTML5 Canvas overlay (positioned over Leaflet map)
2. On stroke end, canvas is split into 256x256 tiles at current zoom level
3. Tiles are converted to WebP and uploaded to R2 via `/api/canvas/:id/tiles`
4. Tile metadata stored in D1, images in R2 with key format: `tiles/{canvasId}/{z}/{x}/{y}.webp`
5. On load, tiles for visible area are fetched and composited onto canvas

### Key Architectural Decisions
- **Tile-based storage**: Drawings stored as map tiles (same z/x/y system as map tiles) for efficient loading at any zoom
- **Canvas origin tracking**: `canvasOriginRef` tracks which LatLng is at canvas center for coordinate conversion
- **Stroke-based undo**: Each stroke is tracked with `StrokeData` (points, color, width, layerId) for undo/redo
- **OGP for crawlers**: Server detects crawlers via User-Agent and returns HTML with OGP meta tags instead of SPA

### Frontend Structure
- `App.tsx` - Main orchestrator, manages state via custom hooks
- `MapWithDrawing.tsx` - Leaflet map + Canvas overlay, handles draw/navigate modes
- Custom hooks pattern: `useCanvas`, `useDrawing`, `useLayers`, `useUndoRedo`, `useAutoSave`

### Backend Structure
- `index.ts` - Hono router, serves SPA and handles OGP for crawlers
- Routes: `/api/canvas`, `/api/tiles`, `/api/layers`, `/api/ogp`
- Services: `canvas.ts`, `tiles.ts`, `layers.ts` (D1 operations), `storage.ts`, `ogp-storage.ts` (R2 operations)

### Type Sharing
Backend exports types from `backend/src/types/index.ts`. Frontend imports the same type definitions locally. Key types:
- `Canvas` - Drawing surface with position, zoom, OGP metadata
- `Layer` - Drawing layer (max 10 per canvas)
- `TileCoordinate` - z/x/y tile position
- `StrokeData` - Frontend-only, for undo/redo

## CI/CD

| Event | Environment | URL Pattern |
|-------|-------------|-------------|
| PR | Preview | `oekaki-map-pr-{N}.abe00makoto.workers.dev` |
| main push | Main Preview | `oekaki-map-main-preview.abe00makoto.workers.dev` |
| Tag (v*) | Production | `oekaki-map.abe00makoto.workers.dev` |

D1 migrations run automatically before each deployment.

## Development Workflow

### Preview Environment での確認（重要）

**開発時は必ずプレビュー環境で動作確認すること。**

1. **PR作成後**: `oekaki-map-pr-{N}.abe00makoto.workers.dev` でテスト
2. **mainマージ後**: `oekaki-map-main-preview.abe00makoto.workers.dev` で確認
3. **リリース前**: main previewで最終確認してからタグを作成

### マイグレーションを伴うPRの注意

**DBマイグレーションを含むPRは特別な手順が必要：**

1. PRをmainにマージ（マイグレーションが実行される）
2. **Main Preview環境で動作確認を行う**（本番DBと同じスキーマになる）
3. 問題がなければタグを作成してProduction デプロイ

マイグレーションは各環境で自動実行されるが、スキーマ変更の影響はPreview環境で先に確認すること。

## Specs

Feature specifications are in `specs/` directory. Each feature has `spec.md`, `plan.md`, and optionally `tasks.md`.

## Active Technologies
- TypeScript 5.6.3 (strict mode) (009-hono-rpc-migration)
- Cloudflare D1 (SQLite), Cloudflare R2 (object storage) (009-hono-rpc-migration)
- TypeScript 5.6.3 (strict mode) + React 18.3, Leaflet 1.9.4, Vite 6.0 (011-multi-touch-auto-drag)
- N/A（この機能はフロントエンドUIのみ） (011-multi-touch-auto-drag)

## Recent Changes
- 009-hono-rpc-migration: Added TypeScript 5.6.3 (strict mode)
