# Tasks: タイルマップ追従

**Input**: Design documents from `/specs/008-tile-map-sync/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Constitution Principle I (Test-First Development) requires tests. E2Eテストを先に作成。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `frontend/src/`, `tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存コードの確認と変更箇所の特定

- [x] T001 既存のMapWithDrawingコンポーネントの動作確認 in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T002 [P] 現在のLeafletイベントハンドラ構成を把握（move, moveend, zoom, zoomend）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: テスト基盤とCanvas transform同期の基礎実装

**⚠️ CRITICAL**: User Story実装前にE2Eテスト枠組みを準備

- [x] T003 E2Eテストファイル作成 in tests/e2e/map-tile-sync.spec.ts
- [x] T004 テスト用の描画済みマップ状態をセットアップするヘルパー関数作成

**Checkpoint**: Foundation ready - User Story実装開始可能

---

## Phase 3: User Story 1 - スムーズなマップ移動体験 (Priority: P1) 🎯 MVP

**Goal**: ナビゲートモードでマップをドラッグ時、描画タイルがリアルタイムで追従

**Independent Test**: マップをドラッグし、描画済みタイルがマップと同期して動くことを確認

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T005 [US1] E2Eテスト: ドラッグ時のタイル追従確認 in tests/e2e/map-tile-sync.spec.ts
- [x] T006 [US1] E2Eテスト: ドラッグ完了後のスナップなし確認 in tests/e2e/map-tile-sync.spec.ts

### Implementation for User Story 1

- [x] T007 [US1] `move`イベントハンドラ追加: tilePaneのtransformをcanvasに同期 in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T008 [US1] `moveend`イベントハンドラ修正: transformリセット後にredrawAll() in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T009 [US1] ナビゲートモード判定: mode !== 'navigate'の場合はtransform同期をスキップ in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T010 [US1] 慣性スクロール対応: 慣性中も`move`イベントで追従継続を確認

**Checkpoint**: ドラッグ追従が動作し、E2Eテストがパス

---

## Phase 4: User Story 2 - スムーズなズーム体験 (Priority: P1)

**Goal**: ズーム操作時、描画タイルがリアルタイムでスケーリング

**Independent Test**: ピンチズームまたはスクロールホイールでズームし、タイルが同期してスケール

### Tests for User Story 2

- [x] T011 [US2] E2Eテスト: ズームイン時のタイルスケール確認 in tests/e2e/map-tile-sync.spec.ts
- [x] T012 [US2] E2Eテスト: ズーム完了後の再描画確認 in tests/e2e/map-tile-sync.spec.ts

### Implementation for User Story 2

- [x] T013 [US2] `zoom`イベントハンドラ追加: CSS scale transformを適用 in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T014 [US2] transform-origin設定: ズーム中心を基準にスケーリング in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T015 [US2] `zoomend`イベントハンドラ: transform/scaleリセット後に再描画 in frontend/src/components/MapWithDrawing/MapWithDrawing.tsx
- [x] T016 [US2] 連続ズーム対応: 急速なズーム操作でもtransformが正しく更新されることを確認

**Checkpoint**: ズーム追従が動作し、ドラッグ追従と両立

---

## Phase 5: User Story 3 - モバイルでのスムーズな操作 (Priority: P2)

**Goal**: モバイルタッチ操作でもデスクトップ同等の追従体験

**Independent Test**: モバイルエミュレーションでタッチドラッグ・ピンチズームを確認

### Tests for User Story 3

- [x] T017 [US3] E2Eテスト: モバイルビューポートでのタッチドラッグ確認 in tests/e2e/map-tile-sync.spec.ts
- [x] T018 [US3] E2Eテスト: ピンチズーム操作の追従確認 in tests/e2e/map-tile-sync.spec.ts

### Implementation for User Story 3

- [x] T019 [US3] タッチイベント確認: 既存実装がタッチでも動作することを確認（追加実装が必要な場合のみ対応）
- [x] T020 [US3] 高速スワイプ対応: 慣性スクロール中のtransform継続を確認

**Checkpoint**: モバイル操作が正常動作

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 品質向上とエッジケース対応

- [x] T021 [P] 描画モード・消しゴムモードでの既存動作確認（マップ移動無効を維持）
- [x] T022 [P] 大量タイル（100枚以上）でのパフォーマンステスト
- [x] T023 [P] 描画可能ズーム範囲境界（16, 19）でのエッジケーステスト
- [x] T024 quickstart.md の手動テスト項目を実行して最終確認

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - 即時開始可能
- **Foundational (Phase 2)**: Setup完了後 - E2Eテスト枠組み準備
- **User Story 1 (Phase 3)**: Foundational完了後 - ドラッグ追従
- **User Story 2 (Phase 4)**: Foundational完了後 - ズーム追従（US1と並行可能だが同一ファイル）
- **User Story 3 (Phase 5)**: US1, US2完了後 - モバイル確認
- **Polish (Phase 6)**: 全User Story完了後

### User Story Dependencies

| Story | Priority | Depends On | Blocks |
|-------|----------|------------|--------|
| US1 (ドラッグ) | P1 | Foundational | US3 |
| US2 (ズーム) | P1 | Foundational | US3 |
| US3 (モバイル) | P2 | US1, US2 | - |

### Within Each User Story

1. E2Eテスト作成 → テストがFAIL
2. イベントハンドラ実装
3. テストがPASS
4. チェックポイント確認

### Parallel Opportunities

- T001, T002: Setup内で並行可能
- T005, T006: US1テスト並行可能
- T011, T012: US2テスト並行可能
- T017, T018: US3テスト並行可能
- T021, T022, T023: Polish内で並行可能

---

## Parallel Example: User Story 1

```bash
# US1テストを並行実行:
Task: T005 [US1] E2Eテスト: ドラッグ時のタイル追従確認
Task: T006 [US1] E2Eテスト: ドラッグ完了後のスナップなし確認

# 次にUS1実装を順次実行（同一ファイルなので順次）:
Task: T007 [US1] moveイベントハンドラ追加
Task: T008 [US1] moveendイベントハンドラ修正
Task: T009 [US1] ナビゲートモード判定
Task: T010 [US1] 慣性スクロール対応
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup完了
2. Phase 2: Foundational（E2Eテスト枠組み）
3. Phase 3: User Story 1（ドラッグ追従）
4. **STOP and VALIDATE**: ドラッグ追従のみで価値確認
5. デプロイ可能

### Incremental Delivery

1. Setup + Foundational → テスト基盤Ready
2. Add US1 (ドラッグ) → テスト → Deploy/Demo (MVP!)
3. Add US2 (ズーム) → テスト → Deploy/Demo
4. Add US3 (モバイル) → テスト → Deploy/Demo
5. Polish → 品質向上

---

## Notes

- すべての変更は`frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`に集中
- CSS transformはGPUアクセラレーション対応 → 60fps達成可能
- 既存の`redrawAll()`、`reloadTilesForCurrentView()`は変更不要
- 新規ファイル作成なし（E2Eテスト以外）
