# Implementation Plan: タイルマップ追従

**Branch**: `008-tile-map-sync` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-tile-map-sync/spec.md`

## Summary

マップのドラッグ移動・拡大縮小時に、描画済みタイルがベースマップとリアルタイムで追従する機能を実装する。現在の実装ではHTML5 Canvasオーバーレイが固定位置にあり、マップ操作完了後にタイルが「スナップ」するため違和感がある。LeafletのPaneシステムまたはCSS transformを活用して、マップ操作中も描画タイルがスムーズに追従するよう改善する。

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18.3.1, Leaflet 1.9.4, Vite 6.0, Hono 4.6.0
**Storage**: Cloudflare D1 (タイルメタデータ) + Cloudflare R2 (WebP画像)
**Testing**: Vitest + @testing-library/react, Playwright (E2E)
**Target Platform**: Web (モバイルファースト、デスクトップ対応)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: 60fps追従、100枚以上のタイル表示でもスムーズ
**Constraints**: 描画可能ズーム範囲16-19維持、既存の描画機能に影響なし
**Scale/Scope**: 単一画面（MapWithDrawingコンポーネント）の改修

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ Pass | 追従ロジックのユニットテスト、E2Eテストを先に作成 |
| II. Simplicity & YAGNI | ✅ Pass | 既存のLeaflet/Canvas構造を活用、最小限の変更 |
| III. Type Safety | ✅ Pass | TypeScript strict mode維持、新規型定義追加なし |
| IV. Mobile-First Design | ✅ Pass | タッチジェスチャー（ピンチ、パン）対応が主目的 |

## Project Structure

### Documentation (this feature)

```text
specs/008-tile-map-sync/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A - no data model changes)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── MapWithDrawing/
│   │       └── MapWithDrawing.tsx    # 主要改修対象
│   ├── hooks/
│   │   └── useTileCache.ts           # タイルキャッシュ管理
│   └── utils/
│       ├── tiles.ts                   # タイル座標変換
│       └── tileCache.ts               # キャッシュ実装
└── tests/
    └── components/
        └── MapWithDrawing.test.tsx    # 追従テスト追加

tests/
└── e2e/
    └── map-tile-sync.spec.ts          # E2Eテスト追加
```

**Structure Decision**: Web application (frontend + backend)。今回の変更はフロントエンドのみ。MapWithDrawingコンポーネントの改修が中心で、バックエンドAPIの変更は不要。

## Complexity Tracking

> Constitution Check passed - no violations to justify.
