# Feature Specification: CI/CD自動デプロイ設定

**Feature Branch**: `001-ci-auto-deploy`
**Created**: 2026-01-03
**Status**: Draft
**Input**: User description: "CIの設定を入れて自動デプロイ機能を入れて下さい。既存のプロジェクト踏襲でhealthtrackerを参考にして欲しいです"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - mainブランチへのプッシュで自動デプロイ (Priority: P1)

開発者がmainブランチにコードをプッシュすると、自動的にビルド・検証が実行され、問題がなければ本番環境（Cloudflare Workers）に自動デプロイされる。

**Why this priority**: 手動デプロイの手間を削減し、継続的デリバリーを実現するための最も基本的な機能

**Independent Test**: mainブランチにpushして、Cloudflare Workers上のアプリケーションが更新されることを確認

**Acceptance Scenarios**:

1. **Given** mainブランチに変更がプッシュされた, **When** GitHub Actionsが実行される, **Then** ビルド、型チェック、Lintが自動実行される
2. **Given** すべてのチェックが成功した, **When** デプロイステップが実行される, **Then** Cloudflare Workersに新しいバージョンがデプロイされる
3. **Given** いずれかのチェックが失敗した, **When** ワークフローが終了する, **Then** デプロイは実行されず、失敗が通知される

---

### User Story 2 - プルリクエストでのCI実行 (Priority: P1)

開発者がプルリクエストを作成すると、自動的にビルド・検証が実行され、マージ前にコード品質を確認できる。

**Why this priority**: マージ前の品質保証はチーム開発において必須の機能

**Independent Test**: PRを作成して、GitHub ActionsでCIが実行されることを確認

**Acceptance Scenarios**:

1. **Given** プルリクエストが作成された, **When** GitHub Actionsがトリガーされる, **Then** Lint、型チェック、ビルドが自動実行される
2. **Given** CIが成功した, **When** PRのステータスが更新される, **Then** マージ可能な状態として表示される
3. **Given** CIが失敗した, **When** PRのステータスが更新される, **Then** 失敗理由がGitHub上で確認できる

---

### User Story 3 - PRプレビュー環境の自動デプロイ (Priority: P2)

プルリクエストごとに一時的なプレビュー環境が自動作成され、マージ前に変更内容を確認できる。

**Why this priority**: 変更内容を本番反映前に確認できることで、品質向上とレビュー効率化に貢献

**Independent Test**: PRを作成して、プレビューURLがコメントで投稿されることを確認

**Acceptance Scenarios**:

1. **Given** プルリクエストが作成された, **When** CIが成功した, **Then** PR専用のプレビュー環境がデプロイされる
2. **Given** プレビュー環境がデプロイされた, **When** デプロイが完了した, **Then** PRにプレビューURLがコメントで投稿される
3. **Given** プルリクエストがクローズされた, **When** クリーンアップジョブが実行される, **Then** プレビュー環境が削除される

---

### User Story 4 - タグプッシュによるバージョンリリース (Priority: P3)

バージョンタグ（v*）をプッシュすると、本番環境へのデプロイがトリガーされる。

**Why this priority**: 明示的なバージョン管理とリリースフローの確立

**Independent Test**: v1.0.0のようなタグをプッシュして、本番デプロイが実行されることを確認

**Acceptance Scenarios**:

1. **Given** vプレフィックス付きのタグがプッシュされた, **When** GitHub Actionsがトリガーされる, **Then** 本番環境へのデプロイが実行される

---

### User Story 5 - 自動データベースマイグレーション (Priority: P1)

mainブランチへのデプロイ時に、D1データベースのスキーマ変更が自動的に適用される。

**Why this priority**: 手動マイグレーションはヒューマンエラーのリスクがあり、デプロイと同期が取れなくなる可能性がある

**Independent Test**: schema.sqlを変更してmainにpushし、本番D1データベースにスキーマが反映されることを確認

**Acceptance Scenarios**:

