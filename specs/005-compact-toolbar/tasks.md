# Tasks: Compact Toolbar Design

**Input**: Design documents from `/specs/005-compact-toolbar/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Constitution (Test-First Development) に準拠し、テストを先に書いてから実装を行います。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (frontend)**: `frontend/src/`
- Paths follow plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type定義とアイコンコンポーネントの基盤作成

- [x] T001 Add PopupType to type definitions in `frontend/src/types/index.ts`
- [x] T002 [P] Create IconProps interface in `frontend/src/components/Toolbar/icons/types.ts`
- [x] T003 [P] Create icons directory structure at `frontend/src/components/Toolbar/icons/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全User Storyで使用するSVGアイコンコンポーネントを作成

**⚠️ CRITICAL**: アイコンがなければボタンをアイコン化できないため、この段階で全アイコンを作成

### Tests for Icons (TDD)

- [x] T004 [P] Write test for PencilIcon in `frontend/src/components/Toolbar/icons/PencilIcon.test.tsx`
- [x] T005 [P] Write test for EraserIcon in `frontend/src/components/Toolbar/icons/EraserIcon.test.tsx`
- [x] T006 [P] Write test for HandIcon in `frontend/src/components/Toolbar/icons/HandIcon.test.tsx`
- [x] T007 [P] Write test for LayersIcon in `frontend/src/components/Toolbar/icons/LayersIcon.test.tsx`
- [x] T008 [P] Write test for UndoIcon in `frontend/src/components/Toolbar/icons/UndoIcon.test.tsx`
- [x] T009 [P] Write test for RedoIcon in `frontend/src/components/Toolbar/icons/RedoIcon.test.tsx`

### Implementation for Icons

- [x] T010 [P] Implement PencilIcon (鉛筆) in `frontend/src/components/Toolbar/icons/PencilIcon.tsx`
- [x] T011 [P] Implement EraserIcon (消しゴム) in `frontend/src/components/Toolbar/icons/EraserIcon.tsx`
- [x] T012 [P] Implement HandIcon (手のひら) in `frontend/src/components/Toolbar/icons/HandIcon.tsx`
- [x] T013 [P] Implement LayersIcon (レイヤー) in `frontend/src/components/Toolbar/icons/LayersIcon.tsx`
- [x] T014 [P] Implement UndoIcon (左矢印) in `frontend/src/components/Toolbar/icons/UndoIcon.tsx`
- [x] T015 [P] Implement RedoIcon (右矢印) in `frontend/src/components/Toolbar/icons/RedoIcon.tsx`
- [x] T016 Create icons barrel export in `frontend/src/components/Toolbar/icons/index.ts`

**Checkpoint**: All 6 icons ready. Icon tests pass.

---

## Phase 3: User Story 1 - アイコンベースのコンパクトツールバー (Priority: P1) 🎯 MVP

**Goal**: テキストラベルをアイコンに置き換え、ツールチップでアクセシビリティを維持

**Independent Test**: すべてのモードボタン（Draw, Erase, Move, Layers, Undo, Redo）がアイコン表示であることを確認。各アイコンをタップして機能動作を確認。

### Tests for User Story 1 (TDD)

- [x] T017 [P] [US1] Write test for IconButton component in `frontend/src/components/Toolbar/IconButton.test.tsx`
- [x] T018 [P] [US1] Write test for icon-based mode buttons in `frontend/src/components/Toolbar/Toolbar.test.tsx`
- [x] T019 [P] [US1] Write test for icon-based Undo/Redo buttons in `frontend/src/components/Toolbar/Toolbar.test.tsx`
- [x] T020 [P] [US1] Write test for tooltip display in `frontend/src/components/Toolbar/IconButton.test.tsx`

### Implementation for User Story 1

