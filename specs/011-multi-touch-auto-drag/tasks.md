# Tasks: マルチタッチ自動ドラッグモード切替

**Input**: Design documents from `/specs/011-multi-touch-auto-drag/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Constitution(Test-First Development)に従い、実装前にテストを作成します。

**Organization**: タスクはユーザーストーリー別に整理され、各ストーリーを独立して実装・テスト可能にします。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: 所属するユーザーストーリー（US1, US2, US3）
- ファイルパスを正確に記載

## Path Conventions

- **Web app**: `frontend/src/` (この機能はフロントエンドのみ)

---

## Phase 1: Setup

**Purpose**: 新規hookファイルの準備

- [x] T001 useMultiTouchフックの型定義をfrontend/src/types/index.tsに追加
- [x] T002 [P] useMultiTouchフックの空ファイルをfrontend/src/hooks/useMultiTouch.tsに作成

---

## Phase 2: Foundational (useMultiTouch hook実装)

**Purpose**: 全ユーザーストーリーの基盤となるマルチタッチ検出hook

**⚠️ CRITICAL**: このフェーズ完了まで、ユーザーストーリーの実装は開始不可

### Tests (TDD: RED phase)

> **NOTE: テストを先に書き、実装前に失敗することを確認**

- [x] T003 [P] useMultiTouchフックのユニットテストをfrontend/src/hooks/useMultiTouch.test.tsに作成
  - シングルポインターでisMultiTouch=false
  - 2ポインターでisMultiTouch=true
  - ポインター削除で正しくカウント減少
  - 全ポインター削除でisMultiTouch=false
  - onMultiTouchStartコールバック呼び出し確認
  - onMultiTouchEndコールバック呼び出し確認

### Implementation (TDD: GREEN phase)

- [x] T004 useMultiTouchフックの基本実装をfrontend/src/hooks/useMultiTouch.tsに追加
  - Map<number, PointerEvent>でアクティブポインター追跡
  - isMultiTouch状態エクスポート
  - pointerCount数エクスポート
  - handlePointerDown/Up/Cancelハンドラー提供
  - onMultiTouchStart/onMultiTouchEndコールバックサポート

- [x] T005 テストが全てパスすることを確認（pnpm test src/hooks/useMultiTouch.test.ts）

**Checkpoint**: useMultiTouchフックが単体で動作確認完了 ✅

---

## Phase 3: User Story 1 - シングルタッチで描画継続 (Priority: P1) 🎯 MVP

**Goal**: 1本指タッチで従来通り描画できることを保証

**Independent Test**: ペンモードで1本指ドラッグして線が描画される

### Implementation for User Story 1

- [x] T006 [US1] DrawingCanvas.tsxにuseMultiTouchフックをインポート（frontend/src/components/DrawingCanvas/DrawingCanvas.tsx）
- [x] T007 [US1] handlePointerDownでuseMultiTouchのハンドラーを呼び出す
- [x] T008 [US1] handlePointerUp/Cancelでポインター削除処理を追加
- [x] T009 [US1] シングルタッチ時（isMultiTouch=false）に描画ロジックが実行されることを確認

**Checkpoint**: 1本指描画が正常動作（既存機能のリグレッションなし） ✅

---

## Phase 4: User Story 2 - マルチタッチで自動ドラッグモード切替 (Priority: P1)

**Goal**: 2本指以上で地図操作モードに自動切替

**Independent Test**: ペンモードで2本指ピンチ→地図ズーム動作

### Implementation for User Story 2

- [x] T010 [US2] pointerEventsスタイルをisMultiTouch状態で条件分岐（frontend/src/components/DrawingCanvas/DrawingCanvas.tsx）
  - `(mode === 'navigate' || isMultiTouch) ? 'none' : 'auto'`
- [x] T011 [US2] onMultiTouchStartコールバックで描画中ストロークを確定（handlePointerUp相当を呼ぶ）
- [x] T012 [US2] iOS Safari対応: touchstart/touchmoveにpreventDefaultを追加（passive: false）
  - isMultiTouchがfalseかつmode !== 'navigate'の場合のみpreventDefault

**Checkpoint**: 2本指操作で地図ズーム/パンが動作、描画されない ✅

---

## Phase 5: User Story 3 - マルチタッチ解除後の描画モード復帰 (Priority: P2)

**Goal**: 全ての指を離した後、次の1本指タッチで描画可能

**Independent Test**: 2本指操作後に指を離し、1本指で描画できる

### Implementation for User Story 3

- [x] T013 [US3] 指が1本になってもisMultiTouch=trueを維持する実装確認（useMultiTouch.ts）
  - ポインター数が1以上残っている間はマルチタッチ状態維持
- [x] T014 [US3] 全ての指が離れた時のみisMultiTouch=falseにリセット
- [x] T015 [US3] onMultiTouchEndコールバックで適切なクリーンアップが行われることを確認

**Checkpoint**: マルチタッチ→リリース→シングルタッチで描画可能 ✅

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: エッジケース対応と最終検証

- [x] T016 [P] マウス操作時の動作確認（マウスはシングルポイントのため影響なし）
- [x] T017 [P] スタイラスペン操作時の動作確認（pointerType="pen"は描画モードで動作）
- [x] T018 lint/type-checkの実行（pnpm lint && pnpm type-check）
- [x] T019 全テスト実行（cd frontend && pnpm test）
- [ ] T020 quickstart.mdの手動テスト項目を全て実行（実機テスト必須）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - 即開始可能
- **Foundational (Phase 2)**: Setup完了後 - 全ユーザーストーリーをブロック
- **User Story 1 (Phase 3)**: Foundational完了後
- **User Story 2 (Phase 4)**: Foundational完了後（US1と並列可能だがUS1のコード変更あり）
- **User Story 3 (Phase 5)**: Foundational完了後（US1,US2と論理的に関連）
- **Polish (Phase 6)**: 全ユーザーストーリー完了後

### User Story Dependencies

- **User Story 1 (P1)**: Foundational完了後即開始可能
- **User Story 2 (P1)**: US1と同一ファイル修正のため、US1完了後推奨
- **User Story 3 (P2)**: US2完了後推奨（マルチタッチ解除の挙動に依存）

### Within Each Phase

- テストは実装前に作成、失敗確認
- 同一ファイルの変更は順次実行
- 各タスク完了後にコミット推奨

### Parallel Opportunities

- T001, T002: 並列可能（異なるファイル）
- T016, T017, T018: 並列可能（検証タスク）

---

## Parallel Example: Foundational Phase

```bash
# Foundationalのテスト作成（単独タスク）:
Task: "T003 useMultiTouchフックのユニットテスト作成"

# テスト失敗確認後、実装:
Task: "T004 useMultiTouchフックの基本実装"
Task: "T005 テストがパスすることを確認"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Phase 1: Setup完了
2. Phase 2: Foundational完了（useMultiTouchフック動作確認）
3. Phase 3: User Story 1完了（シングルタッチ描画確認）
4. Phase 4: User Story 2完了（マルチタッチで地図操作確認）
5. **STOP and VALIDATE**: 主要ユースケースをテスト
6. デプロイ可能状態

### Incremental Delivery

1. Setup + Foundational → フック単体テスト完了
2. User Story 1 → 描画リグレッションなし確認
3. User Story 2 → メイン機能動作確認 → **デプロイ可能（MVP）**
4. User Story 3 → UX改善（モード復帰）完了
5. Polish → 品質保証完了

---

## Notes

- 全てフロントエンド変更（バックエンド変更なし）
- 変更ファイルは3つのみ: useMultiTouch.ts（新規）、useMultiTouch.test.ts（新規）、DrawingCanvas.tsx（修正）
- iOS Safari実機テストは手動確認必須
- Constitution「Test-First Development」に従い、T003（テスト）→T004（実装）の順序を厳守
