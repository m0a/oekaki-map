# Data Model: URL共有ボタン・現在位置取得ボタン

**Branch**: `004-url-share` | **Date**: 2026-01-03

## Entity Changes

### Canvas (既存テーブル拡張)

既存のcanvasテーブルに共有ビュー状態を保存するカラムを追加。

#### Current Schema
```sql
CREATE TABLE IF NOT EXISTS canvas (
  id TEXT PRIMARY KEY,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  zoom INTEGER NOT NULL CHECK (zoom >= 1 AND zoom <= 19),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  tile_count INTEGER NOT NULL DEFAULT 0 CHECK (tile_count >= 0 AND tile_count <= 1000)
);
```

#### New Columns
| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| share_lat | REAL | YES | -90 to 90 | 共有時の緯度 |
| share_lng | REAL | YES | -180 to 180 | 共有時の経度 |
| share_zoom | INTEGER | YES | 1 to 19 | 共有時のズームレベル |

#### Migration SQL
```sql
-- Add share view state columns to canvas table
ALTER TABLE canvas ADD COLUMN share_lat REAL CHECK (share_lat IS NULL OR (share_lat >= -90 AND share_lat <= 90));
ALTER TABLE canvas ADD COLUMN share_lng REAL CHECK (share_lng IS NULL OR (share_lng >= -180 AND share_lng <= 180));
ALTER TABLE canvas ADD COLUMN share_zoom INTEGER CHECK (share_zoom IS NULL OR (share_zoom >= 1 AND share_zoom <= 19));
```

#### Updated Schema
```sql
CREATE TABLE IF NOT EXISTS canvas (
  id TEXT PRIMARY KEY,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  zoom INTEGER NOT NULL CHECK (zoom >= 1 AND zoom <= 19),
  share_lat REAL CHECK (share_lat IS NULL OR (share_lat >= -90 AND share_lat <= 90)),
  share_lng REAL CHECK (share_lng IS NULL OR (share_lng >= -180 AND share_lng <= 180)),
  share_zoom INTEGER CHECK (share_zoom IS NULL OR (share_zoom >= 1 AND share_zoom <= 19)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  tile_count INTEGER NOT NULL DEFAULT 0 CHECK (tile_count >= 0 AND tile_count <= 1000)
);
```

## TypeScript Types

### Backend Types

```typescript
// backend/src/types/index.ts に追加

interface Canvas {
  id: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  shareLat: number | null;    // 新規
  shareLng: number | null;    // 新規
  shareZoom: number | null;   // 新規
  createdAt: string;
  updatedAt: string;
  tileCount: number;
}

interface ShareViewState {
  lat: number;
  lng: number;
  zoom: number;
}

interface UpdateShareStateRequest {
  shareLat: number;
  shareLng: number;
  shareZoom: number;
}
```

### Frontend Types

```typescript
// frontend/src/types/index.ts に追加

interface Canvas {
  id: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  shareLat: number | null;    // 新規
  shareLng: number | null;    // 新規
  shareZoom: number | null;   // 新規
  createdAt: string;
  updatedAt: string;
  tileCount: number;
}

interface ShareState {
  lat: number;
  lng: number;
  zoom: number;
}

interface GeolocationState {
  loading: boolean;
  error: string | null;
  position: { lat: number; lng: number } | null;
}
```

## State Transitions

### Share View State Lifecycle

```
[NULL] ---(共有ボタン押下)---> [SAVED]
  ^                              |
  |                              |
  +------(再共有ボタン押下)------+
```

- **NULL**: 初期状態、共有ビュー状態未設定
- **SAVED**: 共有ビュー状態がDBに保存済み

### 表示ロジック

```
URL開封時:
  IF share_lat, share_lng, share_zoom が全てNOT NULL
    → 共有ビュー状態で表示
  ELSE
    → center_lat, center_lng, zoom で表示（デフォルト動作）
```

## Validation Rules

### Share View State
- `share_lat`: -90.0 ≤ value ≤ 90.0 または NULL
- `share_lng`: -180.0 ≤ value ≤ 180.0 または NULL
- `share_zoom`: 1 ≤ value ≤ 19 (整数) または NULL
- 3カラムは常に同時にNULLまたは同時にNOT NULL

### Geolocation
- `lat`: -90.0 ≤ value ≤ 90.0
- `lng`: -180.0 ≤ value ≤ 180.0
- 精度は Geolocation API の返却値に依存

## Relationships

```
Canvas (1) -------- (0..1) ShareViewState (embedded as columns)
```

共有ビュー状態はCanvasの属性として埋め込み。別テーブルは不要。
