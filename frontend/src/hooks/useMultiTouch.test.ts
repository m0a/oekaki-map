import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMultiTouch } from './useMultiTouch';

// Helper to create mock PointerEvent
function createMockPointerEvent(pointerId: number): React.PointerEvent {
  return {
    pointerId,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.PointerEvent;
}

describe('useMultiTouch', () => {
  describe('initial state', () => {
    it('should start with isMultiTouch=false', () => {
      const { result } = renderHook(() => useMultiTouch());
      expect(result.current.isMultiTouch).toBe(false);
    });

    it('should start with pointerCount=0', () => {
      const { result } = renderHook(() => useMultiTouch());
      expect(result.current.pointerCount).toBe(0);
    });
  });

  describe('single pointer (drawing mode)', () => {
    it('should have isMultiTouch=false with one pointer', () => {
      const { result } = renderHook(() => useMultiTouch());

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
      });

      expect(result.current.isMultiTouch).toBe(false);
      expect(result.current.pointerCount).toBe(1);
    });

    it('should return to pointerCount=0 when pointer is released', () => {
      const { result } = renderHook(() => useMultiTouch());

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
      });

      act(() => {
        result.current.handlePointerUp(createMockPointerEvent(1));
      });

      expect(result.current.pointerCount).toBe(0);
      expect(result.current.isMultiTouch).toBe(false);
    });
  });

  describe('multi-touch (map gesture mode)', () => {
    it('should have isMultiTouch=true with two pointers', () => {
      const { result } = renderHook(() => useMultiTouch());

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
      });

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(2));
      });

      expect(result.current.isMultiTouch).toBe(true);
      expect(result.current.pointerCount).toBe(2);
    });

    it('should have isMultiTouch=true with three or more pointers', () => {
      const { result } = renderHook(() => useMultiTouch());

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
        result.current.handlePointerDown(createMockPointerEvent(2));
        result.current.handlePointerDown(createMockPointerEvent(3));
      });

      expect(result.current.isMultiTouch).toBe(true);
      expect(result.current.pointerCount).toBe(3);
    });

    it('should maintain isMultiTouch=true when one finger is lifted but others remain', () => {
      const { result } = renderHook(() => useMultiTouch());

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
        result.current.handlePointerDown(createMockPointerEvent(2));
      });

      // Lift one finger
      act(() => {
        result.current.handlePointerUp(createMockPointerEvent(1));
      });

      // Should still be in multi-touch mode (was multi-touch, still has pointer)
      expect(result.current.isMultiTouch).toBe(true);
      expect(result.current.pointerCount).toBe(1);
    });

    it('should set isMultiTouch=false only when all fingers are lifted', () => {
      const { result } = renderHook(() => useMultiTouch());

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
        result.current.handlePointerDown(createMockPointerEvent(2));
      });

      // Lift all fingers
      act(() => {
        result.current.handlePointerUp(createMockPointerEvent(1));
        result.current.handlePointerUp(createMockPointerEvent(2));
      });

      expect(result.current.isMultiTouch).toBe(false);
      expect(result.current.pointerCount).toBe(0);
    });
  });

  describe('callbacks', () => {
    it('should call onMultiTouchStart when second pointer is added', () => {
      const onMultiTouchStart = vi.fn();
      const { result } = renderHook(() => useMultiTouch({ onMultiTouchStart }));

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
      });

      expect(onMultiTouchStart).not.toHaveBeenCalled();

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(2));
      });

      expect(onMultiTouchStart).toHaveBeenCalledTimes(1);
    });

    it('should not call onMultiTouchStart when adding third pointer', () => {
      const onMultiTouchStart = vi.fn();
      const { result } = renderHook(() => useMultiTouch({ onMultiTouchStart }));

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
        result.current.handlePointerDown(createMockPointerEvent(2));
      });

      onMultiTouchStart.mockClear();

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(3));
      });

      expect(onMultiTouchStart).not.toHaveBeenCalled();
    });

    it('should call onMultiTouchEnd when all pointers are released', () => {
      const onMultiTouchEnd = vi.fn();
      const { result } = renderHook(() => useMultiTouch({ onMultiTouchEnd }));

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
        result.current.handlePointerDown(createMockPointerEvent(2));
      });

      act(() => {
        result.current.handlePointerUp(createMockPointerEvent(1));
      });

      expect(onMultiTouchEnd).not.toHaveBeenCalled();

      act(() => {
        result.current.handlePointerUp(createMockPointerEvent(2));
      });

      expect(onMultiTouchEnd).toHaveBeenCalledTimes(1);
    });

    it('should not call onMultiTouchEnd if was never in multi-touch mode', () => {
      const onMultiTouchEnd = vi.fn();
      const { result } = renderHook(() => useMultiTouch({ onMultiTouchEnd }));

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
      });

      act(() => {
        result.current.handlePointerUp(createMockPointerEvent(1));
      });

      expect(onMultiTouchEnd).not.toHaveBeenCalled();
    });
  });

  describe('pointercancel handling', () => {
    it('should handle pointercancel same as pointerup', () => {
      const { result } = renderHook(() => useMultiTouch());

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
        result.current.handlePointerDown(createMockPointerEvent(2));
      });

      act(() => {
        result.current.handlePointerCancel(createMockPointerEvent(1));
        result.current.handlePointerCancel(createMockPointerEvent(2));
      });

      expect(result.current.isMultiTouch).toBe(false);
      expect(result.current.pointerCount).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle duplicate pointerId gracefully', () => {
      const { result } = renderHook(() => useMultiTouch());

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
        result.current.handlePointerDown(createMockPointerEvent(1)); // Same ID
      });

      expect(result.current.pointerCount).toBe(1);
    });

    it('should handle pointerup for non-existent pointer gracefully', () => {
      const { result } = renderHook(() => useMultiTouch());

      act(() => {
        result.current.handlePointerDown(createMockPointerEvent(1));
      });

      act(() => {
        result.current.handlePointerUp(createMockPointerEvent(999)); // Non-existent
      });

      expect(result.current.pointerCount).toBe(1);
    });
  });
});
