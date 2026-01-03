# Quickstart: CI/CD自動デプロイ設定

## 前提条件

1. GitHubリポジトリが作成済み
2. Cloudflare アカウントがあり、以下が設定済み:
   - D1データベース: `oekaki-map-db`
   - R2バケット: `oekaki-map-tiles`
   - Workers: `oekaki-map`

## セットアップ手順

### 1. GitHub Secretsの設定

リポジトリの Settings → Secrets and variables → Actions で以下を設定:

| Secret名 | 取得方法 |
|----------|----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Dashboard → My Profile → API Tokens → Create Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → Workers & Pages → Account ID (右側サイドバー) |

**API Tokenに必要な権限**:
- Account: Cloudflare Workers:Edit
- Zone: なし（Workersのみ使用）

### 2. ワークフローファイルの配置

`.github/workflows/ci.yml` を作成（実装で生成）

### 3. 動作確認

#### mainブランチへのpush
```bash
git checkout main
git push origin main
```
→ GitHub ActionsでCI実行、成功すればCloudflare Workersに自動デプロイ

#### PRの作成
```bash
git checkout -b feature/test-ci
echo "// test" >> frontend/src/App.tsx
git add . && git commit -m "test: CI動作確認"
git push origin feature/test-ci
gh pr create --title "Test CI"
```
→ CIが実行され、プレビューURLがPRコメントに投稿される

#### タグによるリリース
```bash
git tag v1.0.0
git push origin v1.0.0
```
→ 本番デプロイがトリガーされる

## ワークフロー概要

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │ lint-and-    │    │    test      │  ← 並列実行          │
│  │ typecheck    │    │   (vitest)   │                       │
│  └──────┬───────┘    └──────┬───────┘                       │
│         │                   │                                │
│         └─────────┬─────────┘                                │
│                   ▼                                          │
│           ┌──────────────┐                                   │
│           │    build     │                                   │
│           └──────┬───────┘                                   │
│                  │                                           │
│     ┌────────────┼────────────┐                              │
│     ▼            ▼            ▼                              │
│ ┌────────┐ ┌──────────┐ ┌──────────┐                        │
│ │ deploy │ │ deploy   │ │ cleanup  │                        │
│ │ prod   │ │ preview  │ │ preview  │                        │
│ └────────┘ └──────────┘ └──────────┘                        │
│ (main/tag)  (PR open)   (PR close)                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## トラブルシューティング

### CIが失敗する場合

1. **Secretsの確認**: CLOUDFLARE_API_TOKEN、CLOUDFLARE_ACCOUNT_IDが正しく設定されているか
2. **トークン権限**: API Tokenに `Workers:Edit` 権限があるか
3. **pnpm lockfile**: `pnpm-lock.yaml` がコミットされているか

### マイグレーションが失敗する場合

1. **SQL構文エラー**: schema.sqlの構文を確認
2. **D1接続**: database_idがwrangler.tomlと一致しているか

### PRプレビューが作成されない場合

1. **フォークからのPR**: セキュリティのためフォークからのPRはプレビュー作成をスキップ
2. **CIの失敗**: ビルドが成功していないとプレビューは作成されない

