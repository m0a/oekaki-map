# Implementation Plan: マルチタッチ自動ドラッグモード切替

**Branch**: `011-multi-touch-auto-drag` | **Date**: 2026-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-multi-touch-auto-drag/spec.md`

## Summary

ペンモード/消しゴムモードでシングルタッチ（1本指）のみ描画を許可し、マルチタッチ（2本指以上）を検出した場合は自動的にドラッグモード（地図操作）に切り替える。これにより、ユーザーはツールバーのモード切替ボタンを押さずに、直感的に描画と地図操作を切り替えられるようになる。

技術的アプローチ: Pointer Events APIを使用してアクティブなポインター数を追跡し、複数ポインターが検出された場合にCanvasの`pointerEvents`を`none`に設定してLeafletマップへイベントを透過させる。

## Technical Context

**Language/Version**: TypeScript 5.6.3 (strict mode)
**Primary Dependencies**: React 18.3, Leaflet 1.9.4, Vite 6.0
**Storage**: N/A（この機能はフロントエンドUIのみ）
**Testing**: Vitest + React Testing Library
**Target Platform**: モバイルブラウザ（iOS Safari, Chrome Android）、デスクトップブラウザ
**Project Type**: Web application (frontend only for this feature)
**Performance Goals**: モード切替レイテンシ < 100ms
**Constraints**: Pointer Events API対応ブラウザのみ（iOS 13+, Chrome 55+で対応済み）
**Scale/Scope**: 単一コンポーネント（DrawingCanvas.tsx）の修正 + 新規hook追加

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | useMultiTouchフックのユニットテストを先に作成 |
| II. Simplicity & YAGNI | ✅ PASS | 既存のPointer Eventsハンドラーを拡張、新規抽象化は最小限 |
| III. Type Safety | ✅ PASS | TypeScript strict mode継続、pointerIdはnumber型 |
| IV. Mobile-First Design | ✅ PASS | この機能自体がタッチ操作のUX改善 |

**Gate評価**: 全原則をパス。Phase 0へ進行可能。

## Project Structure

### Documentation (this feature)

```text
specs/011-multi-touch-auto-drag/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── DrawingCanvas/
│   │       └── DrawingCanvas.tsx  # 修正対象: マルチタッチ検出ロジック追加
│   ├── hooks/
│   │   └── useMultiTouch.ts       # 新規: マルチタッチ状態管理hook
│   └── types/
│       └── index.ts               # 修正: 必要に応じて型追加
└── tests/
    └── hooks/
        └── useMultiTouch.test.ts  # 新規: hookのユニットテスト
```

**Structure Decision**: フロントエンドのみの変更。新規カスタムhook `useMultiTouch` を追加し、DrawingCanvasコンポーネントで使用する。

## Complexity Tracking

> 違反なし - 追加の正当化は不要
