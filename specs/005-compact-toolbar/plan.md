# Implementation Plan: Compact Toolbar Design

**Branch**: `005-compact-toolbar` | **Date**: 2026-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-compact-toolbar/spec.md`

## Summary

現在のツールバーはテキストラベル（Draw, Erase, Move, Layers, Undo, Redo）と8色の常時表示カラーパレットにより、モバイル端末で描画エリアを圧迫しています。本機能では以下の改善を実施します：

1. **テキストラベルをアイコンに置き換え** - 鉛筆、消しゴム、手のひら、レイヤーアイコン
2. **カラーパレットのポップアップ化** - 選択中の1色のみ表示し、タップでポップアップ展開
3. **線の太さ選択のポップアップ化** - 同様にポップアップで選択
4. **ツールチップ対応** - 長押し/ホバーでツール名を表示

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18.3.1, Leaflet 1.9.4, Vite 6.0
**Storage**: N/A（UIのみの変更）
**Testing**: vitest 2.1.8, @testing-library/react 16.1.0
**Target Platform**: Web (Mobile-first, PWA対応)
**Project Type**: Web application (frontend)
**Performance Goals**: 60fps UIアニメーション、ポップアップ表示は100ms以内
**Constraints**: 幅320px以上の画面でツールバーが1行に収まること
**Scale/Scope**: 単一コンポーネント（Toolbar.tsx）の改修 + 新規サブコンポーネント追加

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | PASS | ツールバーテストを先に書き、Red→Green→Refactorで実装 |
| II. Simplicity & YAGNI | PASS | アイコン化とポップアップのみ。折りたたみ機能はスコープ外 |
| III. Type Safety | PASS | 新しい型（PopupType）を追加、既存型を活用 |
| IV. Mobile-First Design | PASS | タッチ操作を優先、ツールチップは長押しで表示 |

## Project Structure

### Documentation (this feature)

```text
specs/005-compact-toolbar/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # N/A (UI-only, no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── Toolbar/
│   │   │   ├── Toolbar.tsx           # Main toolbar (refactor)
│   │   │   ├── Toolbar.test.tsx      # Tests (update)
│   │   │   ├── IconButton.tsx        # NEW: Reusable icon button
│   │   │   ├── ColorPopup.tsx        # NEW: Color palette popup
│   │   │   ├── ThicknessPopup.tsx    # NEW: Thickness popup
│   │   │   └── icons/                # NEW: SVG icon components
│   │   │       ├── PencilIcon.tsx
│   │   │       ├── EraserIcon.tsx
│   │   │       ├── HandIcon.tsx
│   │   │       ├── LayersIcon.tsx
│   │   │       ├── UndoIcon.tsx
│   │   │       └── RedoIcon.tsx
│   │   └── ...
│   └── types/
│       └── index.ts                  # Add PopupType
└── tests/
    └── ...
```

**Structure Decision**: 既存のWeb application構造を維持。Toolbarコンポーネントをリファクタリングし、新規サブコンポーネント（IconButton, ColorPopup, ThicknessPopup）とSVGアイコンコンポーネントを追加。

## Complexity Tracking

該当なし - Constitution Checkに違反なし
