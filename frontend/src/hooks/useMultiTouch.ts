import { useRef, useState, useCallback, useEffect } from 'react';
import type { UseMultiTouchOptions, UseMultiTouchResult } from '../types';
import { logDebug } from '../lib/errorLogger';

/**
 * Hook for detecting and managing multi-touch interactions.
 * Returns isMultiTouch=true when 2+ pointers are active.
 *
 * Key behavior:
 * - Single pointer (1 finger): isMultiTouch = false (drawing mode)
 * - Multiple pointers (2+ fingers): isMultiTouch = true (map gesture mode)
 * - Once multi-touch starts, stays true until ALL pointers are released
 *   (prevents accidental drawing when lifting one finger during pinch)
 */
export function useMultiTouch(options?: UseMultiTouchOptions): UseMultiTouchResult {
  const { onMultiTouchStart, onMultiTouchEnd } = options ?? {};

  // Track active pointers by their unique pointerId
  const pointerCacheRef = useRef<Set<number>>(new Set());

  // Track if we've entered multi-touch mode (stays true until all fingers lifted)
  const wasMultiTouchRef = useRef(false);

  // Reactive state for component re-renders
  const [pointerCount, setPointerCount] = useState(0);
  const [isMultiTouch, setIsMultiTouch] = useState(false);

  // Global touch event listener to detect when all fingers are lifted
  // This is needed because once pointerEvents: 'none' is set on the canvas,
  // it won't receive pointerup events directly
  useEffect(() => {
    if (!isMultiTouch) return;

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      void logDebug('globalTouchEnd', {
        remainingTouches: e.touches.length,
        wasMultiTouch: wasMultiTouchRef.current,
      });

      // When all fingers are lifted, reset multi-touch state
      if (e.touches.length === 0 && wasMultiTouchRef.current) {
        wasMultiTouchRef.current = false;
        pointerCacheRef.current.clear();
        setPointerCount(0);
        setIsMultiTouch(false);
        onMultiTouchEnd?.();
      }
    };

    // Listen for touchend/touchcancel on document to catch all touch releases
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [isMultiTouch, onMultiTouchEnd]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const cache = pointerCacheRef.current;
      const previousSize = cache.size;

      // Add new pointer to cache
      cache.add(e.pointerId);
      const newSize = cache.size;

      // Debug log
      void logDebug('pointerDown', {
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        previousSize,
        newSize,
        isPrimary: e.isPrimary,
      });

      // Update state
      setPointerCount(newSize);

      // Check for multi-touch transition (1 -> 2+)
      if (previousSize < 2 && newSize >= 2) {
        wasMultiTouchRef.current = true;
        setIsMultiTouch(true);
        void logDebug('multiTouchStart', { pointerCount: newSize });
        onMultiTouchStart?.();
      }
    },
    [onMultiTouchStart]
  );

  const removePointer = useCallback(
    (pointerId: number) => {
      const cache = pointerCacheRef.current;

      // Only process if pointer exists in cache
      if (!cache.has(pointerId)) return;

      cache.delete(pointerId);
      const newSize = cache.size;

      setPointerCount(newSize);

      // Only reset multi-touch when ALL pointers are released
      if (newSize === 0 && wasMultiTouchRef.current) {
        wasMultiTouchRef.current = false;
        setIsMultiTouch(false);
        onMultiTouchEnd?.();
      }
    },
    [onMultiTouchEnd]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      removePointer(e.pointerId);
    },
    [removePointer]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      removePointer(e.pointerId);
    },
    [removePointer]
  );

  return {
    isMultiTouch,
    pointerCount,
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
  };
}
