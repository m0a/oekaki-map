# Tasks: OGP Share Preview

**Input**: Design documents from `/specs/006-ogp-share-preview/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Test-First Development（Constitution Principle I）に従い、テストを先に作成。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 依存パッケージの追加とDBマイグレーション

- [x] T001 Install leaflet-simple-map-screenshoter in frontend/package.json
- [x] T002 [P] Create database migration file in backend/migrations/006_add_ogp_columns.sql
- [x] T003 Run migration locally with `wrangler d1 execute oekaki-map-db --local --file=./migrations/006_add_ogp_columns.sql`
- [x] T004 [P] Define OGP TypeScript types in backend/src/types/index.ts
- [x] T005 [P] Define OGP TypeScript types in frontend/src/types/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーに必要な共通インフラ

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create OGP HTML template function in backend/src/templates/ogp-html.ts
- [x] T007 [P] Implement crawler detection utility (isCrawler) in backend/src/utils/crawler.ts
- [x] T008 [P] Implement Nominatim reverse geocoding service in frontend/src/utils/geocoding.ts
- [x] T009 Implement OGP metadata generation service in backend/src/services/ogp.ts
- [x] T010 Create OGP image storage service (R2 upload/get) in backend/src/services/ogp-storage.ts
- [x] T011 Create default OGP image asset in frontend/public/ogp-default.svg (1200x630)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 & 2 - LINE/X共有でプレビュー表示 (Priority: P1) 🎯 MVP

**Goal**: LINE・XでURLを共有した際にOGPプレビュー画像とメタタグが正しく表示される

**Independent Test**:
- curl -H "User-Agent: Line" http://localhost:8787/c/{canvasId} でOGPメタタグ確認
- curl -H "User-Agent: Twitterbot" http://localhost:8787/c/{canvasId} でTwitterカード確認

### Tests for User Story 1 & 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T012 [P] [US1] Test OGP HTML template generates correct meta tags in backend/tests/ogp-html.test.ts
- [x] T013 [P] [US1] Test crawler detection correctly identifies LINE/X/Facebook bots in backend/tests/crawler.test.ts
- [x] T014 [P] [US1] Test OGP metadata service generates correct title from place name in backend/tests/ogp.test.ts
- [x] T015 [P] [US1] Test preview image generator creates 1200x630 PNG in frontend/tests/previewGenerator.test.ts

### Implementation for User Story 1 & 2

- [x] T016 [P] [US1] Implement map screenshot capture with leaflet-simple-map-screenshoter in frontend/src/services/previewGenerator.ts
- [x] T017 [US1] Create OGP API routes (POST /api/ogp/:canvasId, GET /api/ogp/:canvasId) in backend/src/routes/ogp.ts
- [x] T018 [US1] Implement OGP image serving endpoint (GET /api/ogp/image/:canvasId.png) in backend/src/routes/ogp.ts
- [x] T019 [US1] Extend useShare hook to generate and upload preview image in frontend/src/hooks/useShare.ts
- [x] T020 [US1] Extend API client with OGP upload function in frontend/src/services/api.ts
- [x] T021 [US1] Modify /c/:id route to serve OGP HTML for crawlers in backend/src/index.ts
- [x] T022 [US1] Register OGP routes in main app in backend/src/index.ts

**Checkpoint**: At this point, sharing to LINE/X should show OGP preview

---

## Phase 4: User Story 3 - Facebook/その他SNS共有 (Priority: P2)

**Goal**: Facebook、Slack等のOGP対応サービスでも適切なプレビューが表示される

**Independent Test**: Facebook Sharing Debuggerでプレビュー確認

### Implementation for User Story 3

- [x] T023 [US3] Add Facebook-specific OGP tags (og:locale, og:site_name) to template in backend/src/templates/ogp-html.ts
- [x] T024 [US3] Add og:image:alt for accessibility in backend/src/templates/ogp-html.ts
- [ ] T025 [US3] Test with Facebook Sharing Debugger and document results

**Checkpoint**: All major SNS platforms should show proper previews

---

## Phase 5: User Story 4 - 共有前のプレビュー確認 (Priority: P3)

**Goal**: ユーザーが共有前にプレビュー画像を確認できる

**Independent Test**: 共有ダイアログでプレビュー画像サムネイルが表示される

### Implementation for User Story 4

- [ ] T026 [P] [US4] Test ShareButton shows preview thumbnail in frontend/tests/ShareButton.test.tsx
- [ ] T027 [US4] Extend ShareButton component to display preview thumbnail in frontend/src/components/ShareButton/ShareButton.tsx
- [ ] T028 [US4] Add loading state during preview generation in frontend/src/components/ShareButton/ShareButton.tsx
- [ ] T029 [US4] Style preview thumbnail for mobile display in frontend/src/components/ShareButton/ShareButton.tsx

**Checkpoint**: Users can preview their share image before sharing

---

## Phase 6: Top Page OGP & Edge Cases

**Goal**: トップページOGP対応とエッジケース処理

- [x] T030 Create static OGP meta tags for top page in backend/src/templates/ogp-html.ts
- [x] T031 Modify root route (/) to serve OGP HTML for crawlers in backend/src/index.ts
- [x] T032 [P] Handle empty canvas case with default image in frontend/src/services/previewGenerator.ts
- [x] T033 [P] Handle Nominatim failure with coordinate fallback in frontend/src/utils/geocoding.ts
- [x] T034 Handle preview generation failure with default image in frontend/src/hooks/useShare.ts

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 最終検証とドキュメント

- [ ] T035 Run all tests and verify pass
- [ ] T036 [P] Test with LINE Developers Page Cache Clear tool
- [ ] T037 [P] Test with X Card Validator
- [ ] T038 [P] Test with Facebook Sharing Debugger
- [ ] T039 Verify OGP HTML response time < 1 second
- [ ] T040 Run quickstart.md validation steps
- [ ] T041 Deploy to production and verify OGP with real SNS apps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories 1&2 (Phase 3)**: Depends on Foundational - P1 MVP
- **User Story 3 (Phase 4)**: Can start after Phase 3, adds Facebook/Slack support
- **User Story 4 (Phase 5)**: Can start after Phase 3, adds preview UI
- **Top Page & Edge Cases (Phase 6)**: Can start after Phase 3
- **Polish (Phase 7)**: Depends on all phases complete

### User Story Dependencies

- **User Story 1&2 (P1)**: Core OGP functionality - MVP requirement
- **User Story 3 (P2)**: Extends US1/US2 with additional meta tags
- **User Story 4 (P3)**: Extends UI, independent of US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Services before routes
- Backend before frontend integration
- Core implementation before UI enhancements

### Parallel Opportunities

- T002, T004, T005 can run in parallel (Setup)
- T007, T008, T010, T011 can run in parallel (Foundational)
- T012, T013, T014, T015 can run in parallel (Tests)
- T032, T033 can run in parallel (Edge cases)
- T036, T037, T038 can run in parallel (Validation)

---

## Parallel Example: Phase 3 Tests

```bash
# Launch all tests for User Story 1&2 together:
Task: "Test OGP HTML template generates correct meta tags in backend/tests/ogp-html.test.ts"
Task: "Test crawler detection correctly identifies LINE/X/Facebook bots in backend/tests/crawler.test.ts"
Task: "Test OGP metadata service generates correct title from place name in backend/tests/ogp.test.ts"
Task: "Test preview image generator creates 1200x630 PNG in frontend/tests/previewGenerator.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T011)
3. Complete Phase 3: User Story 1&2 (T012-T022)
4. **STOP and VALIDATE**: Test with LINE and X
5. Deploy if ready - MVP complete!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1&2 → Deploy (MVP: LINE/X preview)
3. Add User Story 3 → Deploy (Facebook/Slack support)
4. Add User Story 4 → Deploy (Preview UI)
5. Top Page + Edge Cases → Deploy (Complete feature)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- User Story 1 & 2 are combined as they share the same core implementation
- Verify tests fail before implementing (Constitution Principle I)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
