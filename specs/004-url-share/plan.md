# Implementation Plan: URL共有ボタン・現在位置取得ボタン

**Branch**: `004-url-share` | **Date**: 2026-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-url-share/spec.md`

## Summary

地図アプリにURL共有ボタンと現在位置取得ボタンを追加する。共有ボタンはWeb Share API（モバイル）またはクリップボードコピー（デスクトップ）を使用し、共有時の中心座標とズームレベルをDBに保存する。共有されたURLを開くと保存された状態で地図が表示される。現在位置取得ボタンはGeolocation APIを使用してユーザーの現在地に地図を移動する。

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18.3.1, Leaflet 1.9.4, Hono 4.6.0, Vite 6.0
**Storage**: Cloudflare D1 (SQLite) + Cloudflare R2
**Testing**: Vitest (frontend), Playwright (E2E)
**Target Platform**: Web (モバイルファースト、PWA対応予定)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: 共有操作1秒以内、現在位置取得5秒以内
**Constraints**: アカウント機能なし、URLのみで共有
**Scale/Scope**: 個人利用向け地図描画アプリ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | テストを先に書いてから実装する |
| II. Simplicity & YAGNI | ✅ PASS | Web Share API + クリップボードのシンプルな実装 |
| III. Type Safety | ✅ PASS | TypeScript strict mode、Hono RPC型安全 |
| IV. Mobile-First Design | ✅ PASS | Web Share API優先、タッチ操作対応 |

**Gate Status**: ✅ PASSED - No violations

## Project Structure

### Documentation (this feature)

```text
specs/004-url-share/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   └── canvas.ts    # 既存: PATCH /canvas/:id を拡張（共有ビュー状態保存）
│   ├── services/
│   │   └── canvas.ts    # 既存: update関数を拡張
│   ├── db/
│   │   └── schema.sql   # 既存: canvas テーブルに share_* カラム追加
│   └── types/
│       └── index.ts     # 型定義
└── tests/

frontend/
├── src/
│   ├── components/
│   │   ├── Toolbar/
│   │   │   └── Toolbar.tsx  # 既存: 共有ボタン・現在位置ボタン追加
│   │   └── ShareButton/     # 新規: 共有ボタンコンポーネント
│   ├── hooks/
│   │   ├── useShare.ts      # 新規: Web Share API / クリップボード
│   │   └── useGeolocation.ts # 新規: Geolocation API
│   └── services/
│       └── api.ts           # 既存: 共有ビュー状態保存API追加
└── tests/
```

**Structure Decision**: 既存のfrontend/backend構造を維持し、新規コンポーネントとhooksを追加。DBスキーマはcanvasテーブルに共有用カラムを追加。

## Complexity Tracking

> No violations - table not needed
