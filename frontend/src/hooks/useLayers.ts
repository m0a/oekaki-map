import { useState, useCallback } from 'react';
import type { Layer } from '../types';
import { MAX_LAYERS_PER_CANVAS, DEFAULT_LAYER_NAME_PREFIX } from '../types';

const API_BASE = '/api';

interface UseLayersReturn {
  layers: Layer[];
  activeLayerId: string | null;
  isLoading: boolean;
  error: string | null;
  canCreateLayer: boolean;
  loadLayers: (canvasId: string) => Promise<void>;
  createLayer: (canvasId: string, name?: string) => Promise<Layer | null>;
  selectLayer: (layerId: string) => void;
  updateLayer: (canvasId: string, layerId: string, updates: Partial<Pick<Layer, 'name' | 'order' | 'visible'>>) => Promise<Layer | null>;
  deleteLayer: (canvasId: string, layerId: string) => Promise<boolean>;
  toggleLayerVisibility: (canvasId: string, layerId: string) => Promise<void>;
  reorderLayers: (canvasId: string, layerId: string, newOrder: number) => Promise<void>;
  getActiveLayer: () => Layer | undefined;
  createDefaultLayerIfNeeded: (canvasId: string) => Promise<void>;
}

export function useLayers(): UseLayersReturn {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreateLayer = layers.length < MAX_LAYERS_PER_CANVAS;

  const loadLayers = useCallback(async (canvasId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/canvas/${canvasId}/layers`);
      if (!response.ok) {
        throw new Error('Failed to load layers');
      }

      const data = await response.json();
      const loadedLayers = data.layers as Layer[];

      setLayers(loadedLayers);

      // Select first layer if none selected
      const firstLayer = loadedLayers[0];
      if (loadedLayers.length > 0 && !activeLayerId && firstLayer) {
        setActiveLayerId(firstLayer.id);
      }
    } catch (err) {
      setError('レイヤーの読み込みに失敗しました');
      console.error('Failed to load layers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeLayerId]);

  const createLayer = useCallback(async (canvasId: string, name?: string): Promise<Layer | null> => {
    if (!canCreateLayer) return null;

    try {
      const response = await fetch(`${API_BASE}/canvas/${canvasId}/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error('Failed to create layer');
      }

      const data = await response.json();
      const newLayer = data.layer as Layer;

      setLayers((prev) => [...prev, newLayer].sort((a, b) => a.order - b.order));
      setActiveLayerId(newLayer.id);

      return newLayer;
    } catch (err) {
      setError('レイヤーの作成に失敗しました');
      console.error('Failed to create layer:', err);
      return null;
    }
  }, [canCreateLayer]);

  const selectLayer = useCallback((layerId: string) => {
    setActiveLayerId(layerId);
  }, []);

  const updateLayer = useCallback(async (
    canvasId: string,
    layerId: string,
    updates: Partial<Pick<Layer, 'name' | 'order' | 'visible'>>
  ): Promise<Layer | null> => {
    try {
      const response = await fetch(`${API_BASE}/canvas/${canvasId}/layers/${layerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update layer');
      }

      const data = await response.json();
      const updatedLayer = data.layer as Layer;

      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? updatedLayer : l)).sort((a, b) => a.order - b.order)
      );

      return updatedLayer;
    } catch (err) {
      setError('レイヤーの更新に失敗しました');
      console.error('Failed to update layer:', err);
      return null;
    }
  }, []);

  const deleteLayer = useCallback(async (canvasId: string, layerId: string): Promise<boolean> => {
    // Prevent deleting the last layer
    if (layers.length <= 1) {
      setError('最後のレイヤーは削除できません');
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/canvas/${canvasId}/layers/${layerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete layer');
      }

      const deletedIndex = layers.findIndex((l) => l.id === layerId);

      setLayers((prev) => prev.filter((l) => l.id !== layerId));

      // If we deleted the active layer, select another one
      if (activeLayerId === layerId) {
        const remainingLayers = layers.filter((l) => l.id !== layerId);
        if (remainingLayers.length > 0) {
          // Select the layer below, or the one above if deleting bottom layer
          const newIndex = Math.min(deletedIndex, remainingLayers.length - 1);
          const newActiveLayer = remainingLayers[newIndex];
          if (newActiveLayer) {
            setActiveLayerId(newActiveLayer.id);
          }
        }
      }

      return true;
    } catch (err) {
      setError('レイヤーの削除に失敗しました');
      console.error('Failed to delete layer:', err);
      return false;
    }
  }, [layers, activeLayerId]);

  const toggleLayerVisibility = useCallback(async (canvasId: string, layerId: string) => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;

    await updateLayer(canvasId, layerId, { visible: !layer.visible });
  }, [layers, updateLayer]);

  const reorderLayers = useCallback(async (canvasId: string, layerId: string, newOrder: number) => {
    await updateLayer(canvasId, layerId, { order: newOrder });
    // Reload to get updated orders
    await loadLayers(canvasId);
  }, [updateLayer, loadLayers]);

  const getActiveLayer = useCallback(() => {
    return layers.find((l) => l.id === activeLayerId);
  }, [layers, activeLayerId]);

  const createDefaultLayerIfNeeded = useCallback(async (canvasId: string) => {
    if (layers.length === 0) {
      await createLayer(canvasId, `${DEFAULT_LAYER_NAME_PREFIX} 1`);
    }
  }, [layers.length, createLayer]);

  return {
    layers,
    activeLayerId,
    isLoading,
    error,
    canCreateLayer,
    loadLayers,
    createLayer,
    selectLayer,
    updateLayer,
    deleteLayer,
    toggleLayerVisibility,
    reorderLayers,
    getActiveLayer,
    createDefaultLayerIfNeeded,
  };
}
