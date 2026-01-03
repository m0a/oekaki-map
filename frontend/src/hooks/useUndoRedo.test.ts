import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from './useUndoRedo';
import type { StrokeData } from '../types';

const createMockStroke = (id: string): StrokeData => ({
  id,
  points: [{ lat: 35.6812, lng: 139.7671 }, { lat: 35.6813, lng: 139.7672 }],
  color: '#000000',
  thickness: 4,
  mode: 'draw',
  timestamp: Date.now(),
  zoom: 18,
});

describe('useUndoRedo', () => {
  describe('initial state', () => {
    it('should start with empty strokes', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.strokes).toEqual([]);
    });

    it('should have canUndo as false initially', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.canUndo).toBe(false);
    });

    it('should have canRedo as false initially', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('push', () => {
    it('should add stroke to strokes array', () => {
      const { result } = renderHook(() => useUndoRedo());
      const stroke = createMockStroke('1');

      act(() => {
        result.current.push(stroke);
      });

      expect(result.current.strokes).toHaveLength(1);
      expect(result.current.strokes[0]).toEqual(stroke);
    });

    it('should set canUndo to true after push', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.push(createMockStroke('1'));
      });

      expect(result.current.canUndo).toBe(true);
    });

    it('should clear redo stack when new stroke is pushed', () => {
      const { result } = renderHook(() => useUndoRedo());

      // Push and undo to create redo stack
      act(() => {
        result.current.push(createMockStroke('1'));
      });
      act(() => {
        result.current.undo();
      });
      expect(result.current.canRedo).toBe(true);

      // Push new stroke
      act(() => {
        result.current.push(createMockStroke('2'));
      });

      expect(result.current.canRedo).toBe(false);
    });

    it('should limit history to 50 strokes', () => {
      const { result } = renderHook(() => useUndoRedo());

      // Push 55 strokes
      act(() => {
        for (let i = 0; i < 55; i++) {
          result.current.push(createMockStroke(`stroke-${i}`));
        }
      });

      expect(result.current.strokes).toHaveLength(50);
      // First 5 should be removed, so first remaining should be stroke-5
      expect(result.current.strokes[0]?.id).toBe('stroke-5');
      expect(result.current.strokes[49]?.id).toBe('stroke-54');
    });
  });

  describe('undo', () => {
    it('should remove last stroke from strokes array', () => {
      const { result } = renderHook(() => useUndoRedo());
      const stroke1 = createMockStroke('1');
      const stroke2 = createMockStroke('2');

      act(() => {
        result.current.push(stroke1);
        result.current.push(stroke2);
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.strokes).toHaveLength(1);
      expect(result.current.strokes[0]).toEqual(stroke1);
    });

    it('should set canRedo to true after undo', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.push(createMockStroke('1'));
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo).toBe(true);
    });

    it('should set canUndo to false when all strokes are undone', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.push(createMockStroke('1'));
      });
      act(() => {
        result.current.undo();
      });

      expect(result.current.canUndo).toBe(false);
    });

    it('should do nothing when strokes is empty', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.undo();
      });

      expect(result.current.strokes).toEqual([]);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('redo', () => {
    it('should restore last undone stroke', () => {
      const { result } = renderHook(() => useUndoRedo());
      const stroke = createMockStroke('1');

      act(() => {
        result.current.push(stroke);
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.redo();
      });

      expect(result.current.strokes).toHaveLength(1);
      expect(result.current.strokes[0]).toEqual(stroke);
    });

    it('should set canUndo to true after redo', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.push(createMockStroke('1'));
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.redo();
      });

      expect(result.current.canUndo).toBe(true);
    });

    it('should set canRedo to false after redo when redo stack is empty', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.push(createMockStroke('1'));
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.redo();
      });

      expect(result.current.canRedo).toBe(false);
    });

    it('should do nothing when redo stack is empty', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.push(createMockStroke('1'));
      });
      act(() => {
        result.current.redo();
      });

      expect(result.current.strokes).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should clear all strokes and redo stack', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.push(createMockStroke('1'));
        result.current.push(createMockStroke('2'));
      });
      act(() => {
        result.current.undo();
      });
      act(() => {
        result.current.clear();
      });

      expect(result.current.strokes).toEqual([]);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('multiple undo/redo', () => {
    it('should handle multiple undo operations in sequence', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.push(createMockStroke('1'));
        result.current.push(createMockStroke('2'));
        result.current.push(createMockStroke('3'));
      });

      act(() => {
        result.current.undo();
      });
      expect(result.current.strokes).toHaveLength(2);

      act(() => {
        result.current.undo();
      });
      expect(result.current.strokes).toHaveLength(1);

      act(() => {
        result.current.undo();
      });
      expect(result.current.strokes).toHaveLength(0);
    });

    it('should handle multiple redo operations in sequence', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.push(createMockStroke('1'));
        result.current.push(createMockStroke('2'));
        result.current.push(createMockStroke('3'));
      });

      act(() => {
        result.current.undo();
        result.current.undo();
        result.current.undo();
      });

      act(() => {
        result.current.redo();
      });
      expect(result.current.strokes).toHaveLength(1);

      act(() => {
        result.current.redo();
      });
      expect(result.current.strokes).toHaveLength(2);

      act(() => {
        result.current.redo();
      });
      expect(result.current.strokes).toHaveLength(3);
    });
  });
});
