# Tasks: 地図お絵かき共有サービス

**Input**: Design documents from `/specs/001-map-drawing-share/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/api.yaml

**Tests**: Required per Constitution Principle I (Test-First Development - NON-NEGOTIABLE)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [x] T001 Create monorepo structure with frontend/ and backend/ directories
- [x] T002 [P] Initialize frontend with Vite + React + TypeScript in frontend/package.json
- [x] T003 [P] Initialize backend with Hono + TypeScript in backend/package.json
- [x] T004 [P] Configure TypeScript strict mode in frontend/tsconfig.json
- [x] T005 [P] Configure TypeScript strict mode in backend/tsconfig.json
- [x] T006 [P] Setup Vitest configuration in frontend/vite.config.ts
- [x] T007 [P] Setup Vitest configuration for backend in backend/vitest.config.ts
- [x] T008 [P] Configure Playwright for E2E tests in playwright.config.ts
- [x] T009 Create wrangler.toml with D1 and R2 bindings in backend/wrangler.toml
- [x] T010 [P] Setup ESLint and Prettier configuration in root .eslintrc.js
- [x] T011 Create root package.json with workspace scripts

**Checkpoint**: Project skeleton ready, `pnpm install` succeeds, TypeScript compiles

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [x] T012 [P] Write unit test for Canvas type validation in tests/unit/backend/types.test.ts
- [x] T013 [P] Write unit test for TileCoordinate validation in tests/unit/backend/types.test.ts

### Implementation for Foundational

- [x] T014 Define shared TypeScript types (Canvas, DrawingTile, TileCoordinate) in backend/src/types/index.ts
- [x] T015 Create D1 schema SQL file in backend/src/db/schema.sql
- [x] T016 [P] Implement database migrations runner in backend/src/db/migrate.ts
- [x] T017 [P] Setup Hono app entry with CORS in backend/src/index.ts
- [x] T018 [P] Create R2 storage service in backend/src/services/storage.ts
- [x] T019 [P] Create API client with Hono RPC in frontend/src/services/api.ts
- [x] T020 [P] Export types from backend to frontend via package.json exports

**Checkpoint**: Foundation ready - `pnpm dev` starts both servers, D1/R2 bindings work locally

---

## Phase 3: User Story 1 - 地図上にお絵かきする (Priority: P1) 🎯 MVP

**Goal**: ユーザーが地図上に線を描き、自動保存されURLが生成される

**Independent Test**: サイトにアクセスして地図上に線を描き、リロード後も描画が残ることを確認

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T021 [P] [US1] Write contract test for POST /canvas in tests/integration/api/canvas.test.ts
- [ ] T022 [P] [US1] Write contract test for POST /canvas/{id}/tiles in tests/integration/api/tiles.test.ts
- [ ] T023 [P] [US1] Write unit test for CanvasService.create in tests/unit/backend/canvas.test.ts
- [ ] T024 [P] [US1] Write unit test for useDrawing hook in tests/unit/frontend/useDrawing.test.ts
- [ ] T025 [US1] Write E2E test for drawing flow in tests/e2e/drawing.spec.ts

### Implementation for User Story 1

- [x] T026 [P] [US1] Implement CanvasService with create/get methods in backend/src/services/canvas.ts
- [x] T027 [P] [US1] Implement TileService with save/get methods in backend/src/services/tiles.ts
- [x] T028 [US1] Create canvas routes (POST /canvas, GET /canvas/{id}) in backend/src/routes/canvas.ts
- [x] T029 [US1] Create tiles routes (POST /tiles, GET /tiles) in backend/src/routes/tiles.ts
- [x] T030 [US1] Register routes in Hono app in backend/src/index.ts
- [x] T031 [P] [US1] Create Map component with Leaflet + grayscale filter in frontend/src/components/Map/Map.tsx
- [x] T032 [P] [US1] Create DrawingCanvas overlay component in frontend/src/components/DrawingCanvas/DrawingCanvas.tsx
- [x] T033 [US1] Implement useDrawing hook for stroke capture in frontend/src/hooks/useDrawing.ts
- [x] T034 [US1] Implement useCanvas hook for canvas state in frontend/src/hooks/useCanvas.ts
- [x] T035 [P] [US1] Create Toolbar component with color/thickness selection in frontend/src/components/Toolbar/Toolbar.tsx
- [x] T036 [US1] Implement tile extraction from canvas in frontend/src/utils/tileUtils.ts
- [x] T037 [US1] Implement WebP conversion utility in frontend/src/utils/webpUtils.ts
- [x] T038 [US1] Implement debounced auto-save logic in frontend/src/hooks/useAutoSave.ts
- [x] T039 [US1] Integrate all components in App.tsx in frontend/src/App.tsx
- [x] T040 [US1] Add URL routing with canvas ID in frontend/src/main.tsx

**Checkpoint**: User Story 1 complete - can draw on map, drawings persist across reload

---

## Phase 4: User Story 2 - URLで共有する (Priority: P2)

**Goal**: 描いたお絵かきをURLで共有し、他の人が閲覧・追記できる

**Independent Test**: 描画後にURLをコピーし、別タブで開いて同じ描画が表示されることを確認

### Tests for User Story 2

- [ ] T041 [P] [US2] Write contract test for GET /canvas/{id} with tiles in tests/integration/api/canvas.test.ts
- [ ] T042 [P] [US2] Write unit test for ShareButton component in tests/unit/frontend/ShareButton.test.ts
- [ ] T043 [US2] Write E2E test for share flow in tests/e2e/share.spec.ts

### Implementation for User Story 2

- [ ] T044 [P] [US2] Create ShareButton component with clipboard copy in frontend/src/components/ShareButton/ShareButton.tsx
- [ ] T045 [US2] Implement canvas loading from URL parameter in frontend/src/hooks/useCanvas.ts
- [ ] T046 [US2] Implement tile lazy loading for visible area in frontend/src/hooks/useTileLoader.ts
- [ ] T047 [US2] Add share button to Toolbar in frontend/src/components/Toolbar/Toolbar.tsx
- [ ] T048 [US2] Add visual feedback for successful copy in frontend/src/components/ShareButton/ShareButton.tsx

**Checkpoint**: User Story 2 complete - URLs work for sharing, tiles load on demand

---

## Phase 5: User Story 3 - 描画を編集・消去する (Priority: P3)

**Goal**: 消しゴム、Undo、Redoで描画を編集できる

**Independent Test**: 描画後に消しゴムで消去し、Undoで復元できることを確認

### Tests for User Story 3

- [ ] T049 [P] [US3] Write unit test for undo/redo stack in tests/unit/frontend/useHistory.test.ts
- [ ] T050 [P] [US3] Write unit test for eraser tool in tests/unit/frontend/useDrawing.test.ts
- [ ] T051 [US3] Write E2E test for erase and undo flow in tests/e2e/edit.spec.ts

### Implementation for User Story 3

- [ ] T052 [US3] Implement useHistory hook for undo/redo in frontend/src/hooks/useHistory.ts
- [ ] T053 [US3] Add eraser mode to useDrawing hook in frontend/src/hooks/useDrawing.ts
- [ ] T054 [US3] Add eraser button to Toolbar in frontend/src/components/Toolbar/Toolbar.tsx
- [ ] T055 [US3] Add undo/redo buttons to Toolbar in frontend/src/components/Toolbar/Toolbar.tsx
- [ ] T056 [US3] Implement eraser rendering (composite destination-out) in frontend/src/components/DrawingCanvas/DrawingCanvas.tsx
- [ ] T057 [US3] Connect history to auto-save logic in frontend/src/hooks/useAutoSave.ts

**Checkpoint**: User Story 3 complete - can erase, undo, redo drawings

---

## Phase 6: User Story 4 - 地図を操作する (Priority: P4)

**Goal**: 地図のズーム・パンと描画モードの切り替え

**Independent Test**: 地図をピンチズームして移動し、モード切替で描画/ナビゲーションが切り替わることを確認

### Tests for User Story 4

- [ ] T058 [P] [US4] Write unit test for useMap hook in tests/unit/frontend/useMap.test.ts
- [ ] T059 [P] [US4] Write unit test for mode toggle in tests/unit/frontend/useDrawing.test.ts
- [ ] T060 [US4] Write E2E test for map navigation in tests/e2e/navigation.spec.ts

### Implementation for User Story 4

- [ ] T061 [US4] Implement useMap hook for map state in frontend/src/hooks/useMap.ts
- [ ] T062 [US4] Add mode toggle (draw/navigate) to useDrawing in frontend/src/hooks/useDrawing.ts
- [ ] T063 [US4] Add mode toggle button to Toolbar in frontend/src/components/Toolbar/Toolbar.tsx
- [ ] T064 [US4] Implement pointer-events switching based on mode in frontend/src/components/DrawingCanvas/DrawingCanvas.tsx
- [ ] T065 [US4] Add two-finger gesture passthrough for navigation in frontend/src/components/DrawingCanvas/DrawingCanvas.tsx
- [ ] T066 [US4] Update canvas metadata on map move in frontend/src/hooks/useCanvas.ts

**Checkpoint**: User Story 4 complete - map fully navigable, mode toggle works

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T067 [P] Add loading spinner component in frontend/src/components/Loading/Loading.tsx
- [ ] T068 [P] Add error boundary component in frontend/src/components/ErrorBoundary/ErrorBoundary.tsx
- [ ] T069 [P] Add save status indicator in frontend/src/components/SaveStatus/SaveStatus.tsx
- [ ] T070 Mobile responsive styles in frontend/src/styles/global.css
- [ ] T071 [P] Add meta tags for sharing (OGP) in frontend/index.html
- [ ] T072 Performance optimization: requestAnimationFrame for drawing in frontend/src/hooks/useDrawing.ts
- [ ] T073 [P] Add tile count limit enforcement in backend/src/services/tiles.ts
- [ ] T074 Run full test suite and fix any failures
- [ ] T075 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Builds on US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational - Uses drawing from US1 but independently testable
- **User Story 4 (P4)**: Can start after Foundational - Map exists in US1 but mode toggle is independent

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle I)
- Backend before frontend (API needed for frontend)
- Hooks before components (state management first)
- Components before integration
- Story complete before moving to next priority

### Parallel Opportunities

Within Setup:
- T002, T003 (frontend/backend init)
- T004, T005 (tsconfig)
- T006, T007, T008 (test configs)

Within Foundational:
- T012, T013 (tests)
- T016, T017, T18, T019, T020 (services)

Within US1:
- T021-T024 (tests)
- T026, T027 (backend services)
- T031, T032, T035 (components)

---

## Parallel Execution Examples

### Phase 1: Setup Parallelization

```bash
# Run in parallel - independent init tasks:
T002: "Initialize frontend with Vite"
T003: "Initialize backend with Hono"
T004: "Configure TypeScript frontend"
T005: "Configure TypeScript backend"
```

### Phase 3: User Story 1 Parallelization

```bash
# Run tests in parallel first:
T021: "Contract test POST /canvas"
T022: "Contract test POST /tiles"
T023: "Unit test CanvasService"
T024: "Unit test useDrawing"

# Then run backend services in parallel:
T026: "CanvasService"
T027: "TileService"

# Then run components in parallel:
T031: "Map component"
T032: "DrawingCanvas component"
T035: "Toolbar component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test drawing and persistence independently
5. Deploy/demo if ready - this is a functional MVP!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP!)
3. Add User Story 2 → Test sharing → Deploy
4. Add User Story 3 → Test editing → Deploy
5. Add User Story 4 → Test navigation → Deploy
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (priority)
   - Developer B: User Story 2 (after US1 backend is ready)
   - Developer C: User Story 3 + 4
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- **Tests MUST fail before implementing** (Constitution Principle I)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
