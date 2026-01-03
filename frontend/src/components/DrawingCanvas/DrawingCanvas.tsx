import { useRef, useEffect, useCallback } from 'react';
import type { Point, DrawingState } from '../../types';

interface DrawingCanvasProps {
  width: number;
  height: number;
  color: string;
  thickness: number;
  mode: DrawingState['mode'];
  onStrokeComplete?: (imageData: ImageData) => void;
  onDirtyTiles?: (tiles: Set<string>) => void;
}

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

  // Get canvas context
  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  // Get point from event
  const getPoint = useCallback(
    (e: MouseEvent | TouchEvent): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ('touches' in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0]?.clientX ?? 0;
        clientY = e.touches[0]?.clientY ?? 0;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  // Mark tile as dirty
  const markDirtyTile = useCallback((x: number, y: number) => {
    // Calculate tile coordinates (256x256 tiles)
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

      // Mark affected tiles as dirty
      markDirtyTile(from.x, from.y);
      markDirtyTile(to.x, to.y);
    },
    [getContext, color, thickness, mode, markDirtyTile]
  );

  // Handle pointer down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (mode === 'navigate') return;

      e.preventDefault();
      isDrawingRef.current = true;
      dirtyTilesRef.current.clear();

      const point = getPoint(e.nativeEvent);
      if (point) {
        lastPointRef.current = point;
        markDirtyTile(point.x, point.y);
      }
    },
    [mode, getPoint, markDirtyTile]
  );

  // Handle pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current || mode === 'navigate') return;

      e.preventDefault();
      const point = getPoint(e.nativeEvent);

      if (point && lastPointRef.current) {
        drawLine(lastPointRef.current, point);
        lastPointRef.current = point;
      }
    },
    [mode, getPoint, drawLine]
  );

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    lastPointRef.current = null;

    // Notify about dirty tiles
    if (dirtyTilesRef.current.size > 0) {
      onDirtyTiles?.(new Set(dirtyTilesRef.current));
    }

    // Get image data for stroke
    const ctx = getContext();
    if (ctx && onStrokeComplete) {
      const imageData = ctx.getImageData(0, 0, width, height);
      onStrokeComplete(imageData);
    }
  }, [getContext, width, height, onStrokeComplete, onDirtyTiles]);

  // Expose clear function via ref would be here if needed
  // const clear = useCallback(() => {
  //   const ctx = getContext();
  //   if (ctx) {
  //     ctx.clearRect(0, 0, width, height);
  //   }
  // }, [getContext, width, height]);

  // Resize canvas when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [width, height]);

  // Pointer event styles based on mode
  const pointerEvents = mode === 'navigate' ? 'none' : 'auto';
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
        pointerEvents,
        cursor,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
