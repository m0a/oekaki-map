# Quickstart: URL共有ボタン・現在位置取得ボタン

**Branch**: `004-url-share` | **Date**: 2026-01-03

## Prerequisites

- Node.js 20+
- pnpm 9.15+
- Wrangler CLI (Cloudflare Workers)

## Setup

```bash
# 1. ブランチに切り替え
git checkout 004-url-share

# 2. 依存関係インストール
pnpm install

# 3. DBマイグレーション（ローカル）
cd backend
wrangler d1 execute oekaki-map-db --local --file=./src/db/migrations/004-share-state.sql
cd ..

# 4. 開発サーバー起動
pnpm dev
```

## File Changes Summary

### Backend

| File | Change |
|------|--------|
| `backend/src/db/migrations/004-share-state.sql` | 新規: share_*カラム追加 |
| `backend/src/db/schema.sql` | 更新: share_*カラム追加 |
| `backend/src/types/index.ts` | 更新: Canvas型にshare*追加 |
| `backend/src/routes/canvas.ts` | 更新: バリデーションスキーマ拡張 |
| `backend/src/services/canvas.ts` | 更新: update関数拡張 |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/types/index.ts` | 更新: Canvas型、GeolocationState型 |
| `frontend/src/services/api.ts` | 更新: updateShareState追加 |
| `frontend/src/hooks/useShare.ts` | 新規: Web Share API hook |
| `frontend/src/hooks/useGeolocation.ts` | 新規: Geolocation API hook |
| `frontend/src/components/Toolbar/Toolbar.tsx` | 更新: ボタン追加 |
| `frontend/src/App.tsx` | 更新: 初期表示ロジック変更 |

### Tests

| File | Change |
|------|--------|
| `frontend/src/hooks/useShare.test.ts` | 新規 |
| `frontend/src/hooks/useGeolocation.test.ts` | 新規 |
| `tests/e2e/share.spec.ts` | 新規: E2Eテスト |

## Testing

```bash
# ユニットテスト
pnpm test

# E2Eテスト
pnpm test:e2e
```

## Key Implementation Notes

### 1. 共有ビュー状態の表示優先順位

```typescript
// App.tsx の初期化ロジック
const initialPosition = canvas.shareLat !== null
  ? { lat: canvas.shareLat, lng: canvas.shareLng, zoom: canvas.shareZoom }
  : { lat: canvas.centerLat, lng: canvas.centerLng, zoom: canvas.zoom };
```

### 2. Web Share API フォールバック

```typescript
// useShare.ts
const share = async () => {
  if (navigator.share) {
    await navigator.share({ url, title });
  } else {
    await navigator.clipboard.writeText(url);
    showToast('URLをコピーしました');
  }
};
```

### 3. 位置情報許可フロー

```typescript
// useGeolocation.ts
const requestLocation = async () => {
  try {
    const position = await getCurrentPosition();
    map.setView([position.coords.latitude, position.coords.longitude]);
  } catch (error) {
    if (error.code === error.PERMISSION_DENIED) {
      showError('位置情報の許可が必要です');
    }
  }
};
```

## Deployment

```bash
# 本番DBマイグレーション
cd backend
wrangler d1 execute oekaki-map-db --remote --file=./src/db/migrations/004-share-state.sql
cd ..

# デプロイ
pnpm deploy
```
