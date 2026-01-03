import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGeolocation } from './useGeolocation';

// Type for geolocation callbacks
type PositionCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

// Mock navigator.geolocation
const mockGetCurrentPosition = vi.fn() as ReturnType<typeof vi.fn> & {
  (success: PositionCallback, error?: ErrorCallback, options?: PositionOptions): void;
};
const mockGeolocation = {
  getCurrentPosition: mockGetCurrentPosition,
};

Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
  configurable: true,
});

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentPosition.mockReset();
  });

  describe('isSupported', () => {
    it('should return true when Geolocation API is available', () => {
      const { result } = renderHook(() => useGeolocation());
      expect(result.current.isSupported).toBe(true);
    });
  });

  describe('getCurrentPosition', () => {
    it('should return position when geolocation succeeds', async () => {
      const mockPosition = {
        coords: {
          latitude: 35.6762,
          longitude: 139.6503,
        },
      } as GeolocationPosition;

      mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
        success(mockPosition);
      });

      const { result } = renderHook(() => useGeolocation());

      let position: { lat: number; lng: number } | null = null;
      await act(async () => {
        position = await result.current.getCurrentPosition();
      });

      expect(position).toEqual({
        lat: 35.6762,
        lng: 139.6503,
      });
    });

    it('should set isLoading while getting position', async () => {
      let resolvePosition: PositionCallback | undefined;
      const positionPromise = new Promise<void>((resolve) => {
        mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
          resolvePosition = (pos: GeolocationPosition) => {
            success(pos);
            resolve();
          };
        });
      });

      const { result } = renderHook(() => useGeolocation());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        void result.current.getCurrentPosition();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        if (resolvePosition) {
          resolvePosition({
            coords: { latitude: 35.6762, longitude: 139.6503 },
          } as GeolocationPosition);
        }
        await positionPromise;
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set error when geolocation fails', async () => {
      const mockError = {
        code: 1, // PERMISSION_DENIED
        message: 'User denied Geolocation',
      } as GeolocationPositionError;

      mockGetCurrentPosition.mockImplementation((_success: PositionCallback, error?: ErrorCallback) => {
        if (error) error(mockError);
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.error).toBe('位置情報の取得が拒否されました');
    });

    it('should set error when position is unavailable', async () => {
      const mockError = {
        code: 2, // POSITION_UNAVAILABLE
        message: 'Position unavailable',
      } as GeolocationPositionError;

      mockGetCurrentPosition.mockImplementation((_success: PositionCallback, error?: ErrorCallback) => {
        if (error) error(mockError);
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.error).toBe('位置情報を取得できませんでした');
    });

    it('should set error when request times out', async () => {
      const mockError = {
        code: 3, // TIMEOUT
        message: 'Timeout',
      } as GeolocationPositionError;

      mockGetCurrentPosition.mockImplementation((_success: PositionCallback, error?: ErrorCallback) => {
        if (error) error(mockError);
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.error).toBe('位置情報の取得がタイムアウトしました');
    });
  });

  describe('clearError', () => {
    it('should clear the error state', async () => {
      const mockError = {
        code: 1,
        message: 'User denied Geolocation',
      } as GeolocationPositionError;

      mockGetCurrentPosition.mockImplementation((_success: PositionCallback, error?: ErrorCallback) => {
        if (error) error(mockError);
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        await result.current.getCurrentPosition();
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
