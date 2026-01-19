import { useRef, useEffect, useCallback } from 'react';
import type { Point, DrawingState } from '../../types';
import { logDebug } from '../../lib/errorLogger';

interface DrawingCanvasProps {
  width: number;
  height: number;
  color: string;
  thickness: number;
  mode: DrawingState['mode'];
  onStrokeComplete?: (imageData: ImageData) => void;
  onDirtyTiles?: (tiles: Set<string>) => void;
}

/**
 * DrawingCanvas - Handles drawing on a canvas overlay
 *
 * Key design: Canvas always has pointerEvents: 'none' so Leaflet receives
 * all touch events. We listen to global touch events and only draw when
 * there's exactly 1 finger touching (single-touch drawing mode).
 *
 * This allows:
 * - Single touch: Drawing works (we track the touch position and draw)
 * - Multi-touch: Leaflet handles gestures (pinch zoom, pan)
 */
export function DrawingCanvas({
  width,
  height,
  color,
  thickness,
  mode,
  onStrokeComplete,
  onDirtyTiles,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const dirtyTilesRef = useRef<Set<string>>(new Set());
  const drawStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStartPointRef = useRef<Point | null>(null);

  // Delay before starting to draw (ms) - allows time to detect multi-touch
  const DRAW_START_DELAY = 50;

  // Get canvas context
  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  // Get point from touch event relative to canvas
  const getPointFromTouch = useCallback((touch: Touch): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }, []);

  // Get point from mouse event relative to canvas
  const getPointFromMouse = useCallback((e: MouseEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Mark tile as dirty
  const markDirtyTile = useCallback((x: number, y: number) => {
    const tileX = Math.floor(x / 256);
    const tileY = Math.floor(y / 256);
    const key = `${tileX},${tileY}`;
    dirtyTilesRef.current.add(key);
  }, []);

  // Draw line between two points
  const drawLine = useCallback(
    (from: Point, to: Point) => {
      const ctx = getContext();
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = mode === 'erase' ? 'rgba(0,0,0,1)' : color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (mode === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.stroke();

      markDirtyTile(from.x, from.y);
      markDirtyTile(to.x, to.y);
    },
    [getContext, color, thickness, mode, markDirtyTile]
  );

  // End stroke and notify
  const endStroke = useCallback(() => {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    lastPointRef.current = null;

    if (dirtyTilesRef.current.size > 0) {
      onDirtyTiles?.(new Set(dirtyTilesRef.current));
    }

    const ctx = getContext();
    if (ctx && onStrokeComplete) {
      const imageData = ctx.getImageData(0, 0, width, height);
      onStrokeComplete(imageData);
    }
  }, [getContext, width, height, onStrokeComplete, onDirtyTiles]);

  // Cancel pending draw start
  const cancelPendingDraw = useCallback(() => {
    if (drawStartTimerRef.current) {
      clearTimeout(drawStartTimerRef.current);
      drawStartTimerRef.current = null;
    }
    pendingStartPointRef.current = null;
  }, []);

  // Global touch event handlers
  useEffect(() => {
    if (mode === 'navigate') return;

    const handleTouchStart = (e: TouchEvent) => {
      void logDebug('touchStart', {
        touchCount: e.touches.length,
        mode,
      });

      // Multi-touch detected - cancel any pending draw and don't interfere
      if (e.touches.length >= 2) {
        cancelPendingDraw();
        if (isDrawingRef.current) {
          endStroke();
        }
        return;
      }

      // Single touch - schedule drawing start after delay
      // This gives time for a potential second finger to touch
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (!touch) return;

        const point = getPointFromTouch(touch);
        if (point) {
          pendingStartPointRef.current = point;

          // Clear any existing timer
          cancelPendingDraw();

          // Schedule draw start
          drawStartTimerRef.current = setTimeout(() => {
            if (pendingStartPointRef.current) {
              isDrawingRef.current = true;
              dirtyTilesRef.current.clear();
              lastPointRef.current = pendingStartPointRef.current;
              markDirtyTile(pendingStartPointRef.current.x, pendingStartPointRef.current.y);
              pendingStartPointRef.current = null;
            }
            drawStartTimerRef.current = null;
          }, DRAW_START_DELAY);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Multi-touch - cancel drawing and let Leaflet handle gesture
      if (e.touches.length >= 2) {
        cancelPendingDraw();
        if (isDrawingRef.current) {
          endStroke();
        }
        return;
      }

      // Single touch move
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (!touch) return;

        const point = getPointFromTouch(touch);

        // If drawing hasn't started yet but we're moving, start immediately
        // (user is clearly doing a single-touch drag)
        if (!isDrawingRef.current && pendingStartPointRef.current) {
          cancelPendingDraw();
          isDrawingRef.current = true;
          dirtyTilesRef.current.clear();
          lastPointRef.current = point;
          if (point) markDirtyTile(point.x, point.y);
        }

        // Draw if we're in drawing state
        if (isDrawingRef.current && point && lastPointRef.current) {
          drawLine(lastPointRef.current, point);
          lastPointRef.current = point;
          // Prevent scrolling while drawing
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      void logDebug('touchEnd', {
        touchCount: e.touches.length,
        isDrawing: isDrawingRef.current,
      });

      // Cancel pending draw if finger lifted before delay
      cancelPendingDraw();

      // If all fingers lifted, end stroke
      if (e.touches.length === 0) {
        endStroke();
      }
    };

    // Add listeners to document to capture all touch events
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      cancelPendingDraw();
    };
  }, [mode, getPointFromTouch, drawLine, endStroke, markDirtyTile, cancelPendingDraw, DRAW_START_DELAY]);

  // Mouse event handlers (for desktop)
  useEffect(() => {
    if (mode === 'navigate') return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only handle left click
      if (e.button !== 0) return;

      const point = getPointFromMouse(e);
      if (point) {
        isDrawingRef.current = true;
        dirtyTilesRef.current.clear();
        lastPointRef.current = point;
        markDirtyTile(point.x, point.y);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;

      const point = getPointFromMouse(e);
      if (point && lastPointRef.current) {
        drawLine(lastPointRef.current, point);
        lastPointRef.current = point;
      }
    };

    const handleMouseUp = () => {
      endStroke();
    };

    // Add mouse listeners to document
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [mode, getPointFromMouse, drawLine, endStroke, markDirtyTile]);

  // Resize canvas when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [width, height]);

  const cursor = mode === 'draw' ? 'crosshair' : mode === 'erase' ? 'cell' : 'default';

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        // Always let events pass through to map - we handle drawing via global listeners
        pointerEvents: 'none',
        cursor,
        // Let browser handle all touch actions - we intercept selectively
        touchAction: 'auto',
      }}
    />
  );
}