- [x] T021 [US1] Implement IconButton component in `frontend/src/components/Toolbar/IconButton.tsx`
- [x] T022 [US1] Refactor Draw/Erase/Move buttons to use IconButton in `frontend/src/components/Toolbar/Toolbar.tsx`
- [x] T023 [US1] Refactor Layers button to use IconButton in `frontend/src/components/Toolbar/Toolbar.tsx`
- [x] T024 [US1] Refactor Undo/Redo buttons to use IconButton (remove text) in `frontend/src/components/Toolbar/Toolbar.tsx`
- [x] T025 [US1] Add title attribute for tooltips to all IconButtons in `frontend/src/components/Toolbar/Toolbar.tsx`

**Checkpoint**: User Story 1 complete. Mode/Undo/Redo buttons are all icons. Tests pass.

---

## Phase 4: User Story 2 - カラーパレットのポップアップ表示 (Priority: P2)

**Goal**: 8色パレットをポップアップ化し、選択中の1色のみ常時表示

**Independent Test**: 色ボタンをタップ→パレットポップアップ表示→色選択→ポップアップ自動閉じ

### Tests for User Story 2 (TDD)

- [x] T026 [P] [US2] Write test for ColorPopup component in `frontend/src/components/Toolbar/ColorPopup.test.tsx`
- [x] T027 [P] [US2] Write test for color button opens popup in `frontend/src/components/Toolbar/Toolbar.test.tsx`
- [x] T028 [P] [US2] Write test for popup closes on selection in `frontend/src/components/Toolbar/ColorPopup.test.tsx`
- [x] T029 [P] [US2] Write test for popup closes on outside click in `frontend/src/components/Toolbar/ColorPopup.test.tsx`

### Implementation for User Story 2

- [x] T030 [US2] Implement ColorPopup component in `frontend/src/components/Toolbar/ColorPopup.tsx`
- [x] T031 [US2] Add openPopup state (PopupType) to Toolbar in `frontend/src/components/Toolbar/Toolbar.tsx`
- [x] T032 [US2] Replace inline color palette with color button + ColorPopup in `frontend/src/components/Toolbar/Toolbar.tsx`
- [x] T033 [US2] Implement outside click detection for popup close in `frontend/src/components/Toolbar/Toolbar.tsx`

**Checkpoint**: User Story 2 complete. Color selection works via popup. Tests pass.

---

## Phase 5: User Story 3 - 線の太さのポップアップ表示 (Priority: P2)

**Goal**: 線の太さ選択をポップアップ化し、選択中の1太さのみ常時表示

**Independent Test**: 太さボタンをタップ→ポップアップ表示→太さ選択→ポップアップ自動閉じ

### Tests for User Story 3 (TDD)

- [x] T034 [P] [US3] Write test for ThicknessPopup component in `frontend/src/components/Toolbar/ThicknessPopup.test.tsx`
- [x] T035 [P] [US3] Write test for thickness button opens popup in `frontend/src/components/Toolbar/Toolbar.test.tsx`
- [x] T036 [P] [US3] Write test for popup closes on selection in `frontend/src/components/Toolbar/ThicknessPopup.test.tsx`

### Implementation for User Story 3

- [x] T037 [US3] Implement ThicknessPopup component in `frontend/src/components/Toolbar/ThicknessPopup.tsx`
- [x] T038 [US3] Replace inline thickness selector with button + ThicknessPopup in `frontend/src/components/Toolbar/Toolbar.tsx`
- [x] T039 [US3] Ensure only one popup can be open at a time in `frontend/src/components/Toolbar/Toolbar.tsx`

**Checkpoint**: User Story 3 complete. Thickness selection works via popup. Tests pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全体の調整とエッジケース対応

