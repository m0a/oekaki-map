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
  const pendingSaveFnRef = useRef<(() => Promise<void>) | null>(null);

  // Cancel any pending save
  const cancelSave = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingSaveFnRef.current = null;
  }, []);

  // Execute the save
  const executeSave = useCallback(async () => {
    const saveFn = pendingSaveFnRef.current;
    if (!saveFn) return;

    pendingSaveFnRef.current = null;
    setIsSaving(true);
    setError(null);

    try {
      await saveFn();
      setLastSaved(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setError(message);
      console.error('Auto-save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Schedule a save with debounce
  const scheduleSave = useCallback(
    (saveFn: () => Promise<void>) => {
      // Cancel any existing scheduled save
      cancelSave();

      // Store the save function
      pendingSaveFnRef.current = saveFn;

      // Schedule new save
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        void executeSave();
      }, DEBOUNCE_DELAY);
    },
    [cancelSave, executeSave]
  );

  // Immediately execute any pending save (flush the queue)
  const flushSave = useCallback(async () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingSaveFnRef.current) {
      await executeSave();
    }
  }, [executeSave]);

  return {
    isSaving,
    lastSaved,
    error,
    scheduleSave,
    cancelSave,
    flushSave,
  };
}
