# Tasks: 描画のUndo/Redo機能

**Input**: Design documents from `/specs/002-undo-redo/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Constitutionで Test-First Development が要求されているため、テストタスクを含む。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/src/` (この機能はフロントエンドのみ)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 型定義とhookの基盤作成

- [x] T001 [P] Add StrokeData interface to frontend/src/types/index.ts
- [x] T002 [P] Create useUndoRedo hook skeleton in frontend/src/hooks/useUndoRedo.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: useUndoRedo hookの完全実装（全ユーザーストーリーで共通利用）

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Write unit tests for useUndoRedo hook in frontend/src/hooks/useUndoRedo.test.ts (push, undo, redo, canUndo, canRedo, max history limit)
- [x] T004 Implement useUndoRedo hook logic in frontend/src/hooks/useUndoRedo.ts (undoStack, redoStack, push, undo, redo, max 50 history)
- [x] T005 Verify useUndoRedo tests pass with `cd frontend && pnpm test`

**Checkpoint**: Foundation ready - useUndoRedo hook is fully tested and working

---

## Phase 3: User Story 1 - 直前の描画操作を取り消す (Priority: P1) 🎯 MVP

**Goal**: Undoボタンで直前のストロークを取り消せる

**Independent Test**: 描画後にUndoボタンをタップして、直前のストロークが消えることを確認

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [P] [US1] Write Toolbar Undo button tests in frontend/src/components/Toolbar/Toolbar.test.tsx (button exists, disabled when canUndo=false, enabled when canUndo=true, calls onUndo)

### Implementation for User Story 1

- [x] T007 [US1] Add canUndo and onUndo props to ToolbarProps in frontend/src/components/Toolbar/Toolbar.tsx
- [x] T008 [US1] Add Undo button UI to Toolbar component in frontend/src/components/Toolbar/Toolbar.tsx (with disabled state)
- [x] T009 [US1] Integrate useUndoRedo hook in frontend/src/App.tsx
- [x] T010 [US1] Capture stroke data on handlePointerUp in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T011 [US1] Push stroke to undoRedo history when stroke ends in frontend/src/App.tsx
- [x] T012 [US1] Implement canvas redraw from strokes array on undo in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T013 [US1] Wire Toolbar onUndo to undoRedo.undo in frontend/src/App.tsx
- [x] T014 [US1] Manual test: draw, undo, verify stroke disappears

**Checkpoint**: User Story 1 complete - Undo button works independently

---

## Phase 4: User Story 2 - 取り消した操作をやり直す (Priority: P2)

**Goal**: Redoボタンで取り消した操作を復元できる

**Independent Test**: Undo後にRedoボタンをタップして、消えたストロークが復元されることを確認

### Tests for User Story 2 ⚠️

- [x] T015 [P] [US2] Write Toolbar Redo button tests in frontend/src/components/Toolbar/Toolbar.test.tsx (button exists, disabled when canRedo=false, enabled when canRedo=true, calls onRedo)

### Implementation for User Story 2

- [x] T016 [US2] Add canRedo and onRedo props to ToolbarProps in frontend/src/components/Toolbar/Toolbar.tsx
- [x] T017 [US2] Add Redo button UI to Toolbar component in frontend/src/components/Toolbar/Toolbar.tsx (with disabled state)
- [x] T018 [US2] Wire Toolbar onRedo to undoRedo.redo in frontend/src/App.tsx
- [x] T019 [US2] Verify redo stack clears on new stroke in useUndoRedo hook
- [x] T020 [US2] Manual test: draw, undo, redo, verify stroke reappears; draw new stroke, verify redo disabled

**Checkpoint**: User Stories 1 AND 2 work independently

---

## Phase 5: User Story 3 - キーボードショートカットでUndo/Redo (Priority: P3)

**Goal**: Ctrl+Z / Ctrl+Y でUndo/Redoを実行できる

**Independent Test**: Ctrl+Zを押してUndoが実行されることを確認

### Tests for User Story 3 ⚠️

- [x] T021 [P] [US3] Write keyboard shortcut tests in frontend/src/hooks/useKeyboardShortcuts.test.ts (Ctrl+Z triggers undo, Ctrl+Y triggers redo, Cmd+Z on Mac, Cmd+Shift+Z on Mac)

### Implementation for User Story 3

- [x] T022 [US3] Create useKeyboardShortcuts hook in frontend/src/hooks/useKeyboardShortcuts.ts
- [x] T023 [US3] Implement Ctrl+Z / Cmd+Z detection for undo in useKeyboardShortcuts
- [x] T024 [US3] Implement Ctrl+Y / Cmd+Shift+Z detection for redo in useKeyboardShortcuts
- [x] T025 [US3] Integrate useKeyboardShortcuts in frontend/src/App.tsx
- [x] T026 [US3] Manual test: keyboard shortcuts work on both Windows and Mac

**Checkpoint**: All user stories functional and independently testable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T027 Ensure Undo/Redo works in all modes (draw, erase, navigate) in frontend/src/App.tsx
- [ ] T028 Trigger auto-save after Undo/Redo operations in frontend/src/App.tsx
- [x] T029 Run all tests with `cd frontend && pnpm test`
- [ ] T030 Run quickstart.md validation steps
- [ ] T031 Update README or docs if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 Toolbar changes
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent, just needs useUndoRedo hook

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002 can run in parallel (different files)
- T006 and T015 can run in parallel (different test files)
- T021 can run in parallel with US1/US2 implementation
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: Setup Phase

```bash
# Launch all setup tasks together:
Task: "Add StrokeData interface to frontend/src/types/index.ts"
Task: "Create useUndoRedo hook skeleton in frontend/src/hooks/useUndoRedo.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: User Story 1 (T006-T014)
4. **STOP and VALIDATE**: Test Undo button independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test Undo → Deploy/Demo (MVP!)
3. Add User Story 2 → Test Redo → Deploy/Demo
4. Add User Story 3 → Test keyboard shortcuts → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD as per Constitution)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
