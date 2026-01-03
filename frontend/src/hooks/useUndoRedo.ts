import { useState, useCallback } from 'react';
import type { StrokeData } from '../types';

const MAX_HISTORY_SIZE = 50;

interface UseUndoRedoReturn {
  /** Current strokes (undo stack) */
  strokes: StrokeData[];
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Add a new stroke to history */
  push: (stroke: StrokeData) => void;
  /** Undo the last stroke */
  undo: () => void;
  /** Redo the last undone stroke */
  redo: () => void;
  /** Clear all history */
  clear: () => void;
}

export function useUndoRedo(): UseUndoRedoReturn {
  const [undoStack, setUndoStack] = useState<StrokeData[]>([]);
  const [redoStack, setRedoStack] = useState<StrokeData[]>([]);

  const push = useCallback((stroke: StrokeData) => {
    setUndoStack((prev) => {
      const next = [...prev, stroke];
      // Remove oldest if exceeds max size
      return next.length > MAX_HISTORY_SIZE ? next.slice(1) : next;
    });
    // Clear redo stack when new stroke is added
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const stroke = prev[prev.length - 1];
      if (stroke) {
        setRedoStack((redo) => [...redo, stroke]);
      }
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const stroke = prev[prev.length - 1];
      if (stroke) {
        setUndoStack((undoList) => [...undoList, stroke]);
      }
      return prev.slice(0, -1);
    });
  }, []);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    strokes: undoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    push,
    undo,
    redo,
    clear,
  };
}
