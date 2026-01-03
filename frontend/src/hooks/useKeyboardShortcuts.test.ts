import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  const mockOnUndo = vi.fn();
  const mockOnRedo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Undo shortcuts', () => {
    it('should call onUndo when Ctrl+Z is pressed', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onUndo: mockOnUndo,
          onRedo: mockOnRedo,
          canUndo: true,
          canRedo: false,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(mockOnUndo).toHaveBeenCalledTimes(1);
    });

    it('should call onUndo when Cmd+Z is pressed (Mac)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onUndo: mockOnUndo,
          onRedo: mockOnRedo,
          canUndo: true,
          canRedo: false,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(mockOnUndo).toHaveBeenCalledTimes(1);
    });

    it('should not call onUndo when canUndo is false', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onUndo: mockOnUndo,
          onRedo: mockOnRedo,
          canUndo: false,
          canRedo: false,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(mockOnUndo).not.toHaveBeenCalled();
    });

    it('should not call onUndo when Shift is also pressed', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onUndo: mockOnUndo,
          onRedo: mockOnRedo,
          canUndo: true,
          canRedo: false,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(mockOnUndo).not.toHaveBeenCalled();
    });
  });

  describe('Redo shortcuts', () => {
    it('should call onRedo when Ctrl+Y is pressed', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onUndo: mockOnUndo,
          onRedo: mockOnRedo,
          canUndo: false,
          canRedo: true,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(mockOnRedo).toHaveBeenCalledTimes(1);
    });

    it('should call onRedo when Cmd+Shift+Z is pressed (Mac)', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onUndo: mockOnUndo,
          onRedo: mockOnRedo,
          canUndo: false,
          canRedo: true,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(mockOnRedo).toHaveBeenCalledTimes(1);
    });

    it('should not call onRedo when canRedo is false', () => {
      renderHook(() =>
        useKeyboardShortcuts({
          onUndo: mockOnUndo,
          onRedo: mockOnRedo,
          canUndo: false,
          canRedo: false,
        })
      );

      const event = new KeyboardEvent('keydown', {
        key: 'y',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(mockOnRedo).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          onUndo: mockOnUndo,
          onRedo: mockOnRedo,
          canUndo: true,
          canRedo: true,
        })
      );

      unmount();

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(mockOnUndo).not.toHaveBeenCalled();
    });
  });
});
