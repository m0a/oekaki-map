# Oekaki Map

地図上に自由にお絵かきして共有できるWebアプリケーション。

## 技術スタック

- **フロントエンド**: React 18, TypeScript, Vite, Leaflet
- **バックエンド**: Hono (Cloudflare Workers)
- **データベース**: Cloudflare D1 (SQLite)
- **ストレージ**: Cloudflare R2 (タイル画像)

## 開発環境

### 前提条件

- Node.js 20+
- pnpm

### セットアップ

```bash
# 依存関係のインストール
pnpm install
cd frontend && pnpm install
cd ../backend && pnpm install

# ローカルDBのセットアップ
cd backend
pnpm exec wrangler d1 migrations apply DB --local

# 開発サーバー起動
pnpm dev
```

## データベースマイグレーション

Wrangler D1の公式マイグレーション機能を使用しています。

### マイグレーションファイル

マイグレーションファイルは `backend/migrations/` に配置します。

```
backend/migrations/
├── 0001_initial_schema.sql
├── 0002_add_layers.sql
└── 0003_add_share_state.sql
```

### 命名規則

```
NNNN_description.sql
```

- `NNNN`: 4桁の連番 (0001, 0002, ...)
- `description`: 変更内容を表す短い説明

### 新規マイグレーションの追加

1. `backend/migrations/` に新しいSQLファイルを作成
   ```bash
   # 例: 0004_add_user_table.sql
   touch backend/migrations/0004_add_user_table.sql
   ```

2. SQLを記述
   ```sql
   CREATE TABLE user (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL
   );
   ```

3. ローカルで適用してテスト
   ```bash
   cd backend
   pnpm exec wrangler d1 migrations apply DB --local
   ```

4. コミットしてプッシュ
   - mainマージ時: プレビュー環境に自動適用
   - タグプッシュ時: 本番環境に自動適用

### マイグレーション状態の確認

```bash
# ローカル
pnpm exec wrangler d1 migrations list DB --local

# プレビュー環境
pnpm exec wrangler d1 migrations list DB --remote --env preview

# 本番環境
pnpm exec wrangler d1 migrations list DB --remote
```

### CI/CD

| イベント | 対象環境 | マイグレーション |
|---------|---------|----------------|
| PR作成/更新 | PR Preview | - |
| mainマージ | Main Preview | 自動適用 |
| タグプッシュ (v*) | Production | 自動適用 |

## デプロイ

### プレビュー環境

mainブランチへのマージで自動デプロイ。

- URL: https://oekaki-map-main-preview.abe00makoto.workers.dev

### 本番環境

`v*` 形式のタグをプッシュで自動デプロイ。

```bash
git tag v0.0.4
git push origin v0.0.4
```

- URL: https://oekaki-map.abe00makoto.workers.dev

## ライセンス

Private
