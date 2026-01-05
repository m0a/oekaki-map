import { useState, useCallback } from 'react';
import type { DrawingState } from '../types';
import { DEFAULT_COLORS, LINE_THICKNESSES } from '../types';

interface UseDrawingReturn {
  state: DrawingState;
  setColor: (color: string) => void;
  setThickness: (thickness: number) => void;
  setMode: (mode: DrawingState['mode']) => void;
  toggleMode: () => void;
}

export function useDrawing(): UseDrawingReturn {
  const [state, setState] = useState<DrawingState>({
    isDrawing: false,
    color: DEFAULT_COLORS[0], // Black
    thickness: LINE_THICKNESSES.medium,
    mode: 'navigate',
  });

  const setColor = useCallback((color: string) => {
    setState((prev) => ({ ...prev, color }));
  }, []);

  const setThickness = useCallback((thickness: number) => {
    setState((prev) => ({ ...prev, thickness }));
  }, []);

  const setMode = useCallback((mode: DrawingState['mode']) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const toggleMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mode: prev.mode === 'draw' ? 'navigate' : 'draw',
    }));
  }, []);

  return {
    state,
    setColor,
    setThickness,
    setMode,
    toggleMode,
  };
}
