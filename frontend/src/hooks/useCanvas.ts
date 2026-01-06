import { useState, useCallback, useEffect } from 'react';
import type { Canvas, MapPosition, TileCoordinate } from '../../../backend/src/types';
import { api } from '../services/api';
import { client, callRpc } from '../services/rpc';

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
      const { data, error } = await callRpc<{ canvas: Canvas }>(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        client.api.canvas.$post({
          json: {
            centerLat: position.lat,
            centerLng: position.lng,
            zoom: position.zoom,
          },
        })
      );

      if (error || !data) throw new Error(error || 'No data returned');

      setCanvas(data.canvas);
      setTiles([]);

      // Update URL without reload
      window.history.pushState({}, '', `/c/${data.canvas.id}`);

      return data.canvas.id;
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
      const { data, error } = await callRpc<{ canvas: Canvas; tiles: TileCoordinate[] }>(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        client.api.canvas[':id'].$get({
          param: { id: canvasId },
        })
      );

      if (error || !data) throw new Error(error || 'No data returned');

      setCanvas(data.canvas);
      setTiles(data.tiles);
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
      const { data, error } = await callRpc<Canvas>(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        client.api.canvas[':id'].$patch({
          param: { id: canvas.id },
          json: {
            centerLat: position.lat,
            centerLng: position.lng,
            zoom: position.zoom,
          },
        })
      );

      if (error || !data) throw new Error(error || 'No data returned');

      setCanvas(data);
    } catch (err) {
      console.error('Failed to update position:', err);
    }
  }, [canvas]);

  // Save tiles
  // NOTE: Keeps manual fetch for FormData upload (Hono RPC 4.6.0 limitation)
  // See: specs/009-hono-rpc-migration/spec.md - FormData endpoints
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
