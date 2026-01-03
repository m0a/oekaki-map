# Implementation Plan: OGP Share Preview

**Branch**: `006-ogp-share-preview` | **Date**: 2026-01-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-ogp-share-preview/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

LINE、X（Twitter）、Facebook等のSNSで共有した際にプレビュー画像とタイトル・説明文が適切に表示されるよう、OGPメタタグとTwitterカード対応を実装する。プレビュー画像は共有ボタンクリック時にクライアントサイドで生成し、R2にアップロード。バックエンドはSNSクローラーのリクエストに対して動的にOGPメタタグを含むHTMLを返却する。

## Technical Context

**Language/Version**: TypeScript 5.6 (strict mode)
**Primary Dependencies**: React 18.3.1, Hono 4.6.0, Leaflet 1.9.4, html2canvas（画像生成用）
**Storage**: Cloudflare D1 (SQLite) + Cloudflare R2 (WebP/PNG画像)
**Testing**: Vitest 2.1.8 + Testing Library + Playwright (E2E)
**Target Platform**: Cloudflare Workers (Edge), Web Browser (Mobile-first)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: OGPメタタグを含むHTML応答 < 1秒
**Constraints**: クローラーはJavaScript非実行、R2画像は公開アクセス可能である必要
**Scale/Scope**: 個人利用〜小規模共有、1キャンバスあたり1プレビュー画像

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | 画像生成、OGP生成、API エンドポイントのテストを先に作成 |
| II. Simplicity & YAGNI | ✅ PASS | 最小限の実装：html2canvas + R2 + 動的HTML生成のみ |
| III. Type Safety | ✅ PASS | OGPメタデータ型、API レスポンス型を定義 |
| IV. Mobile-First Design | ✅ PASS | 共有ボタンは既存のモバイルUI、Web Share API 活用 |

**Technology Stack Compliance**:
- React + Vite ✅
- Hono ✅
- TypeScript strict ✅
- Cloudflare D1 ✅
- Cloudflare R2 ✅

**No violations detected. Proceeding to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   ├── canvas.ts          # 既存（PATCH /api/canvas/:id 拡張）
│   │   └── ogp.ts             # 新規：OGP画像アップロード、メタデータ取得
│   ├── services/
│   │   ├── ogp.ts             # 新規：OGPメタデータ生成ロジック
│   │   └── geocoding.ts       # 新規：Nominatim逆ジオコーディング
│   ├── templates/
│   │   └── ogp-html.ts        # 新規：OGPメタタグ付きHTMLテンプレート
│   └── index.ts               # 拡張：/c/:id でOGP HTML返却
└── tests/
    └── ogp.test.ts            # 新規：OGP生成テスト

frontend/
├── src/
│   ├── components/
│   │   └── ShareButton/
│   │       └── ShareButton.tsx # 拡張：プレビュー画像生成・表示
│   ├── hooks/
│   │   └── useShare.ts        # 拡張：画像生成・アップロード処理
│   ├── services/
│   │   ├── api.ts             # 拡張：OGP API呼び出し
│   │   └── previewGenerator.ts # 新規：html2canvas画像生成
│   └── utils/
│       └── geocoding.ts       # 新規：Nominatim API呼び出し（クライアント）
└── tests/
    └── previewGenerator.test.ts # 新規：画像生成テスト
```

**Structure Decision**: Web application (frontend + backend) 構造を維持。OGP関連機能は既存の構造に沿って追加。

## Complexity Tracking

> **No violations detected. Table not required.**
