import { useEffect } from 'react';

interface UseKeyboardShortcutsProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: UseKeyboardShortcutsProps): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
      const hasModifier = e.ctrlKey || e.metaKey;
      if (!hasModifier) return;

      const key = e.key.toLowerCase();

      // Undo: Ctrl+Z or Cmd+Z (without Shift)
      if (key === 'z' && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          onUndo();
        }
        return;
      }

      // Redo: Ctrl+Y or Cmd+Shift+Z
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        if (canRedo) {
          e.preventDefault();
          onRedo();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onUndo, onRedo, canUndo, canRedo]);
}
