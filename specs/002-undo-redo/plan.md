# Implementation Plan: 描画のUndo/Redo機能

**Branch**: `002-undo-redo` | **Date**: 2026-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-undo-redo/spec.md`

## Summary

ユーザーが地図上での描画操作を取り消し（Undo）・やり直し（Redo）できる機能を実装する。ストローク単位での履歴管理をクライアントサイドで行い、既存のツールバーにUndo/Redoボタンを追加。キーボードショートカット（Ctrl+Z/Ctrl+Y）にも対応する。

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React 18+, Leaflet
**Storage**: クライアントサイドメモリ（セッション内のみ）、サーバー同期は既存のタイル保存機能を利用
**Testing**: Vitest
**Target Platform**: Web (モバイルファースト、デスクトップ対応)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: Undo/Redo操作は0.1秒以内に画面反映
**Constraints**: 最大50回分の履歴保持、ページリロードで履歴クリア
**Scale/Scope**: 既存のMapWithDrawingコンポーネントとToolbarコンポーネントの拡張

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | Undo/Redo hookのテストを先に作成 |
| II. Simplicity & YAGNI | ✅ PASS | クライアントサイドのシンプルなスタック管理、サーバー側変更なし |
| III. Type Safety | ✅ PASS | ストローク履歴の型定義を追加 |
| IV. Mobile-First Design | ✅ PASS | ツールバー内ボタン配置、タッチ操作優先 |

## Project Structure

### Documentation (this feature)

```text
specs/002-undo-redo/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (該当なし - フロントエンドのみの変更)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── MapWithDrawing/
│   │   │   └── MapWithDrawing.tsx  # ストローク記録の追加
│   │   └── Toolbar/
│   │       └── Toolbar.tsx          # Undo/Redoボタン追加
│   ├── hooks/
│   │   ├── useDrawing.ts            # 既存
│   │   └── useUndoRedo.ts           # 新規: 履歴管理hook
│   └── types/
│       └── index.ts                  # StrokeData型追加
└── tests/
    └── unit/
        └── useUndoRedo.test.ts      # 新規: hookのテスト
```

**Structure Decision**: 既存のフロントエンド構造を維持し、新規hookとToolbar拡張のみで実装。バックエンド変更は不要（既存の自動保存機能を活用）。

## Complexity Tracking

*No violations - complexity within acceptable bounds*