- [x] T040 Verify toolbar fits in single line on 320px screen width
- [x] T041 [P] Adjust button sizes to 44x44px for touch optimization in `frontend/src/components/Toolbar/Toolbar.tsx`
- [x] T042 [P] Verify all existing functionality still works (Share, Location buttons)
- [x] T043 Run full test suite: `npm test` in frontend/
- [ ] T044 Visual testing on mobile devices per quickstart.md
- [x] T045 Code cleanup: remove unused styles and comments in `frontend/src/components/Toolbar/Toolbar.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T003) - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (icons ready)
- **User Story 2 (Phase 4)**: Depends on Setup (PopupType). Can run parallel to US1.
- **User Story 3 (Phase 5)**: Depends on Setup (PopupType). Can run parallel to US1/US2.
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on icons (Phase 2). No other story dependencies.
- **User Story 2 (P2)**: Depends on PopupType (Phase 1). Independent of US1.
- **User Story 3 (P2)**: Depends on PopupType (Phase 1) and popup mechanism from US2.

### Within Each User Story (TDD Cycle)

1. Write tests FIRST → verify tests FAIL
2. Implement components → verify tests PASS
3. Refactor if needed → ensure tests still PASS

### Parallel Opportunities

**Phase 2 (Icons)**:
- All 6 icon tests (T004-T009) can run in parallel
- All 6 icon implementations (T010-T015) can run in parallel

**Phase 3-5 (User Stories)**:
- US1 tests (T017-T020) can run in parallel
- US2 tests (T026-T029) can run in parallel
- US3 tests (T034-T036) can run in parallel
- US2 and US3 can start in parallel after Phase 1 completes

---

## Parallel Example: Icon Creation (Phase 2)

```bash
# Launch all icon tests together (TDD - Red phase):
Task: "Write test for PencilIcon in frontend/src/components/Toolbar/icons/PencilIcon.test.tsx"
Task: "Write test for EraserIcon in frontend/src/components/Toolbar/icons/EraserIcon.test.tsx"
Task: "Write test for HandIcon in frontend/src/components/Toolbar/icons/HandIcon.test.tsx"
Task: "Write test for LayersIcon in frontend/src/components/Toolbar/icons/LayersIcon.test.tsx"
Task: "Write test for UndoIcon in frontend/src/components/Toolbar/icons/UndoIcon.test.tsx"
Task: "Write test for RedoIcon in frontend/src/components/Toolbar/icons/RedoIcon.test.tsx"

# Launch all icon implementations together (TDD - Green phase):
Task: "Implement PencilIcon in frontend/src/components/Toolbar/icons/PencilIcon.tsx"
Task: "Implement EraserIcon in frontend/src/components/Toolbar/icons/EraserIcon.tsx"
Task: "Implement HandIcon in frontend/src/components/Toolbar/icons/HandIcon.tsx"
Task: "Implement LayersIcon in frontend/src/components/Toolbar/icons/LayersIcon.tsx"
Task: "Implement UndoIcon in frontend/src/components/Toolbar/icons/UndoIcon.tsx"
Task: "Implement RedoIcon in frontend/src/components/Toolbar/icons/RedoIcon.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Icons (T004-T016)
3. Complete Phase 3: User Story 1 (T017-T025)
4. **STOP and VALIDATE**: Test icon-based toolbar independently
5. Deploy/demo if ready - already delivers 50%+ space savings

### Incremental Delivery

1. Setup + Icons → Icon foundation ready
2. Add User Story 1 → Test independently → Deploy (アイコン化完了!)
3. Add User Story 2 → Test independently → Deploy (カラーポップアップ追加)
4. Add User Story 3 → Test independently → Deploy (太さポップアップ追加)
5. Polish → Final verification → Release

### Task Summary

| Phase | Tasks | Parallel Opportunities |
|-------|-------|----------------------|
| Setup | 3 | 2 parallel |
| Foundational | 13 | 12 parallel (6 tests + 6 implementations) |
| User Story 1 | 9 | 4 parallel tests |
| User Story 2 | 8 | 4 parallel tests |
| User Story 3 | 6 | 3 parallel tests |
| Polish | 6 | 2 parallel |
| **Total** | **45** | |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- TDD: Write test → Verify FAIL → Implement → Verify PASS
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
