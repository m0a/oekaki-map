# oekaki-map Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-02

## Active Technologies
- TypeScript 5.x (strict mode) + GitHub Actions, Cloudflare Wrangler CLI, pnpm (001-ci-auto-deploy)
- Cloudflare D1 (SQLite-compatible), Cloudflare R2 (001-ci-auto-deploy)
- TypeScript 5.x (strict mode) + React 18+, Leaflet (002-undo-redo)
- クライアントサイドメモリ（セッション内のみ）、サーバー同期は既存のタイル保存機能を利用 (002-undo-redo)

- TypeScript 5.x (strict mode) + React 18+, Vite, Hono, Leaflet, Hono RPC (001-map-drawing-share)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes
- 002-undo-redo: Added TypeScript 5.x (strict mode) + React 18+, Leaflet
- 001-ci-auto-deploy: Added TypeScript 5.x (strict mode) + GitHub Actions, Cloudflare Wrangler CLI, pnpm

- 001-map-drawing-share: Added TypeScript 5.x (strict mode) + React 18+, Vite, Hono, Leaflet, Hono RPC

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
