# Tasks: Hono RPC Migration

**Input**: Design documents from `/home/m0a/oekaki-map/specs/009-hono-rpc-migration/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/rpc-api.md, research.md, quickstart.md

**Tests**: Not explicitly requested in specification - tests will be updated but not written first (no TDD requirement)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: RPC infrastructure setup and backend AppType export

- [x] T001 Verify Hono 4.6.0 is installed in both backend/package.json and frontend/package.json
- [x] T002 [P] Ensure backend/src/index.ts exports AppType (already present at line 144)
- [x] T003 [P] Verify backend/src/types/index.ts exports all domain types (Canvas, Layer, TileCoordinate, request/response types)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create RPC client infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create frontend/src/services/rpc.ts with hc client initialization importing AppType from backend/src/index
- [x] T005 Create callRpc helper function in frontend/src/services/rpc.ts for unified error handling
- [x] T006 Export RpcResult<T> type in frontend/src/services/rpc.ts for error wrapper pattern

**Checkpoint**: RPC client infrastructure ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Developer Experience: Type-Safe API Calls (Priority: P1) 🎯 MVP

**Goal**: すべてのJSON APIエンドポイントをHono RPCに移行し、型安全性を確保する。Canvas CRUD、Layers CRUD、OGP取得、Logsの各エンドポイントを型安全なRPCクライアント経由で動作させる。

**Independent Test**:
1. バックエンドのCanvas型にフィールドを追加
2. フロントエンドでビルド実行
3. 型エラーがコンパイル時に検出されることを確認

**Acceptance Criteria**:
- SC-002: バックエンドのAPI型変更時、フロントエンドのビルドで100%の型エラー検出率を達成する
- SC-003: すべての既存機能（描画、保存、共有、レイヤー管理）がHono RPC導入後も同じ動作を維持する
- SC-004: 開発者がバックエンドAPI定義を変更してから、フロントエンドで新しい型が利用可能になるまでの時間が1分以内になる

### Implementation for User Story 1

**Canvas API Migration (3 endpoints)**

- [x] T007 [P] [US1] Migrate GET /api/canvas/:id in frontend/src/hooks/useCanvas.ts to use client.api.canvas[':id'].$get()
- [x] T008 [P] [US1] Migrate POST /api/canvas in frontend/src/hooks/useCanvas.ts to use client.api.canvas.$post()
- [x] T009 [P] [US1] Migrate PATCH /api/canvas/:id in frontend/src/hooks/useCanvas.ts to use client.api.canvas[':id'].$patch()

**Layers API Migration (4 endpoints)**

- [x] T010 [P] [US1] Migrate GET /api/canvas/:canvasId/layers in frontend/src/hooks/useLayers.ts to use client.api.canvas[':canvasId'].layers.$get()
- [x] T011 [P] [US1] Migrate POST /api/canvas/:canvasId/layers in frontend/src/hooks/useLayers.ts to use client.api.canvas[':canvasId'].layers.$post()
- [x] T012 [P] [US1] Migrate PATCH /api/canvas/:canvasId/layers/:id in frontend/src/hooks/useLayers.ts to use client.api.canvas[':canvasId'].layers[':id'].$patch()
- [x] T013 [P] [US1] Migrate DELETE /api/canvas/:canvasId/layers/:id in frontend/src/hooks/useLayers.ts to use client.api.canvas[':canvasId'].layers[':id'].$delete()

**Tiles API Migration (1 endpoint - GET only, POST uses FormData)**

- [x] T014 [US1] Migrate GET /api/canvas/:id/tiles in MapWithDrawing.tsx to use client.api.canvas[':id'].tiles.$get() with query parameters

**OGP API Migration (1 endpoint - GET only, POST uses FormData)**

- [x] T015 [US1] Migrate GET /api/ogp/:canvasId - N/A (not currently used in frontend)

**Logs API Migration (2 endpoints)**

- [x] T016 [P] [US1] Migrate POST /api/logs/error in frontend/src/services/logger.ts to use client.api.logs.error.$post()
- [x] T017 [P] [US1] Migrate POST /api/logs/debug in frontend/src/services/logger.ts to use client.api.logs.debug.$post()

**Type Import Updates**

- [x] T018 [P] [US1] Update frontend/src/hooks/useCanvas.ts to import Canvas type from backend/src/types instead of frontend types
- [x] T019 [P] [US1] Update frontend/src/hooks/useLayers.ts to import Layer type from backend/src/types instead of frontend types
- [x] T020 [P] [US1] Update frontend/src/hooks/useShare.ts to import OGP types from backend/src/types - N/A (not using OGP types)

**FormData Endpoints (Keep manual fetch - clarification decision)**

- [x] T021 [US1] Document in code comments why POST /api/canvas/:id/tiles keeps manual fetch (FormData limitation in Hono RPC 4.6.0)
- [x] T022 [US1] Document in code comments why POST /api/ogp/:canvasId keeps manual fetch (FormData limitation in Hono RPC 4.6.0)

**Cleanup**

- [x] T023 [US1] Remove duplicated type definitions from frontend/src/types/index.ts (Canvas, Layer, TileCoordinate)
- [N/A] T024 [US1] Delete frontend/src/services/api.ts (still needed for FormData endpoints - tiles, OGP)
- [x] T025 [US1] Update all import statements in hooks to use frontend/src/services/rpc.ts instead of api.ts

**Validation**

- [x] T026 [US1] Run frontend TypeScript build (pnpm type-check) and verify no type errors ✅ PASS
- [x] T027 [US1] Run frontend tests (cd frontend && pnpm test) and verify all pass ✅ 171/171 TESTS PASS
- [x] T028 [US1] Run backend tests (cd backend && pnpm test) and verify all pass ✅ 24/24 TESTS PASS
- [ ] T029 [US1] Start dev servers (pnpm dev) and manually test all features: canvas create, draw, save, layers, share

**Checkpoint**: At this point, User Story 1 should be fully functional - all JSON APIs migrated to RPC, type safety verified, existing features working

---

## Phase 4: User Story 2 - Code Reduction: Eliminate Boilerplate (Priority: P2)

**Goal**: 既存の`frontend/src/services/api.ts`約200行のボイラープレートを削減し、30%以上のコード削減を達成する。

**Independent Test**:
1. 移行前の`git show HEAD~1:frontend/src/services/api.ts | wc -l`でLOC記録
2. RPC移行後のfrontend/src/services/rpc.ts + hooks内のRPC呼び出しコードをカウント
3. 削減率を計算 (before - after) / before >= 0.30

**Acceptance Criteria**:
- SC-001: API呼び出しのコード行数が既存実装と比較して30%以上削減される

### Implementation for User Story 2

**Code Metrics Collection**

- [ ] T030 [US2] Count lines in deleted frontend/src/services/api.ts and record baseline (should be ~200 LOC)
- [ ] T031 [US2] Count lines in new frontend/src/services/rpc.ts (should be ~70 LOC based on quickstart.md example)
- [ ] T032 [US2] Count RPC call sites in all hooks (useCanvas.ts, useLayers.ts, useShare.ts, logger.ts)
- [ ] T033 [US2] Calculate total LOC reduction and verify >= 30% threshold met

**Documentation**

- [ ] T034 [US2] Update CLAUDE.md with RPC migration notes under "Type Sharing" section
- [ ] T035 [US2] Document code reduction metrics in migration commit message

**Checkpoint**: Code reduction metrics validated, documentation updated

---

## Phase 5: User Story 3 - Maintenance: Automatic API Contract Sync (Priority: P3)

**Goal**: バックエンドAPI変更時の型同期を自動化し、フロントエンドビルドで不整合を検出できることを検証する。

**Independent Test**:
1. バックエンドのCanvas型に`testField: string`を追加
2. フロントエンドでビルド (pnpm type-check)
3. 新しいフィールドが自動的にアクセス可能で、IDEで補完されることを確認
4. testFieldを削除してビルドし、使用箇所でエラーが出ることを確認

**Acceptance Criteria**:
- SC-002: バックエンドのAPI型変更時、フロントエンドのビルドで100%の型エラー検出率を達成する (US1と共通)
- SC-004: 開発者がバックエンドAPI定義を変更してから、フロントエンドで新しい型が利用可能になるまでの時間が1分以内になる (US1と共通)

### Implementation for User Story 3

**Type Sync Validation**

- [ ] T036 [US3] Test type sync by adding temporary field to backend Canvas type, verify frontend sees it immediately
- [ ] T037 [US3] Test type error detection by removing field from backend type, verify frontend build fails
- [ ] T038 [US3] Measure time from backend type change to frontend IDE refresh (target: <1 minute)

**CI/CD Integration**

- [ ] T039 [US3] Verify .github/workflows/deploy.yml runs frontend type-check before deployment
- [ ] T040 [US3] Verify .github/workflows/deploy.yml fails build if type mismatch detected

**Documentation**

- [ ] T041 [US3] Update quickstart.md Type Sync Verification section with actual timing measurements
- [ ] T042 [US3] Document type sync workflow in CLAUDE.md under Development Workflow section

**Checkpoint**: All user stories should now be independently functional, type sync validated

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Performance validation, documentation, and final cleanup

**Performance Validation (SC-005)**

- [ ] T043 [P] Measure API call response times before/after RPC migration using browser DevTools Network tab
- [ ] T044 [P] Compare RPC overhead vs manual fetch (target: <5ms per plan.md)
- [ ] T045 Verify no performance degradation on actual drawing operations (pen mode, tile save)

**Documentation**

- [ ] T046 [P] Update README.md with RPC migration notes if significant architectural change
- [ ] T047 [P] Add code comments in frontend/src/services/rpc.ts explaining callRpc pattern
- [ ] T048 [P] Add code comments explaining why FormData endpoints remain manual fetch

**Final Validation**

- [ ] T049 Run full test suite: cd frontend && pnpm test && cd ../backend && pnpm test
- [ ] T050 Run type-check: cd frontend && pnpm type-check
- [ ] T051 Deploy to preview environment and test all features end-to-end
- [ ] T052 Validate quickstart.md instructions against actual implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1): Core migration - MUST complete first (other stories depend on it)
  - User Story 2 (P2): Code metrics - depends on US1 completion
  - User Story 3 (P3): Type sync validation - depends on US1 completion
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 completion (needs migration done to measure reduction)
- **User Story 3 (P3)**: Depends on US1 completion (needs RPC setup to test type sync)

### Within Each User Story

**User Story 1 (Big Bang Migration)**:
- Canvas/Layers/Tiles/OGP/Logs API migrations can run in parallel (marked [P])
- Type import updates can run in parallel (marked [P])
- FormData documentation tasks sequential
- Cleanup tasks must run after all migrations
- Validation tasks must run at end

**User Story 2**:
- All code counting tasks can run in parallel
- Documentation after counting completes

**User Story 3**:
- Type sync tests sequential (must add, verify, remove)
- CI/CD checks can run in parallel with type tests
- Documentation at end

### Parallel Opportunities

**Phase 1 (Setup)**: All 3 tasks can run in parallel

**Phase 2 (Foundational)**: Tasks must run sequentially (T004 → T005 → T006) as each builds on previous

**Phase 3 (User Story 1)**:
- Canvas API (T007-T009): Can run in parallel
- Layers API (T010-T013): Can run in parallel
- Logs API (T016-T017): Can run in parallel
- Type imports (T018-T020): Can run in parallel
- Within cleanup phase: T023 can run in parallel with T024

**Phase 4 (User Story 2)**: Code counting tasks (T030-T032) can run in parallel

**Phase 6 (Polish)**: Performance tasks (T043-T044) and documentation tasks (T046-T048) can run in parallel

---

## Parallel Example: User Story 1 Core Migration

```bash
# Launch all Canvas API migrations in parallel:
Task T007: "Migrate GET /api/canvas/:id"
Task T008: "Migrate POST /api/canvas"
Task T009: "Migrate PATCH /api/canvas/:id"

