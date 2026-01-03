import { useState, useCallback } from 'react';

interface Position {
  lat: number;
  lng: number;
}

interface UseGeolocationReturn {
  /** Whether Geolocation API is available */
  isSupported: boolean;
  /** Whether a position request is in progress */
  isLoading: boolean;
  /** Error message if geolocation failed */
  error: string | null;
  /** Get the current position */
  getCurrentPosition: () => Promise<Position | null>;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Hook for getting the user's current geolocation
 */
export function useGeolocation(): UseGeolocationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if Geolocation API is available
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const getCurrentPosition = useCallback(async (): Promise<Position | null> => {
    if (!isSupported) {
      setError('お使いのブラウザは位置情報に対応していません');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
    } catch (err) {
      const geoError = err as GeolocationPositionError;

      switch (geoError.code) {
        case 1: // PERMISSION_DENIED
          setError('位置情報の取得が拒否されました');
          break;
        case 2: // POSITION_UNAVAILABLE
          setError('位置情報を取得できませんでした');
          break;
        case 3: // TIMEOUT
          setError('位置情報の取得がタイムアウトしました');
          break;
        default:
          setError('位置情報の取得に失敗しました');
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isSupported,
    isLoading,
    error,
    getCurrentPosition,
    clearError,
  };
}
