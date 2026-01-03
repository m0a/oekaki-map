# Research: 描画のUndo/Redo機能

**Date**: 2026-01-03
**Feature**: 002-undo-redo

## 1. Undo/Redo パターンの選択

### Decision: Command Pattern（簡易版）

ストロークデータをスタックに保持し、Undo時にRedoスタックへ移動、Redo時に逆方向へ移動する。

### Rationale

- 描画アプリでの標準的なアプローチ
- Reactのstate管理と相性が良い
- メモリ効率が良い（差分ではなく状態を保持）
- 実装がシンプルで、既存のCanvas描画ロジックと統合しやすい

### Alternatives Considered

1. **Memento Pattern（完全なスナップショット保存）**
   - 却下理由: Canvas全体のスナップショットはメモリ消費が大きい（各ストロークでCanvas画像を保存すると数MBになる可能性）

2. **差分ベース（Delta/Patch）**
   - 却下理由: 描画の「差分」を計算するのは複雑で、単純なストローク追加より実装コストが高い

3. **外部ライブラリ（use-undo, zustand-undo）**
   - 却下理由: 既存のhook構造に追加の依存関係を入れる必要がなく、要件がシンプルなため自作で十分

## 2. ストロークデータの構造

### Decision: 座標配列 + メタデータ

```typescript
interface StrokeData {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  thickness: number;
  mode: 'draw' | 'erase';
  timestamp: number;
  // 地図座標系での位置情報
  canvasOrigin: { lat: number; lng: number };
  zoom: number;
}
```

### Rationale

- ストローク単位での管理が要件に合致
- 再描画に必要な全情報を含む
- 地図座標系の情報を含めることで、異なるズームレベルでも正確に再現可能

### Alternatives Considered

1. **Canvas ImageData の保存**
   - 却下理由: メモリ消費が大きすぎる

2. **SVG Path形式**
   - 却下理由: 既存のCanvas描画ロジックとの統合が複雑になる

## 3. Canvas再描画戦略

### Decision: 履歴から全ストロークを再描画

Undo/Redo時にCanvasをクリアし、履歴内の全ストロークを順番に再描画する。

### Rationale

- 実装がシンプル
- ストローク数が50以下であれば、パフォーマンス問題は発生しない
- 描画順序が保証される

### Alternatives Considered

1. **レイヤー分離（各ストロークを別レイヤーに）**
   - 却下理由: 既存のCanvas構造を大幅に変更する必要がある

2. **差分更新（消しゴムで特定部分のみ消す）**
   - 却下理由: 消しゴムモードとの整合性が複雑になる

## 4. キーボードショートカットの実装

### Decision: useEffect + window.addEventListener

グローバルなキーボードイベントをlistenし、Ctrl+Z/Ctrl+Y（Mac: Cmd+Z/Cmd+Shift+Z）を検知。

### Rationale

- React標準のアプローチ
- フォーカス状態に依存しない
- 他のショートカットとの競合を避けやすい

### Alternatives Considered

1. **react-hotkeys-hook**
   - 却下理由: 追加の依存関係は不要、要件がシンプル

## 5. 既存コードとの統合ポイント

### MapWithDrawing.tsx

- `handlePointerUp`でストローク完了時に履歴に追加
- Undo/Redo時に`reloadTilesForCurrentView`を呼び出してCanvas再描画

### Toolbar.tsx

- Undo/Redoボタンを追加（モード切替ボタンの隣）
- ボタンの有効/無効状態を履歴の状態に連動

### useUndoRedo.ts（新規）

- 履歴管理のロジックを分離
- `undo()`, `redo()`, `push()`, `canUndo`, `canRedo`を提供

## 6. サーバー同期の考慮事項

### Decision: 既存の自動保存機能を活用

Undo/Redo後の状態は、次回の自動保存タイミングでサーバーに同期される。

### Rationale

- 既存の`useAutoSave`hookと`extractTilesFromCanvas`の仕組みを再利用
- バックエンド変更不要
- ネットワーク負荷を最小限に抑える

### 注意点

- Undo操作後に即座に保存が走ると、一時的に不整合な状態がサーバーに保存される可能性
- → 既存の1秒デバウンスで十分対応可能