1. **Given** schema.sqlに変更がある, **When** mainブランチへのデプロイが実行される, **Then** 本番D1データベースにマイグレーションが自動適用される
2. **Given** マイグレーションが成功した, **When** デプロイが完了した, **Then** アプリケーションは新しいスキーマで正常動作する
3. **Given** マイグレーションが失敗した, **When** エラーが発生した, **Then** デプロイは中断され、GitHub Actionsに失敗が通知される

---

### Edge Cases

- ビルドは成功したがデプロイが失敗した場合、どのような通知が行われるか？ → GitHub Actionsのジョブ失敗としてステータスに反映される
- 同時に複数のPRがプレビューデプロイをトリガーした場合は？ → 各PRは独立したWorker名でデプロイされるため競合しない
- シークレット（CLOUDFLARE_API_TOKENなど）が設定されていない場合は？ → デプロイステップが明確なエラーメッセージで失敗する
- マイグレーションがデータ損失を伴う破壊的変更の場合は？ → すべてのマイグレーションはCI経由で実行。PRレビュー時にスキーマ変更を確認する運用で対応（手動実行は禁止）
- マイグレーションに時間がかかりすぎる場合は？ → wranglerのタイムアウト設定に従う（デフォルト5分）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムはmainブランチへのpush時に自動的にCI/CDパイプラインを実行しなければならない
- **FR-002**: システムはプルリクエスト作成・更新時にCIパイプラインを実行しなければならない
- **FR-003**: CIパイプラインはフロントエンドのビルドを検証しなければならない
- **FR-004**: CIパイプラインはバックエンドのビルドを検証しなければならない
- **FR-005**: CIパイプラインはESLintによるコード品質チェックを実行しなければならない
- **FR-006**: CIパイプラインはTypeScriptの型チェックを実行しなければならない
- **FR-006a**: CIパイプラインはユニットテスト（vitest）を実行しなければならない
- **FR-007**: すべてのチェックが成功した場合、システムはCloudflare Workersへ自動デプロイしなければならない
- **FR-008**: PRごとに独立したプレビュー環境を作成しなければならない
- **FR-009**: PRがクローズされた場合、対応するプレビュー環境を自動削除しなければならない
- **FR-010**: プレビュー環境のURLはPRにコメントとして投稿されなければならない
- **FR-011**: vプレフィックス付きタグのプッシュで本番デプロイがトリガーされなければならない
- **FR-012**: mainブランチへのデプロイ時にD1データベースマイグレーションを自動実行しなければならない
- **FR-013**: マイグレーションはアプリケーションデプロイの前に実行されなければならない
- **FR-014**: マイグレーション失敗時はデプロイを中断しなければならない

### Key Entities

- **GitHub Actions Workflow**: CI/CDパイプラインを定義するYAMLファイル。トリガー条件、ジョブ、ステップを含む
- **Cloudflare Worker**: デプロイ先の実行環境。本番環境とPRプレビュー環境がある
- **GitHub Secrets**: API トークンなどの機密情報を安全に管理するストレージ
- **D1 Database Migration**: Cloudflare D1データベースのスキーマ変更を適用するSQLファイル（backend/src/db/schema.sql）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: mainブランチへのpushから本番デプロイ完了まで10分以内で完了する
- **SC-002**: PRへのpushからCIステータス更新まで5分以内で完了する
- **SC-003**: PRプレビュー環境はPR作成から10分以内に利用可能になる
- **SC-004**: 100%のmainブランチへのpushに対してCI/CDが自動実行される
- **SC-005**: PRクローズ後24時間以内にプレビュー環境が自動削除される
- **SC-006**: マイグレーションはデプロイの一部として5分以内に完了する

## Assumptions

- GitHub Actionsが利用可能である
- Cloudflare APIトークンがGitHub Secretsに設定される
- oekaki-mapプロジェクトはpnpmを使用している（package.jsonのpackageManager設定による）
- フロントエンドとバックエンドは同一リポジトリ内に存在する（モノレポ）
- D1データベースのスキーマはbackend/src/db/schema.sqlで管理される（冪等なCREATE IF NOT EXISTS形式）
- すべてのマイグレーションはCI経由で実行する（手動実行禁止、Git履歴に記録を残すため）
- 破壊的なスキーマ変更（DROP等）はPRレビュー時に確認する運用で対応
