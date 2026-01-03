# Tasks: CI/CD自動デプロイ設定

**Input**: Design documents from `/specs/001-ci-auto-deploy/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## User Story Mapping

| Story | Title | Priority | FR Coverage |
|-------|-------|----------|-------------|
| US1 | mainブランチへのプッシュで自動デプロイ | P1 | FR-001, FR-003-007, FR-012-014 |
| US2 | プルリクエストでのCI実行 | P1 | FR-002, FR-003-006a |
| US3 | PRプレビュー環境の自動デプロイ | P2 | FR-008, FR-009, FR-010 |
| US4 | タグプッシュによるバージョンリリース | P3 | FR-011 |
| US5 | 自動データベースマイグレーション | P1 | FR-012, FR-013, FR-014 (US1に統合) |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: GitHub Actions ワークフロー基盤の作成

- [x] T001 Create .github/workflows/ directory structure
- [x] T002 Create base ci.yml with workflow triggers (push, pull_request, tags) in .github/workflows/ci.yml

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ジョブで共有されるセットアップステップの定義

**⚠️ CRITICAL**: CI/CDジョブはこのフェーズの構成に依存

- [x] T003 Add pnpm setup step using pnpm/action-setup@v4 in .github/workflows/ci.yml
- [x] T004 Add Node.js setup step with pnpm cache in .github/workflows/ci.yml
- [x] T005 Add dependency installation step (pnpm install --frozen-lockfile) in .github/workflows/ci.yml

**Checkpoint**: Foundation ready - 全ジョブで再利用可能なセットアップ構成が完成

---

## Phase 3: User Story 1 & 5 - mainブランチ自動デプロイ + マイグレーション (Priority: P1) 🎯 MVP

**Goal**: mainブランチへのpushで自動的にビルド・検証・D1マイグレーション・デプロイを実行

**Independent Test**: mainブランチにpushして、GitHub Actionsが成功しCloudflare Workersが更新されることを確認

### Implementation for User Story 1 & 5

- [x] T006 [P] [US1] Create lint-and-typecheck job (ESLint + tsc --noEmit) in .github/workflows/ci.yml
- [x] T007 [P] [US1] Create test job (vitest) in .github/workflows/ci.yml
- [x] T008 [US1] Create build job with artifact upload (depends on lint-and-typecheck, test) in .github/workflows/ci.yml
- [x] T009 [US1] Create deploy-production job with conditions (github.ref == 'refs/heads/main') in .github/workflows/ci.yml
- [x] T010 [US1] Add D1 migration step before deploy (wrangler d1 execute --remote --file) in deploy-production job
- [x] T011 [US1] Add frontend artifact download step in deploy-production job
- [x] T012 [US1] Add wrangler deploy step with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets in deploy-production job

**Checkpoint**: mainブランチへのpushで自動デプロイ＋マイグレーションが動作

---

## Phase 4: User Story 2 - PRでのCI実行 (Priority: P1)

**Goal**: プルリクエスト作成時に自動的にビルド・検証を実行

**Independent Test**: PRを作成して、GitHub ActionsでCI（lint, type-check, test, build）が実行されることを確認

### Implementation for User Story 2

- [x] T013 [US2] Add pull_request trigger conditions (opened, synchronize) in .github/workflows/ci.yml
- [x] T014 [US2] Verify lint-and-typecheck job runs on PR (no additional changes needed, uses existing job)
- [x] T015 [US2] Verify test job runs on PR (no additional changes needed, uses existing job)
- [x] T016 [US2] Verify build job runs on PR (no additional changes needed, uses existing job)

**Checkpoint**: PRに対してCIが自動実行される

---

## Phase 5: User Story 3 - PRプレビュー環境 (Priority: P2)

**Goal**: PRごとに独立したプレビュー環境を自動作成・削除

**Independent Test**: PRを作成して、プレビューURLがコメントで投稿され、PRクローズ時に削除されることを確認

### Implementation for User Story 3

- [x] T017 [P] [US3] Create deploy-pr-preview job with conditions (github.event.action != 'closed') in .github/workflows/ci.yml
- [x] T018 [P] [US3] Create cleanup-pr-preview job with conditions (github.event.action == 'closed') in .github/workflows/ci.yml
- [x] T019 [US3] Add dynamic Worker name (oekaki-map-pr-{PR番号}) in deploy-pr-preview job
- [x] T020 [US3] Add frontend artifact download in deploy-pr-preview job
- [x] T021 [US3] Add wrangler deploy with --name flag in deploy-pr-preview job
- [x] T022 [US3] Add gh pr comment step with preview URL in deploy-pr-preview job
- [x] T023 [US3] Add wrangler delete step in cleanup-pr-preview job
- [x] T024 [US3] Add gh pr comment step for cleanup notification in cleanup-pr-preview job
- [x] T025 [US3] Add permissions: pull-requests: write for PR comment jobs

**Checkpoint**: PRプレビュー環境の作成・削除が動作

---

## Phase 6: User Story 4 - タグベースリリース (Priority: P3)

**Goal**: vプレフィックス付きタグのpushで本番デプロイをトリガー

**Independent Test**: v1.0.0のようなタグをプッシュして、本番デプロイが実行されることを確認

### Implementation for User Story 4

- [x] T026 [US4] Add tag push trigger (tags: ['v*']) in .github/workflows/ci.yml
- [x] T027 [US4] Add condition for tag-based deploy (startsWith(github.ref, 'refs/tags/v')) in deploy-production job
- [x] T028 [US4] Verify deploy-production job triggers on tag push

**Checkpoint**: タグpushで本番デプロイが実行される

---

## Phase 7: Polish & Documentation

**Purpose**: ドキュメント更新と最終確認

- [x] T029 [P] Update quickstart.md with actual workflow verification steps
- [x] T030 [P] Verify GitHub Secrets documentation in quickstart.md
- [ ] T031 Run end-to-end validation: push to main, create PR, push tag
- [ ] T032 Verify SC-001: main push → deploy completes within 10 minutes
- [ ] T033 Verify SC-002: PR push → CI status updates within 5 minutes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion
- **US1+US5 (Phase 3)**: Depends on Foundational - MVP delivery point
- **US2 (Phase 4)**: Depends on Foundational - leverages same jobs as US1
- **US3 (Phase 5)**: Depends on Foundational and build job from US1
- **US4 (Phase 6)**: Depends on Foundational and deploy-production job from US1
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

- **US1+US5 (P1)**: Core CI/CD - independent, MVP
- **US2 (P1)**: Uses same jobs as US1, just different trigger
- **US3 (P2)**: Builds on US1's build job
- **US4 (P3)**: Builds on US1's deploy-production job

### Parallel Opportunities

Within Phase 3:
- T006 (lint-and-typecheck) と T007 (test) は並列実行可能

Within Phase 5:
- T017 (deploy-pr-preview job) と T018 (cleanup-pr-preview job) は並列作成可能

---

## Parallel Example: Phase 3 (User Story 1 & 5)

```bash
# Launch lint-and-typecheck and test jobs in parallel:
Task: "Create lint-and-typecheck job (ESLint + tsc --noEmit) in .github/workflows/ci.yml"
Task: "Create test job (vitest) in .github/workflows/ci.yml"
```

---

## Implementation Strategy

### MVP First (User Story 1 & 5 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: User Story 1 & 5 (T006-T012)
4. **STOP and VALIDATE**: mainブランチにpushしてデプロイ成功を確認
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → ci.yml基盤完成
2. US1+US5 → main push自動デプロイ → **MVP!**
3. US2 → PR CI実行 → 品質ゲート確立
4. US3 → PRプレビュー環境 → レビュー効率化
5. US4 → タグリリース → バージョン管理確立

---

## Notes

- すべてのタスクは単一ファイル(.github/workflows/ci.yml)への変更
- 各Phaseは論理的な機能単位で分離
- US5（マイグレーション）はUS1（本番デプロイ）に統合（デプロイ前にマイグレーション実行）
- GitHub Secretsの設定は手動で事前に必要（CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID）

