# Implementation Plan: レイヤー構造機能

**Branch**: `003-layer-structure` | **Date**: 2026-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-layer-structure/spec.md`

## Summary

地図描画アプリに画像編集ソフトのようなレイヤー構造を追加する。ユーザーは複数のレイヤー（最大10）を作成し、各レイヤーに独立して描画できる。レイヤーの表示/非表示、順序変更、削除、名前変更が可能。既存のUndo/Redo機能は全レイヤー共通の履歴として動作する。

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React 18.3.1, Leaflet 1.9.4, Hono 4.6.0, Vite 6.0
**Storage**: Cloudflare D1 (SQLite) + Cloudflare R2 (WebP tiles)
**Testing**: Vitest + React Testing Library + jsdom
**Target Platform**: Web (PWA, mobile-first)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: SC-002: 表示切替1秒以内、SC-003: 10レイヤーでも描画遅延なし
**Constraints**: モバイル優先、タッチ操作、320px以上の画面幅対応
**Scale/Scope**: 最大10レイヤー/キャンバス、既存タイル保存システムを拡張

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Test-First Development ✅

- レイヤー機能の各ユーザーストーリーに対応するテストを先に作成
- useLayersフック、LayerPanelコンポーネント、APIエンドポイントのテストを実装

### Principle II: Simplicity & YAGNI ✅

- 透明度、ブレンドモード、ロック機能は対象外として明示（Assumptions）
- 最大10レイヤーという制限でシンプルさを維持
- データマイグレーション不要で動的に既存データを解釈

### Principle III: Type Safety ✅

- Layer型、LayerState型を厳密に定義
- API境界でZodによるランタイム検証
- D1スキーマにレイヤーテーブル追加

### Principle IV: Mobile-First Design ✅

- 右側サイドパネル（トグル可能）でモバイルでもアクセス可能
- タッチ操作でのドラッグ&ドロップ順序変更
- 320px以上の画面幅で動作

## Project Structure

### Documentation (this feature)

```text
specs/003-layer-structure/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── db/
│   │   └── migrate.ts        # D1スキーマ（layersテーブル追加）
│   ├── routes/
│   │   ├── canvas.ts         # 既存（レイヤー対応拡張）
│   │   └── layers.ts         # 新規：レイヤーCRUD API
│   ├── services/
│   │   └── layers.ts         # 新規：レイヤービジネスロジック
│   └── types/
│       └── index.ts          # Layer型追加
└── tests/
    └── integration/
        └── layers.test.ts    # 新規：レイヤーAPI統合テスト

frontend/
├── src/
│   ├── components/
│   │   ├── LayerPanel/       # 新規：レイヤーパネルUI
│   │   │   ├── LayerPanel.tsx
│   │   │   ├── LayerItem.tsx
│   │   │   └── LayerPanel.test.tsx
│   │   ├── MapWithDrawing/
│   │   │   └── MapWithDrawing.tsx  # 既存（マルチレイヤー対応）
│   │   └── Toolbar/
│   │       └── Toolbar.tsx         # 既存（レイヤーパネル開閉ボタン追加）
│   ├── hooks/
│   │   ├── useLayers.ts            # 新規：レイヤー状態管理
│   │   ├── useLayers.test.ts       # 新規：レイヤーフックテスト
│   │   └── useUndoRedo.ts          # 既存（レイヤーID追加）
│   └── types/
│       └── index.ts                # Layer型、StrokeData拡張
└── tests/
```

**Structure Decision**: 既存のWeb application構造（frontend + backend）を維持し、レイヤー機能を追加

## Complexity Tracking

> Constitution Check passed - no violations to justify.
