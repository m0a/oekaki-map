import { useCallback, useRef, useState } from 'react';

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  scheduleSave: (saveFn: () => Promise<void>) => void;
  cancelSave: () => void;
  flushSave: () => Promise<void>;
}

const DEBOUNCE_DELAY = 500; // 500ms debounce per spec

export function useAutoSave(): UseAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);
  // Queue of pending save functions instead of single reference
  const pendingSaveFnsRef = useRef<Array<() => Promise<void>>>([]);
  const isExecutingRef = useRef(false);

  // Cancel any pending save timer (but keep queued functions)
  const cancelSave = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Execute all queued saves
  const executeSaves = useCallback(async () => {
    if (isExecutingRef.current) return;
    if (pendingSaveFnsRef.current.length === 0) return;

    isExecutingRef.current = true;
    setIsSaving(true);
    setError(null);

    // Take all pending save functions
    const saveFns = [...pendingSaveFnsRef.current];
    pendingSaveFnsRef.current = [];

    try {
      // Execute all saves sequentially
      for (const saveFn of saveFns) {
        await saveFn();
      }
      setLastSaved(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setError(message);
      console.error('Auto-save failed:', err);
    } finally {
      setIsSaving(false);
      isExecutingRef.current = false;

      // If more saves were queued during execution, schedule another run
      if (pendingSaveFnsRef.current.length > 0) {
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null;
          void executeSaves();
        }, DEBOUNCE_DELAY);
      }
    }
  }, []);

  // Schedule a save with debounce (queues instead of replacing)
  const scheduleSave = useCallback(
    (saveFn: () => Promise<void>) => {
      // Add to queue instead of replacing
      pendingSaveFnsRef.current.push(saveFn);

      // Reset debounce timer
      cancelSave();

      // Schedule execution
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        void executeSaves();
      }, DEBOUNCE_DELAY);
    },
    [cancelSave, executeSaves]
  );

  // Immediately execute all pending saves (flush the queue)
  const flushSave = useCallback(async () => {
    cancelSave();
    await executeSaves();
  }, [cancelSave, executeSaves]);

  return {
    isSaving,
    lastSaved,
    error,
    scheduleSave,
    cancelSave,
    flushSave,
  };
}
