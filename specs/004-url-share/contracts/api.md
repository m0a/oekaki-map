# API Contracts: URL共有ボタン・現在位置取得ボタン

**Branch**: `004-url-share` | **Date**: 2026-01-03

## Endpoints

### 1. Update Share View State

共有ボタン押下時に現在のビュー状態をDBに保存する。

**Endpoint**: `PATCH /api/canvas/:id`

**Request Body** (既存エンドポイントを拡張):
```typescript
interface UpdateCanvasRequest {
  // 既存フィールド
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  // 新規フィールド
  shareLat?: number;
  shareLng?: number;
  shareZoom?: number;
}
```

**Response**:
```typescript
interface Canvas {
  id: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  shareLat: number | null;
  shareLng: number | null;
  shareZoom: number | null;
  createdAt: string;
  updatedAt: string;
  tileCount: number;
}
```

**Status Codes**:
| Code | Description |
|------|-------------|
| 200 | 更新成功 |
| 400 | バリデーションエラー |
| 404 | Canvas not found |
| 500 | サーバーエラー |

**Validation**:
```typescript
const updateCanvasSchema = z.object({
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  zoom: z.number().int().min(1).max(19).optional(),
  shareLat: z.number().min(-90).max(90).optional(),
  shareLng: z.number().min(-180).max(180).optional(),
  shareZoom: z.number().int().min(1).max(19).optional(),
});
```

---

### 2. Get Canvas (既存、レスポンス拡張)

Canvas取得時に共有ビュー状態も含めて返す。

**Endpoint**: `GET /api/canvas/:id`

**Response** (拡張):
```typescript
interface GetCanvasResponse {
  canvas: {
    id: string;
    centerLat: number;
    centerLng: number;
    zoom: number;
    shareLat: number | null;   // 新規
    shareLng: number | null;   // 新規
    shareZoom: number | null;  // 新規
    createdAt: string;
    updatedAt: string;
    tileCount: number;
  };
  tiles: TileCoordinate[];
}
```

**表示ロジック (フロントエンド)**:
```typescript
function getInitialPosition(canvas: Canvas): MapPosition {
  // 共有ビュー状態があればそれを使用
  if (canvas.shareLat !== null && canvas.shareLng !== null && canvas.shareZoom !== null) {
    return {
      lat: canvas.shareLat,
      lng: canvas.shareLng,
      zoom: canvas.shareZoom,
    };
  }
  // なければデフォルトのcenter座標
  return {
    lat: canvas.centerLat,
    lng: canvas.centerLng,
    zoom: canvas.zoom,
  };
}
```

---

## Frontend API Client Extensions

### api.ts 追加メソッド

```typescript
// frontend/src/services/api.ts

export const api = {
  // 既存...

  canvas: {
    // 既存メソッド...

    // 共有ビュー状態を保存
    async updateShareState(
      canvasId: string,
      shareState: { lat: number; lng: number; zoom: number }
    ): Promise<Canvas> {
      const res = await fetch(`${API_BASE_URL}/canvas/${canvasId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareLat: shareState.lat,
          shareLng: shareState.lng,
          shareZoom: shareState.zoom,
        }),
      });
      if (!res.ok) throw new Error('Failed to update share state');
      return res.json() as Promise<Canvas>;
    },
  },
};
```

---

## Sequence Diagrams

### Share Button Flow

```
User -> ShareButton: タップ
ShareButton -> useShare: share()
useShare -> api.canvas: updateShareState(canvasId, position)
api.canvas -> Backend: PATCH /api/canvas/:id
Backend -> D1: UPDATE canvas SET share_*
D1 -> Backend: OK
Backend -> api.canvas: 200 { canvas }
api.canvas -> useShare: success
useShare -> navigator.share: share({ url, title })
navigator.share -> OS: ネイティブ共有シート
OS -> User: 共有先選択
```

### Current Location Flow

```
User -> LocationButton: タップ
LocationButton -> useGeolocation: getCurrentPosition()
useGeolocation -> Geolocation API: getCurrentPosition()
Geolocation API -> useGeolocation: { lat, lng }
useGeolocation -> Map: setView(lat, lng)
Map -> User: 地図移動
```
