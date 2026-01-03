# Data Model: レイヤー構造機能

**Date**: 2026-01-03
**Feature**: 003-layer-structure

## Entities

### Layer（新規）

レイヤーのメタデータを管理するエンティティ。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | PK, nanoid(21) | 一意識別子 |
| canvasId | string | FK → canvas.id | 所属するキャンバス |
| name | string | NOT NULL, max 50 chars | ユーザー定義の名前 |
| order | number | NOT NULL, >= 0 | 重ね順（0が最背面） |
| visible | boolean | NOT NULL, default true | 表示/非表示状態 |
| createdAt | string | ISO8601 | 作成日時 |
| updatedAt | string | ISO8601 | 更新日時 |

**ビジネスルール:**
- 1キャンバスあたり最大10レイヤー
- 最低1つのレイヤーが必要（削除制限）
- orderは同一キャンバス内でユニーク
- デフォルト名は「レイヤー N」（Nは作成順の番号）

### Canvas（既存・変更なし）

レイヤー導入後もスキーマ変更なし。レイヤー情報はLayerテーブルで管理。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | PK, nanoid(21) | 一意識別子 |
| centerLat | number | NOT NULL | 中心緯度 |
| centerLng | number | NOT NULL | 中心経度 |
| zoom | number | 1-19 | ズームレベル |
| createdAt | string | ISO8601 | 作成日時 |
| updatedAt | string | ISO8601 | 更新日時 |
| tileCount | number | 0-1000 | タイル総数 |

### DrawingTile（既存・拡張）

layer_idカラムを追加。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | PK | 一意識別子 |
| canvasId | string | FK → canvas.id | 所属キャンバス |
| **layerId** | string | FK → layer.id, **NULLABLE** | 所属レイヤー（NULL=デフォルト） |
| z | number | 1-19 | ズームレベル |
| x | number | >= 0 | タイルX座標 |
| y | number | >= 0 | タイルY座標 |
| r2Key | string | UNIQUE | R2ストレージキー |
| createdAt | string | ISO8601 | 作成日時 |
| updatedAt | string | ISO8601 | 更新日時 |

**後方互換性:**
- `layerId = NULL` は既存データを表し、フロントエンドで「デフォルトレイヤー」として解釈

### StrokeData（フロントエンド・拡張）

layerIdフィールドを追加。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | nanoid | 一意識別子 |
| **layerId** | string | NOT NULL | 所属レイヤー |
| points | Array<{lat, lng}> | NOT NULL | 地理座標の配列 |
| color | string | HEX format | ストローク色 |
| thickness | number | > 0 | 線の太さ（px） |
| mode | 'draw' \| 'erase' | - | 描画モード |
| timestamp | number | Unix timestamp | 作成時刻 |
| zoom | number | 1-19 | 描画時のズームレベル |

## Database Schema (D1 SQLite)

### 新規テーブル: layer

```sql
CREATE TABLE IF NOT EXISTS layer (
  id TEXT PRIMARY KEY,
  canvas_id TEXT NOT NULL REFERENCES canvas(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) <= 50),
  "order" INTEGER NOT NULL CHECK ("order" >= 0),
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (canvas_id, "order")
);

CREATE INDEX IF NOT EXISTS idx_layer_canvas ON layer(canvas_id);
```

### 既存テーブル変更: drawing_tile

```sql
ALTER TABLE drawing_tile ADD COLUMN layer_id TEXT REFERENCES layer(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tile_layer ON drawing_tile(layer_id);
```

## TypeScript Types

### Backend Types

```typescript
// backend/src/types/index.ts に追加

export interface Layer {
  id: string;
  canvasId: string;
  name: string;
  order: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLayerRequest {
  name?: string;  // オプション（デフォルト名自動生成）
}

export interface UpdateLayerRequest {
  name?: string;
  order?: number;
  visible?: boolean;
}

export interface GetLayersResponse {
  layers: Layer[];
}

export interface CreateLayerResponse {
  layer: Layer;
}

export interface UpdateLayerResponse {
  layer: Layer;
}

// 定数
export const MAX_LAYERS_PER_CANVAS = 10;
export const MAX_LAYER_NAME_LENGTH = 50;
```

### Frontend Types

```typescript
// frontend/src/types/index.ts に追加

export interface Layer {
  id: string;
  canvasId: string;
  name: string;
  order: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

// StrokeDataの拡張
export interface StrokeData {
  id: string;
  layerId: string;  // 追加
  points: Array<{ lat: number; lng: number }>;
  color: string;
  thickness: number;
  mode: 'draw' | 'erase';
  timestamp: number;
  zoom: number;
}

// レイヤー状態管理
export interface LayersState {
  layers: Layer[];
  activeLayerId: string | null;
  isLoading: boolean;
  error: string | null;
}

// 定数
export const MAX_LAYERS_PER_CANVAS = 10;
export const DEFAULT_LAYER_NAME_PREFIX = 'レイヤー';
```

## Entity Relationships

```
Canvas (1) ───────< (N) Layer
   │                    │
   │                    │
   └───< (N) DrawingTile >───┘
              │
              └── (layer_id nullable for backward compatibility)
```

## State Transitions

### Layer Lifecycle

```
[作成] ──→ [表示中] ←──→ [非表示]
              │
              └──→ [削除] (最後の1つは削除不可)
```

### Layer Order Management

順序変更時のロジック:
1. 移動元のレイヤーを一時的に order = -1 に設定
2. 影響を受けるレイヤーの order を再番号付け
3. 移動元のレイヤーを新しい order に設定

これによりUNIQUE制約違反を回避。

## Validation Rules

| Rule | Validation |
|------|------------|
| レイヤー名 | 1-50文字、空白のみ不可 |
| レイヤー数 | 1キャンバスあたり最大10 |
| 最小レイヤー数 | 最低1つ必須（削除制限） |
| order値 | 0以上の整数、キャンバス内でユニーク |
| visible | boolean（DBでは0/1） |