# Launch all Layers API migrations in parallel:
Task T010: "Migrate GET layers"
Task T011: "Migrate POST layers"
Task T012: "Migrate PUT layers/:id"
Task T013: "Migrate DELETE layers/:id"

# Launch type import updates in parallel:
Task T018: "Update useCanvas.ts imports"
Task T019: "Update useLayers.ts imports"
Task T020: "Update useShare.ts imports"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify Hono versions, AppType export)
2. Complete Phase 2: Foundational (create RPC client infrastructure) - CRITICAL
3. Complete Phase 3: User Story 1 (migrate all JSON APIs)
4. **STOP and VALIDATE**:
   - Run all tests (T027-T028)
   - Manual testing (T029)
   - Verify type safety (T026)
5. Deploy to preview environment if ready

### Incremental Delivery

1. Complete Setup + Foundational → RPC infrastructure ready
2. Add User Story 1 → Test independently → Deploy preview (MVP!)
3. Add User Story 2 → Validate code reduction → Document metrics
4. Add User Story 3 → Validate type sync → Document workflow
5. Complete Polish phase → Final validation → Production release

### Sequential Strategy (Single Developer)

1. Phase 1 → Phase 2 → Phase 3 (US1)
2. Within US1: Parallelize where marked [P] using tools/scripts
3. US1 validation checkpoint
4. Phase 4 (US2) → validation
5. Phase 5 (US3) → validation
6. Phase 6 (Polish) → final deployment

