# Quickstart: OGP Share Preview

**Feature Branch**: `006-ogp-share-preview`
**Date**: 2026-01-04

## Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with D1/R2 access

## Setup

### 1. Install Dependencies

```bash
# Frontend
cd frontend
npm install leaflet-simple-map-screenshoter

# Backend (既存の依存関係で対応可能)
cd backend
# 追加パッケージ不要
```

### 2. Database Migration

```bash
cd backend
wrangler d1 execute oekaki-map-db --local --file=./migrations/006_add_ogp_columns.sql
```

Migration file content:
```sql
-- migrations/006_add_ogp_columns.sql
ALTER TABLE canvas ADD COLUMN ogp_image_key TEXT;
ALTER TABLE canvas ADD COLUMN ogp_place_name TEXT CHECK (ogp_place_name IS NULL OR length(ogp_place_name) <= 100);
ALTER TABLE canvas ADD COLUMN ogp_generated_at TEXT;
```

### 3. Environment Variables

追加の環境変数は不要。既存のR2バインディング (`TILES`) を使用。

## Development

### Run Local Server

```bash
# Root directory
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:8787

### Test OGP Generation

1. ブラウザでお絵かきを作成
2. 共有ボタンをクリック
3. ブラウザコンソールで画像生成を確認
4. `curl -H "User-Agent: Twitterbot" http://localhost:8787/c/{canvasId}` でOGPタグ確認

### Test Crawler Detection

```bash
# Twitterbot
curl -H "User-Agent: Twitterbot/1.0" http://localhost:8787/c/test123

# LINE
curl -H "User-Agent: Line/1.0" http://localhost:8787/c/test123

# Normal browser (SPA shell)
curl http://localhost:8787/c/test123
```

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/services/previewGenerator.ts` | 画像生成ロジック |
| `frontend/src/hooks/useShare.ts` | 共有フロー（拡張） |
| `backend/src/routes/ogp.ts` | OGP API エンドポイント |
| `backend/src/services/ogp.ts` | OGPメタデータ生成 |
| `backend/src/templates/ogp-html.ts` | HTMLテンプレート |

## Testing

```bash
# Unit tests
npm test

# E2E tests (OGP verification)
npm run test:e2e
```

## Deployment

```bash
# Run migrations on production
wrangler d1 execute oekaki-map-db --file=./migrations/006_add_ogp_columns.sql

# Deploy
npm run deploy
```

## Verification

1. **LINE**:
   - LINE Developersのページキャッシュクリアツールでプレビュー確認
   - 実際にトークでURL送信

2. **X (Twitter)**:
   - Card Validator: https://cards-dev.twitter.com/validator
   - 投稿してプレビュー確認

3. **Facebook**:
   - Sharing Debugger: https://developers.facebook.com/tools/debug/
