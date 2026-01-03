# Quickstart: 描画のUndo/Redo機能

**Date**: 2026-01-03
**Feature**: 002-undo-redo

## 概要

この機能はフロントエンドのみの変更で、バックエンドAPIの変更は不要です。

## 実装手順

### 1. 型定義の追加

`frontend/src/types/index.ts` に `StrokeData` 型を追加:

```typescript
export interface StrokeData {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  thickness: number;
  mode: 'draw' | 'erase';
  timestamp: number;
  canvasOrigin: { lat: number; lng: number };
  zoom: number;
}
```

### 2. useUndoRedo hookの作成

`frontend/src/hooks/useUndoRedo.ts` を新規作成:

```typescript
import { useState, useCallback } from 'react';
import type { StrokeData } from '../types';

const MAX_HISTORY_SIZE = 50;

export function useUndoRedo() {
  const [undoStack, setUndoStack] = useState<StrokeData[]>([]);
  const [redoStack, setRedoStack] = useState<StrokeData[]>([]);

  const push = useCallback((stroke: StrokeData) => {
    setUndoStack(prev => {
      const next = [...prev, stroke];
      return next.length > MAX_HISTORY_SIZE ? next.slice(1) : next;
    });
    setRedoStack([]); // Clear redo on new stroke
  }, []);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const stroke = prev[prev.length - 1];
      setRedoStack(redo => [...redo, stroke]);
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const stroke = prev[prev.length - 1];
      setUndoStack(undo => [...undo, stroke]);
      return prev.slice(0, -1);
    });
  }, []);

  return {
    strokes: undoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    push,
    undo,
    redo,
  };
}
```

### 3. Toolbarの拡張

`frontend/src/components/Toolbar/Toolbar.tsx` にUndo/Redoボタンを追加:

```typescript
// Props に追加
interface ToolbarProps {
  // ... 既存props
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

// ボタン追加（モード切替ボタンの前に配置）
<button
  onClick={onUndo}
  disabled={!canUndo}
  style={{
    padding: '8px 12px',
    borderRadius: 8,
    backgroundColor: canUndo ? '#f0f0f0' : '#e0e0e0',
    color: canUndo ? '#333' : '#999',
    border: 'none',
    cursor: canUndo ? 'pointer' : 'not-allowed',
  }}
>
  ↩ Undo
</button>
<button
  onClick={onRedo}
  disabled={!canRedo}
  style={{
    padding: '8px 12px',
    borderRadius: 8,
    backgroundColor: canRedo ? '#f0f0f0' : '#e0e0e0',
    color: canRedo ? '#333' : '#999',
    border: 'none',
    cursor: canRedo ? 'pointer' : 'not-allowed',
  }}
>
  Redo ↪
</button>
```

### 4. App.tsxでの統合

```typescript
import { useUndoRedo } from './hooks/useUndoRedo';

// App内で
const undoRedo = useUndoRedo();

// handleStrokeEnd内でストロークを履歴に追加
undoRedo.push(strokeData);

// Toolbarにpropsを追加
<Toolbar
  // ... 既存props
  canUndo={undoRedo.canUndo}
  canRedo={undoRedo.canRedo}
  onUndo={undoRedo.undo}
  onRedo={undoRedo.redo}
/>
```

### 5. キーボードショートカット

`App.tsx`のuseEffect内で:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undoRedo.undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      undoRedo.redo();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [undoRedo]);
```

## テスト実行

```bash
cd frontend
pnpm test -- run --passWithNoTests
```

## 動作確認

1. `pnpm dev` でフロントエンドを起動
2. 地図上で描画
3. Undoボタンまたは Ctrl+Z で取り消し確認
4. Redoボタンまたは Ctrl+Y でやり直し確認
5. 新規描画後にRedoが無効化されることを確認
