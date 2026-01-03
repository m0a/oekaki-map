import { useState, useCallback, useEffect } from 'react';
import type { Canvas, MapPosition, TileCoordinate } from '../types';
import { api } from '../services/api';

interface UseCanvasReturn {
  canvas: Canvas | null;
  tiles: TileCoordinate[];
  isLoading: boolean;
  error: string | null;
  createCanvas: (position: MapPosition) => Promise<string>;
  loadCanvas: (canvasId: string) => Promise<void>;
  updatePosition: (position: MapPosition) => Promise<void>;
  saveTiles: (tiles: Array<{ z: number; x: number; y: number; blob: Blob }>, canvasIdOverride?: string) => Promise<void>;
}

export function useCanvas(initialCanvasId?: string): UseCanvasReturn {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [tiles, setTiles] = useState<TileCoordinate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create a new canvas
  const createCanvas = useCallback(async (position: MapPosition): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const { canvas: newCanvas } = await api.canvas.create({
        centerLat: position.lat,
        centerLng: position.lng,
        zoom: position.zoom,
      });

      setCanvas(newCanvas);
      setTiles([]);

      // Update URL without reload
      window.history.pushState({}, '', `/c/${newCanvas.id}`);

      return newCanvas.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create canvas';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load an existing canvas
  const loadCanvas = useCallback(async (canvasId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const { canvas: loadedCanvas, tiles: loadedTiles } = await api.canvas.get(canvasId);
      setCanvas(loadedCanvas);
      setTiles(loadedTiles);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load canvas';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update canvas position
  const updatePosition = useCallback(async (position: MapPosition): Promise<void> => {
    if (!canvas) return;

    try {
      const updated = await api.canvas.update(canvas.id, {
        centerLat: position.lat,
        centerLng: position.lng,
        zoom: position.zoom,
      });

      setCanvas(updated);
    } catch (err) {
      console.error('Failed to update position:', err);
    }
  }, [canvas]);

  // Save tiles
  const saveTiles = useCallback(
    async (tilesToSave: Array<{ z: number; x: number; y: number; blob: Blob }>, canvasIdOverride?: string): Promise<void> => {
      const canvasId = canvasIdOverride || canvas?.id;
      if (!canvasId) {
        return;
      }

      try {
        const { saved, canvas: updatedCanvas } = await api.tiles.save(canvasId, tilesToSave);

        setCanvas(updatedCanvas);

        // Add new tiles to the list
        setTiles((prev) => {
          const existingKeys = new Set(prev.map((t) => `${t.z}/${t.x}/${t.y}`));
          const newTiles = saved.filter(
            (t) => !existingKeys.has(`${t.z}/${t.x}/${t.y}`)
          );
          return [...prev, ...newTiles];
        });
      } catch (err) {
        console.error('Failed to save tiles:', err);
        throw err;
      }
    },
    [canvas]
  );

  // Load initial canvas if ID provided
  useEffect(() => {
    if (initialCanvasId) {
      loadCanvas(initialCanvasId).catch(console.error);
    }
  }, [initialCanvasId, loadCanvas]);

  return {
    canvas,
    tiles,
    isLoading,
    error,
    createCanvas,
    loadCanvas,
    updatePosition,
    saveTiles,
  };
}
