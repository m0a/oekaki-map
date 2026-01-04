# oekaki-map Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-02

## Active Technologies
- TypeScript 5.x (strict mode) + GitHub Actions, Cloudflare Wrangler CLI, pnpm (001-ci-auto-deploy)
- Cloudflare D1 (SQLite-compatible), Cloudflare R2 (001-ci-auto-deploy)
- TypeScript 5.x (strict mode) + React 18+, Leaflet (002-undo-redo)
- クライアントサイドメモリ（セッション内のみ）、サーバー同期は既存のタイル保存機能を利用 (002-undo-redo)
- TypeScript 5.x (strict mode) + React 18.3.1, Leaflet 1.9.4, Hono 4.6.0, Vite 6.0 (003-layer-structure)
- Cloudflare D1 (SQLite) + Cloudflare R2 (WebP tiles) (003-layer-structure)
- TypeScript 5.6 (strict mode) + React 18.3.1, Leaflet 1.9.4, Hono 4.6.0, Vite 6.0 (004-url-share)
- TypeScript 5.6 (strict mode) + React 18.3.1, Leaflet 1.9.4, Vite 6.0 (005-compact-toolbar)
- N/A（UIのみの変更） (005-compact-toolbar)
- TypeScript 5.6 (strict mode) + React 18.3.1, Hono 4.6.0, Leaflet 1.9.4, html2canvas（画像生成用） (006-ogp-share-preview)
- Cloudflare D1 (SQLite) + Cloudflare R2 (WebP/PNG画像) (006-ogp-share-preview)
- TypeScript 5.6 (strict mode) + React 18.3.1, Leaflet 1.9.4, Vite 6.0, Hono 4.6.0 (008-tile-map-sync)
- Cloudflare D1 (タイルメタデータ) + Cloudflare R2 (WebP画像) (008-tile-map-sync)

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
- 008-tile-map-sync: Added TypeScript 5.6 (strict mode) + React 18.3.1, Leaflet 1.9.4, Vite 6.0, Hono 4.6.0
- 006-ogp-share-preview: Added TypeScript 5.6 (strict mode) + React 18.3.1, Hono 4.6.0, Leaflet 1.9.4, html2canvas（画像生成用）
- 005-compact-toolbar: Added TypeScript 5.6 (strict mode) + React 18.3.1, Leaflet 1.9.4, Vite 6.0


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
