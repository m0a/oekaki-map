import { useState, useCallback, useMemo } from 'react';
import type L from 'leaflet';
import { api } from '../services/api';
import { captureMapScreenshot } from '../services/previewGenerator';
import { reverseGeocode, getLocationLabel } from '../utils/geocoding';
import type { StrokeData } from '../types';

interface SharePosition {
  lat: number;
  lng: number;
  zoom: number;
}

interface ShareOptions {
  /** Map instance for screenshot capture */
  map?: L.Map | null;
  /** Drawing canvas element containing saved tiles */
  drawingCanvas?: HTMLCanvasElement | null;
  /** Stroke data to include in screenshot (current session strokes) */
  strokes?: StrokeData[];
  /** Visible layer IDs to filter strokes */
  visibleLayerIds?: string[];
  /** Skip OGP preview generation (for testing or when map is unavailable) */
  skipPreview?: boolean;
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
  /** Current progress message */
  progress: string | null;
  /** Share the current position */
  share: (canvasId: string, position: SharePosition, options?: ShareOptions) => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Hook for sharing canvas URLs via Web Share API
 * Falls back to clipboard copy on desktop browsers
 * Generates OGP preview image before sharing (if map is provided)
 * Saves current position to DB before triggering share
 */
export function useShare(): UseShareReturn {
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Check if Web Share API is available (computed each render for testing)
  const canShare = useMemo(() => {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }, []);

  const share = useCallback(async (
    canvasId: string,
    position: SharePosition,
    options: ShareOptions = {}
  ) => {
    const { map, drawingCanvas, strokes, visibleLayerIds, skipPreview = false } = options;

    setIsSharing(true);
    setError(null);
    setCopied(false);
    setProgress(null);

    // Check share capability at call time (important for testing)
    const hasShareApi = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    try {
      // Generate OGP preview if map is available
      if (map && !skipPreview) {
        try {
          setProgress('プレビュー画像を生成中...');

          // Capture map screenshot with drawing canvas and strokes overlay
          const screenshotOptions: Parameters<typeof captureMapScreenshot>[1] = {};
          if (drawingCanvas) {
            screenshotOptions.drawingCanvas = drawingCanvas;
          }
          if (strokes) {
            screenshotOptions.strokes = strokes;
          }
          if (visibleLayerIds) {
            screenshotOptions.visibleLayerIds = visibleLayerIds;
          }
          const screenshot = await captureMapScreenshot(map, screenshotOptions);

          if (screenshot) {
            setProgress('地名を取得中...');

            // Get place name from reverse geocoding
            const geocodeResult = await reverseGeocode(position.lat, position.lng);
            const placeName = getLocationLabel(geocodeResult, position.lat, position.lng);

            setProgress('プレビューをアップロード中...');

            // Upload OGP image
            // NOTE: Keeps manual fetch for FormData upload (Hono RPC 4.6.0 limitation)
            // See: specs/009-hono-rpc-migration/spec.md - FormData endpoints
            await api.ogp.upload(canvasId, screenshot, placeName);
          }
        } catch (previewError) {
          // Log but don't fail share if preview generation fails
          console.warn('Failed to generate OGP preview:', previewError);
        }
      }

      setProgress('共有URLを準備中...');

      // Save share state to DB
      await api.canvas.updateShareState(canvasId, {
        shareLat: position.lat,
        shareLng: position.lng,
        shareZoom: position.zoom,
      });

      // Generate share URL (matches /c/:canvasId pattern in main.tsx)
      const shareUrl = `${window.location.origin}/c/${canvasId}`;

      setProgress(null);

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
      setProgress(null);
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
    progress,
    share,
    clearError,
  };
}
