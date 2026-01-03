# Data Model: 描画のUndo/Redo機能

**Date**: 2026-01-03
**Feature**: 002-undo-redo

## エンティティ定義

### StrokeData

描画された1つのストローク（ペンを下ろしてから上げるまでの一連の描画）を表す。

```typescript
interface StrokeData {
  /** ストロークの一意識別子 */
  id: string;

  /** ストロークを構成する座標点の配列（Canvas座標系） */
  points: Array<{ x: number; y: number }>;

  /** ストロークの色（HEX形式、例: "#000000"） */
  color: string;

  /** ストロークの太さ（ピクセル単位） */
  thickness: number;

  /** 描画モード */
  mode: 'draw' | 'erase';

  /** ストローク作成時刻（Unix timestamp） */
  timestamp: number;

  /** 描画時のCanvas原点（地図座標系） */
  canvasOrigin: {
    lat: number;
    lng: number;
  };

  /** 描画時のズームレベル */
  zoom: number;
}
```

### UndoRedoState

Undo/Redo機能の状態を管理するためのインターフェース。

```typescript
interface UndoRedoState {
  /** Undo可能なストロークのスタック（最新が末尾） */
  undoStack: StrokeData[];

  /** Redo可能なストロークのスタック（最新が末尾） */
  redoStack: StrokeData[];

  /** 履歴の最大サイズ */
  maxSize: number;
}
```

## 状態遷移

### 初期状態

```
undoStack: []
redoStack: []
```

### ストローク追加時

```
前: undoStack: [A, B], redoStack: [C]
操作: push(D)
後: undoStack: [A, B, D], redoStack: []  // Redoスタックはクリア
```

### Undo操作時

```
前: undoStack: [A, B, C], redoStack: []
操作: undo()
後: undoStack: [A, B], redoStack: [C]
```

### Redo操作時

```
前: undoStack: [A, B], redoStack: [C]
操作: redo()
後: undoStack: [A, B, C], redoStack: []
```

### 履歴上限到達時

```
前: undoStack: [S1, S2, ..., S50], redoStack: []
操作: push(S51)
後: undoStack: [S2, S3, ..., S51], redoStack: []  // 最古のS1が削除
```

## バリデーションルール

| フィールド | ルール |
|-----------|--------|
| StrokeData.id | 非空、ユニーク |
| StrokeData.points | 1点以上（単点はドット描画） |
| StrokeData.color | 有効なHEXカラー形式 |
| StrokeData.thickness | 1以上の正数 |
| StrokeData.zoom | 16〜19の範囲（描画可能ズーム範囲） |
| UndoRedoState.maxSize | 50（固定） |

## 既存型との関係

### DrawingState（既存）

```typescript
interface DrawingState {
  isDrawing: boolean;
  color: string;
  thickness: number;
  mode: 'draw' | 'erase' | 'navigate';
}
```

→ `StrokeData`は`DrawingState`から`color`, `thickness`, `mode`を継承し、座標情報を追加。

## 永続化

- **クライアントサイド**: メモリ内のみ（ページリロードでクリア）
- **サーバーサイド**: 変更なし。Undo/Redo後の最終状態は既存のタイル保存機能で同期される。
