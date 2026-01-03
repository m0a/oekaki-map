import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayers } from './useLayers';

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useLayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadLayers', () => {
    it('should load layers for a canvas', async () => {
      const mockLayers = [
        { id: 'layer1', canvasId: 'canvas1', name: 'レイヤー 1', order: 0, visible: true, createdAt: '', updatedAt: '' },
        { id: 'layer2', canvasId: 'canvas1', name: 'レイヤー 2', order: 1, visible: true, createdAt: '', updatedAt: '' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ layers: mockLayers }),
      });

      const { result } = renderHook(() => useLayers());

      await act(async () => {
        await result.current.loadLayers('canvas1');
      });

      expect(result.current.layers).toEqual(mockLayers);
      expect(result.current.activeLayerId).toBe('layer1'); // First layer selected
      expect(result.current.isLoading).toBe(false);
    });

    it('should set error on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useLayers());

      await act(async () => {
        await result.current.loadLayers('canvas1');
      });

      expect(result.current.error).toBe('レイヤーの読み込みに失敗しました');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('createLayer', () => {
    it('should create a new layer', async () => {
      const newLayer = { id: 'layer1', canvasId: 'canvas1', name: 'レイヤー 1', order: 0, visible: true, createdAt: '', updatedAt: '' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ layer: newLayer }),
      });

      const { result } = renderHook(() => useLayers());

      await act(async () => {
        await result.current.createLayer('canvas1');
      });

      expect(result.current.layers).toContainEqual(newLayer);
      expect(result.current.activeLayerId).toBe('layer1'); // New layer selected
    });

    it('should create layer with custom name', async () => {
      const newLayer = { id: 'layer1', canvasId: 'canvas1', name: '背景', order: 0, visible: true, createdAt: '', updatedAt: '' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ layer: newLayer }),
      });

      const { result } = renderHook(() => useLayers());

      await act(async () => {
        await result.current.createLayer('canvas1', '背景');
      });

      const firstLayer = result.current.layers[0];
      expect(firstLayer?.name).toBe('背景');
    });
  });

  describe('selectLayer', () => {
    it('should select a layer', async () => {
      const mockLayers = [
        { id: 'layer1', canvasId: 'canvas1', name: 'レイヤー 1', order: 0, visible: true, createdAt: '', updatedAt: '' },
        { id: 'layer2', canvasId: 'canvas1', name: 'レイヤー 2', order: 1, visible: true, createdAt: '', updatedAt: '' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ layers: mockLayers }),
      });

      const { result } = renderHook(() => useLayers());

      await act(async () => {
        await result.current.loadLayers('canvas1');
      });

      act(() => {
        result.current.selectLayer('layer2');
      });

      expect(result.current.activeLayerId).toBe('layer2');
    });
  });

  describe('canCreateLayer', () => {
    it('should return true when under max layers', async () => {
      const mockLayers = Array.from({ length: 5 }, (_, i) => ({
        id: `layer${i}`,
        canvasId: 'canvas1',
        name: `レイヤー ${i + 1}`,
        order: i,
        visible: true,
        createdAt: '',
        updatedAt: '',
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ layers: mockLayers }),
      });

      const { result } = renderHook(() => useLayers());

      await act(async () => {
        await result.current.loadLayers('canvas1');
      });

      expect(result.current.canCreateLayer).toBe(true);
    });

    it('should return false when at max layers', async () => {
      const mockLayers = Array.from({ length: 10 }, (_, i) => ({
        id: `layer${i}`,
        canvasId: 'canvas1',
        name: `レイヤー ${i + 1}`,
        order: i,
        visible: true,
        createdAt: '',
        updatedAt: '',
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ layers: mockLayers }),
      });

      const { result } = renderHook(() => useLayers());

      await act(async () => {
        await result.current.loadLayers('canvas1');
      });

      expect(result.current.canCreateLayer).toBe(false);
    });
  });
});