---

## Notes

- **Migration Strategy**: Big Bang (clarification decision) - all JSON APIs migrate at once, FormData endpoints stay manual
- **FormData Handling**: POST /api/canvas/:id/tiles and POST /api/ogp/:canvasId keep manual fetch (Hono RPC 4.6.0 limitation)
- **Binary Endpoints**: GET /api/tiles/:canvasId/:z/:x/:y.webp keeps direct img tag reference (browser cache optimization)
- **Deployment**: Single deployment (frontend + backend together via Cloudflare Workers)
- **Testing**: Update existing tests to use RPC client mocks, not writing new tests first (no TDD requirement)
- **Type Safety**: Core value - validate at every checkpoint (T026, T036-T037)
- [P] tasks = different files, can execute in parallel
- [Story] label maps task to specific user story for traceability
- Commit after completing each phase checkpoint
- Stop at checkpoints to validate independently before proceeding

---

## Success Metrics Validation Checklist

After completing all tasks, verify:

- [ ] **SC-001**: Code LOC reduced by 30%+ (validate in Phase 4, T033)
- [ ] **SC-002**: Type error detection rate = 100% (validate in Phase 3 T026 and Phase 5 T037)
- [ ] **SC-003**: All existing features work (validate in Phase 3 T029)
- [ ] **SC-004**: Type sync time <1 minute (validate in Phase 5 T038)
- [ ] **SC-005**: No performance degradation (validate in Phase 6 T043-T045)
