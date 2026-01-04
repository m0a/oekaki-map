# Implementation Plan: タイル表示安定性の修正

**Branch**: `007-tile-display-stability` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-tile-display-stability/spec.md`

## Summary

フロントエンドのレースコンディション（タイル読み込みuseEffectとストローク再描画useEffectの競合）を解決する。タイル画像のメモリキャッシュを導入し、再描画時に常にタイル→ストロークの順序を保証することで、タイルが消失する問題を根本的に解消する。

また、HTTPキャッシュを有効化するため、タイルメタデータAPIに`updatedAt`を追加し、タイル画像URLにバージョンパラメータを付与する。これによりR2へのリクエスト数を削減し、コストを抑制する。

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18.3.1, Leaflet 1.9.4, Hono 4.6.0
**Storage**: メモリ内キャッシュ（Map）+ ブラウザ/CDNキャッシュ、既存のサーバーストレージ（R2）
**Testing**: Vitest 2.1.8 + Testing Library
**Target Platform**: Web Browser (Mobile-first), Cloudflare Workers (Edge)
**Project Type**: Frontend修正 + Backend軽微な修正
**Performance Goals**: 再描画時のちらつきなし、未更新タイルはブラウザキャッシュから取得
**Constraints**: 既存のUndo/Redo、レイヤー機能との互換性維持
**Scale/Scope**: 同時表示タイル最大100枚程度のメモリキャッシュ、HTTPキャッシュは1年

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | TileCache、redrawAll関数のテストを先に作成 |
| II. Simplicity & YAGNI | ✅ PASS | 最小限の変更：キャッシュ追加と描画順序保証のみ |
| III. Type Safety | ✅ PASS | TileCache型、RenderState型を定義 |
| IV. Mobile-First Design | ✅ PASS | 既存のモバイルUIへの影響なし |

**Technology Stack Compliance**:
- React + Vite ✅
- TypeScript strict ✅
- Cloudflare R2 ✅（変更なし）

**No violations detected. Proceeding to implementation.**

## Project Structure

### Documentation (this feature)

```text
specs/007-tile-display-stability/
├── spec.md              # 仕様（作成済み）
├── plan.md              # このファイル
├── research.md          # 調査結果（作成済み）
├── data-model.md        # Phase 1（型定義）
├── quickstart.md        # Phase 1（実装手順）
└── checklists/
    └── requirements.md  # 要件チェック（作成済み）
```

### Source Code (repository root)

```text
backend/src/
├── routes/
│   └── tiles.ts               # 修正：Cache-Controlヘッダー変更
├── services/
│   └── tiles.ts               # 修正：getTilesInAreaにupdatedAt追加
└── types/
    └── index.ts               # 修正：TileCoordinate型にupdatedAt追加

frontend/src/
├── utils/
│   └── tileCache.ts           # 新規：タイルキャッシュユーティリティ
├── hooks/
│   └── useTileCache.ts        # 新規：タイルキャッシュフック
├── services/
│   └── api.ts                 # 修正：getImageUrlにバージョンパラメータ追加
└── components/
    └── MapWithDrawing/
        └── MapWithDrawing.tsx # 修正：redrawAll統合

frontend/tests/
└── tileCache.test.ts          # 新規：タイルキャッシュテスト
```

**Structure Decision**: フロントエンド修正（新規2ファイル、修正2ファイル）+ バックエンド修正（3ファイル）。

## Complexity Tracking

> **No violations detected. Table not required.**

## Implementation Design

### Core Components

#### 1. TileCache（メモリキャッシュ）

```typescript
// frontend/src/utils/tileCache.ts
interface CachedTile {
  image: HTMLImageElement;
  z: number;
  x: number;
  y: number;
  loadedAt: number;
}

class TileCache {
  private cache: Map<string, CachedTile>;
  private maxSize: number;

  constructor(maxSize = 150);

  getKey(canvasId: string, z: number, x: number, y: number): string;
  get(canvasId: string, z: number, x: number, y: number): CachedTile | undefined;
  set(canvasId: string, z: number, x: number, y: number, image: HTMLImageElement): void;
  clear(canvasId?: string): void;
  getAllForCanvas(canvasId: string): CachedTile[];
}
```

#### 2. useTileCache（Reactフック）

```typescript
// frontend/src/hooks/useTileCache.ts
interface UseTileCacheResult {
  loadTile(canvasId: string, tile: TileInfo): Promise<HTMLImageElement>;
  getCachedTiles(canvasId: string): CachedTile[];
  clearCache(canvasId?: string): void;
}

