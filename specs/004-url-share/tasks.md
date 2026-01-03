# Tasks: URL共有ボタン・現在位置取得ボタン

**Input**: Design documents from `/specs/004-url-share/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Constitution要件 (TDD) に従い、テストを先に書いてから実装する。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: DBマイグレーションと型定義の準備

- [x] T001 Create migration file in backend/src/db/migrations/004-share-state.sql
- [x] T002 [P] Update schema.sql with share_* columns in backend/src/db/schema.sql
- [x] T003 [P] Add share state types to backend types in backend/src/types/index.ts
- [x] T004 [P] Add share state types to frontend types in frontend/src/types/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: バックエンドAPI拡張（全ユーザーストーリーの前提）

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Write test for updateCanvasSchema validation with share fields in backend/src/routes/canvas.test.ts
- [ ] T006 Extend updateCanvasSchema with shareLat, shareLng, shareZoom in backend/src/routes/canvas.ts
- [ ] T007 Update canvas service to handle share state in backend/src/services/canvas.ts
- [x] T008 Add updateShareState method to frontend API client in frontend/src/services/api.ts

**Checkpoint**: Foundation ready - API can save/retrieve share state

---

## Phase 3: User Story 1 - スマホからSNS共有 (Priority: P1) 🎯 MVP

**Goal**: スマホで共有ボタンをタップするとWeb Share APIで共有シートが開き、現在の座標がDBに保存される

**Independent Test**: スマホで地図を開き、共有ボタンをタップして、ネイティブ共有シートが開くことを確認

### Tests for User Story 1

- [x] T009 [P] [US1] Write test for useShare hook in frontend/src/hooks/useShare.test.ts
- [x] T010 [P] [US1] Write test for ShareButton component in frontend/src/components/ShareButton/ShareButton.test.tsx

### Implementation for User Story 1

- [x] T011 [P] [US1] Create useShare hook with Web Share API in frontend/src/hooks/useShare.ts
- [x] T012 [US1] Create ShareButton component in frontend/src/components/ShareButton/ShareButton.tsx
- [x] T013 [US1] Create ShareButton index export in frontend/src/components/ShareButton/index.ts
- [x] T014 [US1] Add ShareButton to Toolbar in frontend/src/components/Toolbar/Toolbar.tsx
- [x] T015 [US1] Connect ShareButton to App with canvas state in frontend/src/App.tsx

**Checkpoint**: User Story 1 complete - モバイルで共有ボタンが動作する

---

## Phase 4: User Story 2 - 共有URLで保存座標に移動 (Priority: P1)

**Goal**: 共有されたURLを開くと、DBに保存された座標とズームで地図が表示される

**Independent Test**: 共有済みURLをブラウザで開き、保存された座標で地図が表示されることを確認

### Tests for User Story 2

- [x] T016 [P] [US2] Write test for initial position logic with share state in frontend/src/App.test.tsx

### Implementation for User Story 2

- [x] T017 [US2] Update App initial position logic to use share state in frontend/src/App.tsx

**Checkpoint**: User Story 2 complete - 共有URLで正しい座標が表示される

---

## Phase 5: User Story 3 - 現在位置に移動 (Priority: P1)

**Goal**: 現在位置ボタンをタップするとGeolocation APIで現在地を取得し、地図が移動する

**Independent Test**: スマホで現在位置ボタンをタップして、現在地に地図が移動することを確認

### Tests for User Story 3

- [x] T018 [P] [US3] Write test for useGeolocation hook in frontend/src/hooks/useGeolocation.test.ts

### Implementation for User Story 3

- [x] T019 [P] [US3] Create useGeolocation hook in frontend/src/hooks/useGeolocation.ts
- [x] T020 [US3] Add location button to Toolbar in frontend/src/components/Toolbar/Toolbar.tsx
- [x] T021 [US3] Connect location button to App with map control in frontend/src/App.tsx

**Checkpoint**: User Story 3 complete - 現在位置ボタンが動作する

---

## Phase 6: User Story 4 - デスクトップからURLコピー (Priority: P2)

**Goal**: PCでWeb Share API非対応時にクリップボードにコピーし、フィードバックを表示する

**Independent Test**: PCブラウザで共有ボタンをクリックして、URLがクリップボードにコピーされることを確認

### Tests for User Story 4

- [x] T022 [P] [US4] Write test for clipboard fallback in useShare in frontend/src/hooks/useShare.test.ts

### Implementation for User Story 4

- [x] T023 [US4] Implement clipboard fallback and toast feedback in useShare in frontend/src/hooks/useShare.ts
- [x] T024 [US4] Add toast notification component for feedback in frontend/src/components/Toast/Toast.tsx

**Checkpoint**: User Story 4 complete - デスクトップでコピー機能が動作する

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: エッジケース対応とクリーンアップ

- [x] T025 [P] Handle unsaved canvas case (disable share button) in frontend/src/components/ShareButton/ShareButton.tsx
- [x] T026 [P] Handle Geolocation API unsupported case in frontend/src/hooks/useGeolocation.ts
- [x] T027 [P] Add error handling for share state save failure in frontend/src/hooks/useShare.ts
- [x] T028 Run local DB migration and verify in backend/
- [x] T029 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 and US3 are independent (different features)
  - US2 extends US1's share functionality
  - US4 extends US1's share functionality
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - Core share functionality
- **User Story 2 (P1)**: Can start after Foundational - Uses share state from DB
- **User Story 3 (P1)**: Can start after Foundational - Independent feature (geolocation)
- **User Story 4 (P2)**: Can start after US1 - Extends US1 with clipboard fallback

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Hooks before components
- Components before integration into App
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003, T004 can run in parallel (different files)
- T009, T010 can run in parallel (different test files)
- T011 can run parallel with other stories after T008
- T018, T019 can run in parallel with US1 tasks (different feature)
- T022 can run in parallel with US3 (different feature)
- T025, T026, T027 can run in parallel (different files)

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all type definitions together:
Task: "Update schema.sql with share_* columns in backend/src/db/schema.sql"
Task: "Add share state types to backend types in backend/src/types/index.ts"
Task: "Add share state types to frontend types in frontend/src/types/index.ts"
```

## Parallel Example: User Story 1 + 3

```bash
# US1 and US3 can proceed in parallel after Foundational:
# Developer A - US1:
Task: "Write test for useShare hook in frontend/src/hooks/useShare.test.ts"
Task: "Create useShare hook with Web Share API in frontend/src/hooks/useShare.ts"

# Developer B - US3:
Task: "Write test for useGeolocation hook in frontend/src/hooks/useGeolocation.test.ts"
Task: "Create useGeolocation hook in frontend/src/hooks/useGeolocation.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 + 3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (共有ボタン)
4. Complete Phase 4: User Story 2 (共有URL表示)
5. Complete Phase 5: User Story 3 (現在位置)
6. **STOP and VALIDATE**: Test all P1 stories independently
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test → Mobile share works (MVP!)
3. Add User Story 2 → Test → Shared URLs show correct position
4. Add User Story 3 → Test → Location button works
5. Add User Story 4 → Test → Desktop fallback works
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Constitution Principle I)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
