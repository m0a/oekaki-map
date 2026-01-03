# Tasks: レイヤー構造機能

**Input**: Design documents from `/specs/003-layer-structure/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD approach required per Constitution Principle I (Test-First Development)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency installation, and database schema

- [x] T001 Add @dnd-kit dependencies in frontend/package.json
- [x] T002 [P] Add Layer type definitions in backend/src/types/index.ts
- [x] T003 [P] Add Layer type definitions in frontend/src/types/index.ts
- [x] T004 [P] Extend StrokeData with layerId field in frontend/src/types/index.ts
- [x] T005 Create database migration file backend/src/db/migrations/002_add_layers.sql
- [x] T006 Run database migration for layer table and drawing_tile.layer_id column

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Write tests for layer service CRUD operations in tests/integration/api/layers.test.ts
- [x] T008 Implement layer service with CRUD logic in backend/src/services/layers.ts
- [x] T009 Write tests for layers API routes in tests/integration/api/layers.test.ts
- [x] T010 Implement layers API routes (GET, POST, PATCH, DELETE) in backend/src/routes/layers.ts
- [x] T011 Register layers routes in backend/src/index.ts
- [x] T012 Extend tiles API to support layerId parameter in backend/src/routes/tiles.ts
- [x] T013 Write tests for useLayers hook in frontend/src/hooks/useLayers.test.ts
- [x] T014 Implement useLayers hook for state management in frontend/src/hooks/useLayers.ts
- [x] T015 Update useUndoRedo hook to include layerId in StrokeData in frontend/src/hooks/useUndoRedo.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 新しいレイヤーを作成する (Priority: P1) 🎯 MVP

**Goal**: ユーザーは複数のレイヤーを作成し、それぞれのレイヤーに独立して描画できる

**Independent Test**: 新しいレイヤーを作成し、そのレイヤーに描画できることを確認する

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T016 [P] [US1] Write LayerPanel component tests in frontend/src/components/LayerPanel/LayerPanel.test.tsx
- [x] T017 [P] [US1] Write LayerItem component tests in frontend/src/components/LayerPanel/LayerItem.test.tsx

### Implementation for User Story 1

- [x] T018 [P] [US1] Create LayerItem component in frontend/src/components/LayerPanel/LayerItem.tsx
- [x] T019 [US1] Create LayerPanel component with layer list in frontend/src/components/LayerPanel/LayerPanel.tsx
- [x] T020 [US1] Add LayerPanel index export in frontend/src/components/LayerPanel/index.ts
- [x] T021 [US1] Add layer panel toggle button to Toolbar in frontend/src/components/Toolbar/Toolbar.tsx
- [x] T022 [US1] Integrate useLayers hook in App.tsx with canvas loading in frontend/src/App.tsx
- [x] T023 [US1] Update MapWithDrawing to use activeLayerId for drawing in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T024 [US1] Update tile saving to include layerId in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T025 [US1] Implement default layer creation when canvas has no layers in frontend/src/hooks/useLayers.ts
- [x] T026 [US1] Add "new layer" button functionality in LayerPanel in frontend/src/components/LayerPanel/LayerPanel.tsx
- [x] T027 [US1] Implement max layer limit (10) with disabled button state in frontend/src/components/LayerPanel/LayerPanel.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - レイヤーの表示/非表示を切り替える (Priority: P2)

**Goal**: ユーザーは各レイヤーの表示/非表示を切り替えて、特定のレイヤーだけを表示できる

**Independent Test**: レイヤーの表示/非表示を切り替えて、画面上の描画内容が変わることを確認する

### Tests for User Story 2

- [x] T028 [P] [US2] Add visibility toggle tests in frontend/src/components/LayerPanel/LayerItem.test.tsx

### Implementation for User Story 2

- [x] T029 [US2] Add visibility toggle icon button to LayerItem in frontend/src/components/LayerPanel/LayerItem.tsx
- [x] T030 [US2] Implement toggleLayerVisibility in useLayers hook in frontend/src/hooks/useLayers.ts
- [x] T031 [US2] Update MapWithDrawing redrawStrokes to filter by visible layers in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T032 [US2] Update tile loading to filter by visible layers in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T033 [US2] Persist visibility state to server via PATCH API in frontend/src/hooks/useLayers.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - レイヤーの順序を変更する (Priority: P3)

**Goal**: ユーザーはレイヤーの重ね順を変更して、描画の前後関係を制御できる

**Independent Test**: レイヤーの順序を入れ替えて、表示の前後関係が変わることを確認する

### Tests for User Story 3

- [x] T034 [P] [US3] Add drag-and-drop reorder tests in frontend/src/components/LayerPanel/LayerPanel.test.tsx

### Implementation for User Story 3

- [x] T035 [US3] Set up DndContext and SortableContext in LayerPanel in frontend/src/components/LayerPanel/LayerPanel.tsx
- [x] T036 [US3] Make LayerItem sortable with useSortable hook in frontend/src/components/LayerPanel/LayerItem.tsx
- [x] T037 [US3] Implement reorderLayers in useLayers hook in frontend/src/hooks/useLayers.ts
- [x] T038 [US3] Update redrawStrokes to respect layer order in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T039 [US3] Persist order changes to server via PATCH API in frontend/src/hooks/useLayers.ts

**Checkpoint**: User Stories 1, 2, AND 3 should now all work independently

---

## Phase 6: User Story 4 - レイヤーを削除する (Priority: P4)

**Goal**: ユーザーは不要なレイヤーを削除して、キャンバスを整理できる

**Independent Test**: レイヤーを削除して、そのレイヤーの内容がキャンバスから消えることを確認する

### Tests for User Story 4

- [x] T040 [P] [US4] Add delete button and confirmation tests in frontend/src/components/LayerPanel/LayerItem.test.tsx

### Implementation for User Story 4

- [x] T041 [US4] Add delete button to LayerItem in frontend/src/components/LayerPanel/LayerItem.tsx
- [x] T042 [US4] Implement confirmation dialog for layer deletion in frontend/src/components/LayerPanel/LayerItem.tsx
- [x] T043 [US4] Implement deleteLayer in useLayers hook in frontend/src/hooks/useLayers.ts
- [x] T044 [US4] Prevent deletion when only one layer exists in frontend/src/hooks/useLayers.ts
- [x] T045 [US4] Auto-select next layer after deletion in frontend/src/hooks/useLayers.ts
- [x] T046 [US4] Remove deleted layer strokes from undo/redo history in frontend/src/hooks/useUndoRedo.ts

**Checkpoint**: User Stories 1-4 should now all work independently

---

## Phase 7: User Story 5 - レイヤーに名前を付ける (Priority: P5)

**Goal**: ユーザーはレイヤーに名前を付けて、複数のレイヤーを識別しやすくする

**Independent Test**: レイヤー名を変更して、リストに反映されることを確認する

### Tests for User Story 5

- [x] T047 [P] [US5] Add name editing tests in frontend/src/components/LayerPanel/LayerItem.test.tsx

### Implementation for User Story 5

- [x] T048 [US5] Make layer name editable on click in LayerItem in frontend/src/components/LayerPanel/LayerItem.tsx
- [x] T049 [US5] Implement inline name editing with input field in frontend/src/components/LayerPanel/LayerItem.tsx
- [x] T050 [US5] Implement renameLayer in useLayers hook in frontend/src/hooks/useLayers.ts
- [x] T051 [US5] Generate default layer names ("レイヤー N") in useLayers hook in frontend/src/hooks/useLayers.ts
- [x] T052 [US5] Persist name changes to server via PATCH API in frontend/src/hooks/useLayers.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T053 [P] Add CSS styles for LayerPanel (mobile-first, responsive) in frontend/src/components/LayerPanel/LayerPanel.css
- [x] T054 [P] Add visual indicator for active layer selection in frontend/src/components/LayerPanel/LayerItem.tsx
- [x] T055 Handle backward compatibility: layer_id=NULL tiles as default layer in frontend/src/hooks/useLayers.ts
- [x] T056 Verify all tests pass and fix any failures
- [ ] T057 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in priority order (P1 → P2 → P3 → P4 → P5)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Depends on US1 for LayerPanel structure
- **User Story 3 (P3)**: Can start after Foundational - Depends on US1 for LayerPanel structure
- **User Story 4 (P4)**: Can start after Foundational - Depends on US1 for LayerPanel structure
- **User Story 5 (P5)**: Can start after Foundational - Depends on US1 for LayerItem structure

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Hook logic before UI components
- UI components before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003, T004 can run in parallel (different type files)
- T016, T017 can run in parallel (different test files)
- T018 can run in parallel with tests
- Tests for each user story marked [P] can run in parallel

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all type definitions together:
Task: "Add Layer type definitions in backend/src/types/index.ts"
Task: "Add Layer type definitions in frontend/src/types/index.ts"
Task: "Extend StrokeData with layerId field in frontend/src/types/index.ts"
```

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together:
Task: "Write LayerPanel component tests in frontend/src/components/LayerPanel/LayerPanel.test.tsx"
Task: "Write LayerItem component tests in frontend/src/components/LayerPanel/LayerItem.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready - users can create layers and draw on them

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (visibility toggle)
4. Add User Story 3 → Test independently → Deploy/Demo (reorder)
5. Add User Story 4 → Test independently → Deploy/Demo (delete)
6. Add User Story 5 → Test independently → Deploy/Demo (rename)
7. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD per Constitution)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Max 10 layers enforced (FR-009)
- layer_id=NULL in database means "default layer" for backward compatibility
