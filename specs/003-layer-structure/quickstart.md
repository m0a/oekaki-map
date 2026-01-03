# Quickstart: レイヤー構造機能

**Feature**: 003-layer-structure
**Date**: 2026-01-03

## 開発環境セットアップ

```bash
# リポジトリのクローン（済みの場合はスキップ）
git clone <repo-url>
cd oekaki-map

# 依存関係インストール
pnpm install

# データベースマイグレーション（ローカル）
pnpm db:migrate

# 開発サーバー起動
pnpm dev          # フロントエンド (http://localhost:5173)
pnpm dev:backend  # バックエンド (http://localhost:8787)
```

## 新規依存関係

```bash
# フロントエンドにdnd-kitを追加
cd frontend
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## データベーススキーマ追加

新しいマイグレーションファイルを作成:

```bash
# backend/src/db/migrations/002_add_layers.sql

-- Layer table
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

-- Add layer_id to drawing_tile
ALTER TABLE drawing_tile ADD COLUMN layer_id TEXT REFERENCES layer(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tile_layer ON drawing_tile(layer_id);
```

## 実装順序

### Phase 1: バックエンド（APIとデータベース）

1. **型定義追加** (`backend/src/types/index.ts`)
   - Layer インターフェース
   - API Request/Response 型

2. **レイヤーサービス** (`backend/src/services/layers.ts`)
   - CRUD操作のビジネスロジック
   - order管理ロジック

3. **レイヤーAPI** (`backend/src/routes/layers.ts`)
   - GET /canvas/:canvasId/layers
   - POST /canvas/:canvasId/layers
   - PATCH /canvas/:canvasId/layers/:id
   - DELETE /canvas/:canvasId/layers/:id

4. **タイルAPI拡張** (`backend/src/routes/tiles.ts`)
   - layerId パラメータ対応

### Phase 2: フロントエンド（状態管理とUI）

1. **型定義追加** (`frontend/src/types/index.ts`)
   - Layer インターフェース
   - StrokeData.layerId 追加

2. **useLayersフック** (`frontend/src/hooks/useLayers.ts`)
   - レイヤー一覧取得・管理
   - CRUD操作
   - activeLayerId 状態

3. **LayerPanelコンポーネント** (`frontend/src/components/LayerPanel/`)
   - レイヤーリスト表示
   - ドラッグ&ドロップ順序変更
   - 表示/非表示トグル
   - 削除・名前変更

4. **MapWithDrawing拡張**
   - マルチレイヤー描画対応
   - アクティブレイヤーへのストローク追加

5. **Toolbar拡張**
   - レイヤーパネル開閉ボタン

## テスト実行

```bash
# 全テスト実行
npm test

# 特定のテストファイル
npm test -- frontend/src/hooks/useLayers.test.ts
npm test -- tests/integration/api/layers.test.ts

# watchモード
npm test -- --watch
```

## 主要ファイル一覧

```
backend/
├── src/
│   ├── types/index.ts           # Layer型追加
│   ├── services/layers.ts       # 新規
│   ├── routes/layers.ts         # 新規
│   └── routes/tiles.ts          # 拡張
└── tests/
    └── integration/layers.test.ts  # 新規

frontend/
├── src/
│   ├── types/index.ts           # Layer型, StrokeData拡張
│   ├── hooks/
│   │   ├── useLayers.ts         # 新規
│   │   ├── useLayers.test.ts    # 新規
│   │   └── useUndoRedo.ts       # layerId対応
│   └── components/
│       ├── LayerPanel/          # 新規ディレクトリ
│       │   ├── LayerPanel.tsx
│       │   ├── LayerItem.tsx
│       │   └── LayerPanel.test.tsx
│       ├── MapWithDrawing/
│       │   └── MapWithDrawing.tsx  # マルチレイヤー対応
│       └── Toolbar/
│           └── Toolbar.tsx         # レイヤーボタン追加
└── tests/
```

## 動作確認チェックリスト

- [ ] 新規キャンバスにデフォルトレイヤーが作成される
- [ ] レイヤーパネルの開閉が動作する
- [ ] 新しいレイヤーを作成できる（最大10個まで）
- [ ] レイヤーの表示/非表示が切り替わる
- [ ] レイヤーの順序をドラッグで変更できる
- [ ] レイヤー名を編集できる
- [ ] レイヤーを削除できる（最後の1つは削除不可）
- [ ] 選択中のレイヤーに描画される
- [ ] Undo/Redoが正しく動作する
- [ ] ページリロード後もレイヤー構造が維持される
