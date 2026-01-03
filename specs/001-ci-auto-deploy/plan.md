# Implementation Plan: CI/CD自動デプロイ設定

**Branch**: `001-ci-auto-deploy` | **Date**: 2026-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ci-auto-deploy/spec.md`

## Summary

GitHub ActionsによるCI/CDパイプラインを構築し、mainブランチへのpushで自動デプロイ、PRでのCI実行・プレビュー環境デプロイ、D1マイグレーションの自動実行を実現する。lifestyle-appのCI設定を参考に、oekaki-map用に最適化した構成とする。

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: GitHub Actions, Cloudflare Wrangler CLI, pnpm
**Storage**: Cloudflare D1 (SQLite-compatible), Cloudflare R2
**Testing**: vitest
**Target Platform**: Cloudflare Workers (edge runtime)
**Project Type**: Web application (frontend + backend monorepo)
**Performance Goals**: CI完了5分以内、デプロイ完了10分以内
**Constraints**: GitHub Actions無料枠内で運用
**Scale/Scope**: 個人プロジェクト、ソロ開発

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | CIでテスト実行を必須化（FR-006a） |
| II. Simplicity & YAGNI | ✅ PASS | lifestyle-appの実績あるパターンを踏襲、必要最小限の構成 |
| III. Type Safety | ✅ PASS | CIで型チェックを必須化（FR-006） |
| IV. Mobile-First Design | N/A | CI/CD機能はバックエンド/インフラのため対象外 |

**Quality Gates Alignment**:
- Pre-commit → TypeScript compilation: CIの型チェックで担保
- Pre-merge → All tests MUST pass: CIのテスト実行で担保
- Pre-deploy → Build MUST complete: CIのビルドステップで担保

## Project Structure

### Documentation (this feature)

```text
specs/001-ci-auto-deploy/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── ci.yml           # Main CI/CD workflow

backend/
├── src/
│   └── db/
│       └── schema.sql   # D1 migration file (idempotent)
└── wrangler.toml        # Cloudflare Workers config

frontend/
└── src/                 # Frontend source (built by CI)
```

**Structure Decision**: 既存のfrontend/backend構造を維持。.github/workflows/ci.ymlを新規追加してCI/CDを実現する。

## Complexity Tracking

> **No violations - keeping it simple**

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Single workflow file | ci.yml一つで全機能を実現 | lifestyle-appと同様、シンプルに保つ |
| 冪等マイグレーション | CREATE IF NOT EXISTS形式 | マイグレーションツール不要で複雑性を削減 |
| PR Preview | 独立Worker名でデプロイ | D1は共有（preview環境）、シンプルに保つ |

