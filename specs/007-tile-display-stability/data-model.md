# Data Model: タイル表示安定性の修正

**Feature**: 007-tile-display-stability | **Date**: 2026-01-04

## Overview

フロントエンドのタイルキャッシュと描画状態を管理するための型定義。また、HTTPキャッシュ最適化のため、バックエンドのタイルメタデータAPIに`updatedAt`フィールドを追加。

## Type Definitions

### Backend Types（HTTPキャッシュ対応）

```typescript
// backend/src/types/index.ts

/**
 * タイル座標（既存）
 */
export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

/**
 * タイル座標 + バージョン情報（新規）
 * HTTPキャッシュのバージョニングに使用
 */
export interface TileCoordinateWithVersion extends TileCoordinate {
  /** タイルの最終更新日時（ISO 8601形式） */
  updatedAt: string;
}
```

```typescript
// frontend/src/types/index.ts

/**
 * タイル情報（フロントエンド用）
 * APIレスポンスから取得し、画像URL生成に使用
 */
export interface TileInfo {
  z: number;
  x: number;
  y: number;
  /** タイルの最終更新日時（HTTPキャッシュ用） */
  updatedAt?: string;
}
```

### TileCache Types

```typescript
// frontend/src/utils/tileCache.ts

/**
 * キャッシュされたタイル画像
 */
export interface CachedTile {
  /** タイル画像（HTMLImageElement） */
  image: HTMLImageElement;
  /** ズームレベル */
  z: number;
  /** X座標（タイル座標系） */
  x: number;
  /** Y座標（タイル座標系） */
  y: number;
  /** キャッシュに追加された時刻（Date.now()） */
  loadedAt: number;
}

/**
 * タイルキャッシュのキー生成関数の型
 */
export type TileCacheKeyFn = (
  canvasId: string,
  z: number,
  x: number,
  y: number
) => string;

/**
 * タイルキャッシュインターフェース
 */
export interface ITileCache {
  /** キャッシュからタイルを取得 */
  get(canvasId: string, z: number, x: number, y: number): CachedTile | undefined;

  /** キャッシュにタイルを追加 */
  set(canvasId: string, z: number, x: number, y: number, image: HTMLImageElement): void;

  /** キャッシュをクリア（canvasId指定でそのキャンバスのみ） */
  clear(canvasId?: string): void;

  /** 指定キャンバスの全タイルを取得 */
  getAllForCanvas(canvasId: string): CachedTile[];

  /** キャッシュサイズを取得 */
  size(): number;
}
```

### Hook Types

```typescript
// frontend/src/hooks/useTileCache.ts

import type { TileInfo } from '../types';
import type { CachedTile } from '../utils/tileCache';

/**
 * useTileCacheフックの戻り値型
 */
export interface UseTileCacheResult {
  /** タイルを読み込み、キャッシュに追加 */
  loadTile: (canvasId: string, tile: TileInfo) => Promise<HTMLImageElement>;

  /** 複数タイルを並列読み込み */
  loadTiles: (canvasId: string, tiles: TileInfo[]) => Promise<HTMLImageElement[]>;

  /** キャッシュから指定キャンバスの全タイルを取得 */
  getCachedTiles: (canvasId: string) => CachedTile[];

  /** キャッシュをクリア */
  clearCache: (canvasId?: string) => void;

  /** 読み込み中かどうか */
  isLoading: boolean;
}
```

### Render State Types

```typescript
// frontend/src/types/index.ts（既存ファイルに追加）

/**
 * 描画状態を表す型
 * redrawAll関数で使用
 */
export interface RenderState {
  /** キャンバスID */
  canvasId: string;

  /** 表示中のストローク */
  strokes: StrokeData[];

  /** 表示するレイヤーのID */
  visibleLayerIds: string[];

  /** 現在のズームレベル */
  currentZoom: number;

  /** マップの中心座標 */
  center: { lat: number; lng: number };
}

/**
 * タイル描画オプション
 */
export interface TileRenderOptions {
  /** キャンバスコンテキスト */
  ctx: CanvasRenderingContext2D;

  /** キャンバスの原点（タイル座標系） */
  canvasOrigin: { x: number; y: number; zoom: number };

  /** キャンバスサイズ */
  canvasSize: { width: number; height: number };
}
```

## Key Design Decisions

### 1. キャッシュキー形式

```
{canvasId}:{z}:{x}:{y}
```

例: `abc123:17:116324:52145`

- canvasId: キャンバスごとのキャッシュ分離
- z/x/y: タイル座標による一意識別

### 2. LRUキャッシュ戦略

- 最大サイズ: 150タイル
- 超過時: 最も古い（loadedAtが小さい）タイルを削除
- メモリ見積もり: 256x256 × 4bytes × 150 ≈ 39MB（最大）

### 3. キャッシュの有効期限

- 明示的な有効期限なし
- 以下の場合にクリア:
  - canvasId変更時
  - ユーザーによる明示的なリロード
  - ブラウザのメモリ圧迫時（ブラウザGC任せ）

## Entity Relationships

```
MapWithDrawing
    │
    ├── useTileCache (hook)
    │       │
    │       └── TileCache (singleton)
    │               │
    │               └── CachedTile[] (Map storage)
    │
    └── RenderState
            │
            ├── strokes: StrokeData[]
            └── cachedTiles: CachedTile[]
```

## Migration Notes

- **DBスキーマ変更なし**: `updated_at`カラムは既存（drawing_tileテーブル）
- **APIレスポンス変更**: `GET /canvas/:id/tiles`のレスポンスに`updatedAt`フィールド追加
- **後方互換性**: フロントエンドは`updatedAt`がない場合もハンドリング可能
- **ローカルストレージ/IndexedDB使用なし**: メモリキャッシュのみ