function useTileCache(): UseTileCacheResult;
```

#### 3. redrawAll（統合描画関数）

```typescript
// MapWithDrawing.tsx内
const redrawAll = useCallback(async () => {
  const ctx = canvasRef.current?.getContext('2d');
  if (!ctx) return;

  // 1. キャンバス全消去
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. キャッシュからタイルを描画（先に）
  const cachedTiles = getCachedTiles(canvasId);
  for (const tile of cachedTiles) {
    renderTileToCanvas(ctx, tile);
  }

  // 3. ストロークを描画（後に）
  for (const stroke of strokes) {
    renderStrokeToCanvas(ctx, stroke);
  }
}, [canvasId, strokes, getCachedTiles]);
```

### 描画フローの変更

#### Before（現状）

```text
useEffect(tiles)  → loadTilesToCanvas()
useEffect(strokes) → clearRect() → renderStrokes()
                     ↑ タイルも消去される（問題）
```

#### After（修正後）

```text
useEffect(tiles)  → loadTilesToCache() → redrawAll()
useEffect(strokes) → redrawAll()
                     ↓
                     clearRect() → renderCachedTiles() → renderStrokes()
                                   ↑ 常にタイル→ストロークの順
```

### HTTPキャッシュ設計

#### バックエンド変更

```typescript
// backend/src/services/tiles.ts - getTilesInArea修正
async getTilesInArea(...): Promise<TileCoordinateWithVersion[]> {
  const query = `SELECT z, x, y, updated_at FROM drawing_tile WHERE ...`;
  // updated_atを含めて返却
  return results.results.map((row) => ({
    z: row.z,
    x: row.x,
    y: row.y,
    updatedAt: row.updated_at, // 追加
  }));
}

// backend/src/routes/tiles.ts - 画像配信エンドポイント修正
return new Response(imageData, {
  headers: {
    'Content-Type': 'image/webp',
    'Cache-Control': 'public, max-age=31536000, immutable', // 1年キャッシュ
  },
});
```

#### フロントエンド変更

```typescript
// frontend/src/services/api.ts - getImageUrl修正
getImageUrl(canvasId: string, z: number, x: number, y: number, updatedAt?: string): string {
  const base = `${API_BASE}/tiles/${canvasId}/${z}/${x}/${y}.webp`;
  return updatedAt ? `${base}?v=${updatedAt}` : base;
}
```

#### キャッシュフロー

```text
1. GET /api/canvas/{id}/tiles → [{ z, x, y, updatedAt }, ...]
2. タイル画像取得: /api/tiles/{id}/{z}/{x}/{y}.webp?v={updatedAt}
   → 同じupdatedAtなら同じURL → キャッシュヒット
3. 描画保存後: updatedAtが更新される
   → 新しいURL → R2から取得
```

### Edge Cases

1. **タイル読み込み中のUndo/Redo**
   - キャッシュに存在するタイルのみ描画
   - 読み込み完了後にキャッシュに追加され、次のredrawAllで表示

2. **キャッシュサイズ超過**
   - LRU（Least Recently Used）方式で古いタイルを削除
   - 最大150タイル（約6MBメモリ使用）

3. **canvasId変更時**
   - 古いcanvasIdのキャッシュをクリア
   - 新しいタイルを読み込み

4. **タイル保存直後のリロード**
   - 保存時にupdatedAtが更新される
   - 新しいURLでリクエストされるためキャッシュは使われない

## Testing Strategy

### Unit Tests

1. **TileCache**
   - キャッシュの追加・取得・削除
   - LRU eviction動作
   - canvasId別のキャッシュ分離

2. **useTileCache**
   - タイル読み込みとキャッシュ登録
   - 重複読み込み防止
   - キャッシュクリア

### Integration Tests

1. **Undo/Redo時のタイル保持**
   - Undo実行後もタイルが表示されていること
   - Redo実行後もタイルが表示されていること

2. **モード切替時のタイル保持**
   - 描画→ナビゲート切替でタイル維持
   - ナビゲート→描画切替でタイル維持

### Manual Test Scenarios

**表示安定性**:
1. ページを10回リロードし、毎回タイルが表示されること
2. Undo/Redoを10回実行し、タイルが消えないこと
3. モード切替を20回実行し、タイルが消えないこと

**HTTPキャッシュ**:
4. DevTools Networkタブで地図を移動→戻る、タイルリクエストが「disk cache」になること
5. 描画を保存し、保存したタイルのURLに新しい`?v=`パラメータが付いていること
6. 保存後リロードして新しい描画内容が表示されること
