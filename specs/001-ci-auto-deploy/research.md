# Research: CI/CD自動デプロイ設定

**Date**: 2026-01-03
**Feature**: 001-ci-auto-deploy

## 1. GitHub Actions Workflow Structure

### Decision
lifestyle-appと同様のジョブ構成を採用：
1. `lint-and-typecheck` - ESLint + TypeScript型チェック
2. `test` - vitest実行
3. `build` - フロントエンド/バックエンドビルド（lint/testに依存）
4. `deploy-production` - 本番デプロイ（mainブランチpush時）
5. `deploy-pr-preview` - PRプレビュー環境デプロイ
6. `cleanup-pr-preview` - PRクローズ時のプレビュー削除

### Rationale
- lifestyle-appで実績のあるパターン
- 並列実行でCI時間を短縮（lint/typecheckとtestは並列）
- ビルド成果物をartifactで共有しデプロイ時間を短縮

### Alternatives Considered
- 単一ジョブで全て実行 → 失敗箇所の特定が困難、再実行効率が悪い
- matrix strategyでfrontend/backend並列 → 現時点では過剰な複雑性

## 2. D1マイグレーション方式

### Decision
**冪等なschema.sql方式**を採用（`CREATE TABLE IF NOT EXISTS`）

実行コマンド:
```bash
wrangler d1 execute oekaki-map-db --remote --file=./src/db/schema.sql
```

### Rationale
- 既存のschema.sqlがこの形式で作成済み
- マイグレーションツール（Drizzle Kit等）不要でシンプル
- 毎回実行しても安全（冪等性）
- Git履歴でスキーマ変更を追跡可能

### Alternatives Considered
- Drizzle Kit migrations → 追加の依存関係、学習コスト
- 手動マイグレーション → ユーザー要件で明確に禁止

## 3. pnpmバージョン管理

### Decision
`pnpm/action-setup@v4` でpackage.jsonの`packageManager`フィールドを自動検出

### Rationale
- package.jsonに`"packageManager": "pnpm@9.15.1"`が設定済み
- action-setupがこれを読み取り適切なバージョンを使用
- 明示的なバージョン指定不要でメンテナンス負荷を削減

### Alternatives Considered
- バージョン明示指定 → package.jsonと二重管理になる

## 4. PR Preview環境の構成

### Decision
- Worker名: `oekaki-map-pr-{PR番号}`
- D1: 本番DBを共有（データ分離不要、個人プロジェクト）
- R2: 本番バケットを共有

### Rationale
- 個人プロジェクトのため環境分離の優先度は低い
- lifestyle-appではpreview用DBを別途用意しているが、oekaki-mapではシンプルに保つ
- PRプレビューは一時的な動作確認用途

### Alternatives Considered
- preview用D1/R2を別途作成 → 管理コスト増、現時点では不要

## 5. GitHub Secrets構成

### Decision
以下のSecretsを設定:
- `CLOUDFLARE_API_TOKEN` - Wrangler認証用
- `CLOUDFLARE_ACCOUNT_ID` - アカウント識別

### Rationale
- Cloudflare Workersデプロイに必須
- lifestyle-appと同じ構成

### Alternatives Considered
- CLOUDFLARE_ACCOUNT_IDを環境変数で管理 → セキュリティ上Secretsが適切

## 6. タグベースリリース

### Decision
`v*`パターンのタグpushで本番デプロイをトリガー

### Rationale
- 明示的なリリース管理
- mainへのpushとは別に、意図的なリリースポイントを設定可能
- Git履歴でリリースバージョンを追跡可能

### Alternatives Considered
- mainへのpushのみ → バージョン管理が曖昧になる

## 7. wrangler.toml環境設定

### Decision
既存のwrangler.tomlを維持、preview環境は動的にWorker名を指定

```bash
# PRプレビュー
wrangler deploy --name oekaki-map-pr-123

# 本番
wrangler deploy
```

### Rationale
- 既存設定を変更せずにCI/CDを追加
- --nameオプションでWorker名を動的に変更可能

### Alternatives Considered
- env.previewセクション追加 → PR番号ごとの動的名前付けには不向き

