import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useShare } from './useShare';

// Mock fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock navigator.share
const mockShare = vi.fn();
Object.defineProperty(navigator, 'share', {
  value: mockShare,
  writable: true,
  configurable: true,
});

// Mock navigator.clipboard
const mockWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

// Store original share - bind to navigator to avoid unbound-method error
const originalShare = navigator.share?.bind(navigator);

describe('useShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockShare.mockReset();
    mockWriteText.mockReset();
    // Restore share mock by default
    Object.defineProperty(navigator, 'share', {
      value: mockShare,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    // Restore original
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      writable: true,
      configurable: true,
    });
  });

  describe('canShare', () => {
    it('should return true when Web Share API is available', () => {
      const { result } = renderHook(() => useShare());
      expect(result.current.canShare).toBe(true);
    });
  });

  describe('share', () => {
    it('should save share state to API before sharing', async () => {
      const mockCanvas = {
        id: 'canvas123',
        centerLat: 35.6762,
        centerLng: 139.6503,
        zoom: 15,
        shareLat: 35.6762,
        shareLng: 139.6503,
        shareZoom: 15,
        createdAt: '',
        updatedAt: '',
        tileCount: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCanvas),
      });

      mockShare.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('canvas123', {
          lat: 35.6762,
          lng: 139.6503,
          zoom: 15,
        });
      });

      // Verify API was called to save share state
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/canvas/canvas123',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shareLat: 35.6762,
            shareLng: 139.6503,
            shareZoom: 15,
          }),
        })
      );
    });

    it('should call Web Share API with correct URL', async () => {
      const mockCanvas = {
        id: 'canvas123',
        shareLat: 35.6762,
        shareLng: 139.6503,
        shareZoom: 15,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCanvas),
      });

      mockShare.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('canvas123', {
          lat: 35.6762,
          lng: 139.6503,
          zoom: 15,
        });
      });

      expect(mockShare).toHaveBeenCalledWith({
        title: 'おえかきマップ',
        url: expect.stringContaining('/canvas123') as string,
      });
    });

    it('should set isSharing to true while sharing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      // Create a promise we can control
      let resolveShare: (() => void) | undefined;
      const sharePromise = new Promise<void>((resolve) => {
        resolveShare = resolve;
      });
      mockShare.mockReturnValueOnce(sharePromise);

      const { result } = renderHook(() => useShare());

      expect(result.current.isSharing).toBe(false);

      act(() => {
        void result.current.share('canvas123', {
          lat: 35.6762,
          lng: 139.6503,
          zoom: 15,
        });
      });

      // Wait for isSharing to become true
      await waitFor(() => {
        expect(result.current.isSharing).toBe(true);
      });

      // Resolve the share
      await act(async () => {
        if (resolveShare) {
          resolveShare();
        }
        await sharePromise;
      });

      await waitFor(() => {
        expect(result.current.isSharing).toBe(false);
      });
    });

    it('should set error when API call fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('canvas123', {
          lat: 35.6762,
          lng: 139.6503,
          zoom: 15,
        });
      });

      expect(result.current.error).toBe('共有状態の保存に失敗しました');
    });

    it('should set error when share is cancelled by user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      // User cancelled share
      const abortError = new Error('Share cancelled');
      abortError.name = 'AbortError';
      mockShare.mockRejectedValueOnce(abortError);

      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('canvas123', {
          lat: 35.6762,
          lng: 139.6503,
          zoom: 15,
        });
      });

      // AbortError should not set an error state (user cancelled intentionally)
      expect(result.current.error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear the error state', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('canvas123', {
          lat: 35.6762,
          lng: 139.6503,
          zoom: 15,
        });
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('clipboard fallback (desktop)', () => {
    beforeEach(() => {
      // Remove Web Share API to simulate desktop browser
      Object.defineProperty(navigator, 'share', {
        value: undefined,
        writable: true,
        configurable: true,
      });
    });

    it('should return false for canShare when Web Share API is unavailable', () => {
      const { result } = renderHook(() => useShare());
      expect(result.current.canShare).toBe(false);
    });

    it('should copy URL to clipboard when Web Share API is unavailable', async () => {
      const mockCanvas = {
        id: 'canvas123',
        shareLat: 35.6762,
        shareLng: 139.6503,
        shareZoom: 15,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCanvas),
      });

      mockWriteText.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('canvas123', {
          lat: 35.6762,
          lng: 139.6503,
          zoom: 15,
        });
      });

      // Should have called clipboard API
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('/canvas123')
      );
    });

    it('should set copied state to true after clipboard copy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      mockWriteText.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('canvas123', {
          lat: 35.6762,
          lng: 139.6503,
          zoom: 15,
        });
      });

      expect(result.current.copied).toBe(true);
    });

    it('should set error when clipboard copy fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      mockWriteText.mockRejectedValueOnce(new Error('Clipboard error'));

      const { result } = renderHook(() => useShare());

      await act(async () => {
        await result.current.share('canvas123', {
          lat: 35.6762,
          lng: 139.6503,
          zoom: 15,
        });
      });

      expect(result.current.error).toBe('URLのコピーに失敗しました');
    });
  });
});
