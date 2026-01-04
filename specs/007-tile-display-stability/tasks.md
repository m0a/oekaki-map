# Tasks: タイル表示安定性の修正

**Input**: Design documents from `/specs/007-tile-display-stability/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Unit tests for TileCache are included as they are explicitly defined in quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup

**Purpose**: Project structure and type definitions

- [x] T001 Create feature branch `007-tile-display-stability` from main
- [x] T002 [P] Add TileCoordinateWithVersion type to `backend/src/types/index.ts`
- [x] T003 [P] Add TileInfo type with updatedAt field to `frontend/src/types/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create TileCache class in `frontend/src/utils/tileCache.ts`
- [x] T005 Create TileCache unit tests in `frontend/src/utils/tileCache.test.ts`
- [x] T006 Create useTileCache hook in `frontend/src/hooks/useTileCache.ts`

**Checkpoint**: Foundation ready - TileCache and useTileCache hook available

---

## Phase 3: User Story 1 - 安定したタイル表示 (Priority: P1) 🎯 MVP

**Goal**: キャンバスを開いた時、リロードしても、地図を移動しても、描いた絵が消えることなく常に表示される

**Independent Test**: キャンバスを開いて10回リロードし、毎回タイルが正しく表示されることを確認

### Implementation for User Story 1

- [x] T007 [US1] Create redrawAll function integrating tile and stroke rendering in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`
- [x] T008 [US1] Modify tile loading useEffect to use TileCache in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`
- [x] T009 [US1] Modify stroke redraw useEffect to use redrawAll in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`
- [x] T010 [US1] Ensure canvas clearing always redraws tiles before strokes in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`

**Checkpoint**: User Story 1 complete - tiles display stably on page load and reload

---

## Phase 4: User Story 2 - Undo/Redo時の表示安定性 (Priority: P2)

**Goal**: Undo/Redo実行時、保存済みタイルが消えることなくストローク履歴のみが変更される

**Independent Test**: タイルが表示された状態でUndo/Redoを10回繰り返し、タイルが消えないことを確認

### Implementation for User Story 2

- [x] T011 [US2] Ensure redrawAll is called after Undo operation in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`
- [x] T012 [US2] Ensure redrawAll is called after Redo operation in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`
- [x] T013 [US2] Verify strokes useEffect dependency array includes redrawAll in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`

**Checkpoint**: User Story 2 complete - Undo/Redo preserves tile display

---

## Phase 5: User Story 3 - 描画モード切替時の表示安定性 (Priority: P3)

**Goal**: ナビゲートモードと描画モードを切り替えた際、タイルが消えない

**Independent Test**: モードを10回切り替え、毎回タイルが維持されることを確認

### Implementation for User Story 3

- [x] T014 [US3] Ensure mode switch triggers redrawAll in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`
- [x] T015 [US3] Verify tile cache persists across mode changes in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`

**Checkpoint**: User Story 3 complete - mode switching preserves tile display

---

## Phase 6: User Story 4 - HTTPキャッシュによるコスト削減 (Priority: P2)

**Goal**: タイル画像がブラウザ/CDNにキャッシュされ、R2リクエストを削減する

**Independent Test**: DevTools Networkタブで地図を移動→戻る、タイルリクエストが「disk cache」になることを確認

### Implementation for User Story 4

- [x] T016 [P] [US4] Modify getTilesInArea to include updated_at in `backend/src/services/tiles.ts`
- [x] T017 [P] [US4] Update TileCoordinate return type to include updatedAt in `backend/src/services/tiles.ts`
- [x] T018 [US4] Change Cache-Control header to max-age=31536000 in `backend/src/routes/tiles.ts`
- [x] T019 [P] [US4] Update getImageUrl to accept updatedAt parameter in `frontend/src/services/api.ts`
- [x] T020 [US4] Update useTileCache to pass updatedAt to getImageUrl in `frontend/src/hooks/useTileCache.ts`
- [x] T021 [US4] Update MapWithDrawing to pass updatedAt when loading tiles in `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`

**Checkpoint**: User Story 4 complete - HTTP caching reduces R2 requests

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T022 Run all unit tests and verify pass in `frontend/`
- [x] T023 Run type check (pnpm tsc --noEmit) in both `frontend/` and `backend/`
- [ ] T024 Manual test: 10 page reloads with stable tile display
- [ ] T025 Manual test: 10 Undo/Redo cycles without tile loss
- [ ] T026 Manual test: 20 mode switches without tile loss
- [ ] T027 Manual test: Verify network tab shows cache hits for tile requests
- [ ] T028 Manual test: Draw and save, verify new tiles have updated ?v= parameter

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (display stability) should complete first as foundation for US2, US3
  - US4 (HTTP cache) can run in parallel with US1-3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core implementation
- **User Story 2 (P2)**: Depends on US1 redrawAll function
- **User Story 3 (P3)**: Depends on US1 redrawAll function
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent backend/frontend changes

### Within Each User Story

- Backend changes before frontend changes that depend on them
- Core implementation before integration

### Parallel Opportunities

- T002, T003: Type definitions can run in parallel
- T016, T017, T019: Backend and frontend API changes can run in parallel
- User Story 4 can run in parallel with User Stories 1-3

---

## Parallel Example: Foundational Phase

```bash
# After T004 (TileCache class):
Task: "Create TileCache unit tests in frontend/src/utils/tileCache.test.ts"
Task: "Create useTileCache hook in frontend/src/hooks/useTileCache.ts"
```

## Parallel Example: User Story 4

```bash
# Backend and Frontend can work in parallel:
Backend: "Modify getTilesInArea to include updated_at in backend/src/services/tiles.ts"
Frontend: "Update getImageUrl to accept updatedAt parameter in frontend/src/services/api.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T006)
3. Complete Phase 3: User Story 1 (T007-T010)
4. **STOP and VALIDATE**: Test tile stability with 10 reloads
5. Deploy if stable

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Tile display stable (MVP!)
3. Add User Story 2 → Test Undo/Redo → Stable
4. Add User Story 3 → Test mode switch → Stable
5. Add User Story 4 → Test cache hits → Cost optimized
6. Each story adds stability/performance without breaking previous stories

### Recommended Order

1. **Phase 1-2**: Setup + Foundational (T001-T006)
2. **Phase 3**: US1 Display Stability (T007-T010) - MVP
3. **Phase 4-5**: US2 + US3 in sequence (T011-T015)
4. **Phase 6**: US4 HTTP Cache (T016-T021) - Can overlap with 3-5
5. **Phase 7**: Polish (T022-T028)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- User Story 4 (HTTP Cache) is independent and can be done in parallel
