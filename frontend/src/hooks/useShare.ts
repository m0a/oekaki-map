import { useState, useCallback, useMemo } from 'react';
import { api } from '../services/api';

interface SharePosition {
  lat: number;
  lng: number;
  zoom: number;
}

interface UseShareReturn {
  /** Whether Web Share API is available */
  canShare: boolean;
  /** Whether a share operation is in progress */
  isSharing: boolean;
  /** Whether URL was copied to clipboard (for desktop fallback) */
  copied: boolean;
  /** Error message if share failed */
  error: string | null;
  /** Share the current position */
  share: (canvasId: string, position: SharePosition) => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Hook for sharing canvas URLs via Web Share API
 * Falls back to clipboard copy on desktop browsers
 * Saves current position to DB before triggering share
 */
export function useShare(): UseShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if Web Share API is available (computed each render for testing)
  const canShare = useMemo(() => {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }, []);

  const share = useCallback(async (canvasId: string, position: SharePosition) => {
    setIsSharing(true);
    setError(null);
    setCopied(false);

    // Check share capability at call time (important for testing)
    const hasShareApi = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    try {
      // Save share state to DB first
      await api.canvas.updateShareState(canvasId, {
        shareLat: position.lat,
        shareLng: position.lng,
        shareZoom: position.zoom,
      });

      // Generate share URL
      const shareUrl = `${window.location.origin}/${canvasId}`;

      // Use Web Share API if available (mobile)
      if (hasShareApi) {
        await navigator.share({
          title: 'おえかきマップ',
          url: shareUrl,
        });
      } else {
        // Fallback to clipboard copy (desktop)
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
        } catch {
          setError('URLのコピーに失敗しました');
        }
      }
    } catch (err) {
      // AbortError means user cancelled - not an error
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled, no error to show
        return;
      }

      // Check if it's an API error vs share error
      if (err instanceof Error) {
        setError('共有状態の保存に失敗しました');
      } else {
        setError('共有に失敗しました');
      }
    } finally {
      setIsSharing(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    canShare,
    isSharing,
    copied,
    error,
    share,
    clearError,
  };
}
