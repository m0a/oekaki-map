import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPosition, DrawingState, StrokeData } from '../../types';
import { loadTilesToCanvas } from '../../utils/tiles';
import { api } from '../../services/api';

interface TileInfo {
  z: number;
  x: number;
  y: number;
}

interface MapWithDrawingProps {
  position?: MapPosition;
  onPositionChange?: (position: MapPosition) => void;
  drawingState: DrawingState;
  onStrokeEnd?: (canvas: HTMLCanvasElement, bounds: L.LatLngBounds, zoom: number, strokeData?: StrokeData) => void;
  onCanvasOriginInit?: (origin: L.LatLng, zoom: number) => void;
  tiles?: TileInfo[] | undefined;
  canvasId?: string | undefined;
  onFlushSave?: () => Promise<void>;
  strokes?: StrokeData[];
}

// Default position: Tokyo, Japan
const DEFAULT_POSITION: MapPosition = {
  lat: 35.6812,
  lng: 139.7671,
  zoom: 18,
};

// Drawable zoom range
const MIN_DRAWABLE_ZOOM = 16;
const MAX_DRAWABLE_ZOOM = 19;

export function MapWithDrawing({
  position = DEFAULT_POSITION,
  onPositionChange,
  drawingState,
  onStrokeEnd,
  onCanvasOriginInit,
  tiles,
  canvasId,
  onFlushSave,
  strokes,
}: MapWithDrawingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Current zoom level state
  const [currentZoom, setCurrentZoom] = useState(position.zoom);
  const isDrawableZoom = currentZoom >= MIN_DRAWABLE_ZOOM && currentZoom <= MAX_DRAWABLE_ZOOM;

  // Drawing state
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Current stroke points for undo/redo
  const currentStrokePointsRef = useRef<Array<{ x: number; y: number }>>([]);

  // Canvas origin (updated on map move)
  const canvasOriginRef = useRef<L.LatLng | null>(null);
  const canvasZoomRef = useRef<number>(18);

  // Get canvas context
  const getContext = useCallback(() => {
    if (!canvasRef.current) return null;
    return canvasRef.current.getContext('2d');
  }, []);

  // Convert screen point to canvas point (simple: canvas = viewport)
  const screenToCanvas = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  // Draw a line on the canvas
  const drawLine = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = getContext();
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = drawingState.mode === 'erase' ? 'rgba(0,0,0,1)' : drawingState.color;
    ctx.lineWidth = drawingState.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (drawingState.mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.stroke();
  }, [getContext, drawingState.color, drawingState.thickness, drawingState.mode]);

  // Clear canvas and reload tiles for current view
  const reloadTilesForCurrentView = useCallback(async () => {
    if (!canvasRef.current || !mapRef.current || !canvasId) return;

    // Flush any pending saves before reloading
    if (onFlushSave) {
      await onFlushSave();
    }

    const map = mapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Update canvas origin to current center
    const center = map.getCenter();
    const zoom = map.getZoom();
    canvasOriginRef.current = center;
    canvasZoomRef.current = zoom;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get visible bounds
    const bounds = map.getBounds();
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();

    // Fetch tiles for all drawable zoom levels (16-19) to handle zoom changes
    const allTileImages: Array<{ z: number; x: number; y: number; image: HTMLImageElement }> = [];

    try {
      for (let tileZoom = MIN_DRAWABLE_ZOOM; tileZoom <= MAX_DRAWABLE_ZOOM; tileZoom++) {
        // Calculate tile range for this zoom level
        const n = Math.pow(2, tileZoom);
        const minX = Math.floor(((nw.lng + 180) / 360) * n);
        const maxX = Math.floor(((se.lng + 180) / 360) * n);
        const nwLatRad = (nw.lat * Math.PI) / 180;
        const seLatRad = (se.lat * Math.PI) / 180;
        const minY = Math.floor(((1 - Math.log(Math.tan(nwLatRad) + 1 / Math.cos(nwLatRad)) / Math.PI) / 2) * n);
        const maxY = Math.floor(((1 - Math.log(Math.tan(seLatRad) + 1 / Math.cos(seLatRad)) / Math.PI) / 2) * n);

        const response = await api.tiles.getForArea(canvasId, tileZoom, minX, maxX, minY, maxY);

        if (response.tiles && response.tiles.length > 0) {
          // Load tile images
          for (const tile of response.tiles) {
            // Add cache buster to ensure we get the latest version
            const imageUrl = api.tiles.getImageUrl(canvasId, tile.z, tile.x, tile.y) + `?t=${Date.now()}`;
            try {
              const image = new Image();
              image.crossOrigin = 'anonymous';
              await new Promise<void>((resolve, reject) => {
                image.onload = () => resolve();
                image.onerror = () => reject(new Error(`Failed to load tile`));
                image.src = imageUrl;
              });
              allTileImages.push({ ...tile, image });
            } catch {
              // Skip failed tiles
            }
          }
        }
      }

      if (allTileImages.length > 0 && canvasOriginRef.current) {
        // Use current zoom for tile loading - loadTilesToCanvas handles scaling
        const roundedZoom = Math.round(zoom);
        loadTilesToCanvas(canvas, canvasOriginRef.current, roundedZoom, allTileImages);
      }
    } catch (err) {
      console.error('Failed to reload tiles:', err);
    }
  }, [canvasId, onFlushSave]);

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (drawingState.mode === 'navigate') return;
    if (!isDrawableZoom) return;

    e.preventDefault();
    e.stopPropagation();

    isDrawingRef.current = true;
    currentStrokePointsRef.current = [];

    const point = screenToCanvas(e.clientX, e.clientY);
    if (point) {
      lastPointRef.current = point;
      currentStrokePointsRef.current.push(point);

      // Draw a dot
      const ctx = getContext();
      if (ctx) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, drawingState.thickness / 2, 0, Math.PI * 2);
        ctx.fillStyle = drawingState.mode === 'erase' ? 'rgba(0,0,0,1)' : drawingState.color;
        if (drawingState.mode === 'erase') {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fill();
      }
    }
  }, [drawingState, screenToCanvas, getContext, isDrawableZoom, currentZoom]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || drawingState.mode === 'navigate' || !isDrawableZoom) return;

    e.preventDefault();
    e.stopPropagation();

    const point = screenToCanvas(e.clientX, e.clientY);
    if (point && lastPointRef.current) {
      drawLine(lastPointRef.current, point);
      lastPointRef.current = point;
      currentStrokePointsRef.current.push(point);
    }
  }, [drawingState.mode, screenToCanvas, drawLine, isDrawableZoom]);

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    lastPointRef.current = null;

    // Notify about stroke end
    if (canvasRef.current && mapRef.current && canvasOriginRef.current && onStrokeEnd) {
      const map = mapRef.current;
      const bounds = map.getBounds();
      const zoom = map.getZoom();

      // Create stroke data for undo/redo
      const strokeData: StrokeData = {
        id: crypto.randomUUID(),
        points: [...currentStrokePointsRef.current],
        color: drawingState.color,
        thickness: drawingState.thickness,
        mode: drawingState.mode === 'erase' ? 'erase' : 'draw',
        timestamp: Date.now(),
        canvasOrigin: {
          lat: canvasOriginRef.current.lat,
          lng: canvasOriginRef.current.lng,
        },
        zoom: zoom,
      };

      onStrokeEnd(canvasRef.current, bounds, zoom, strokeData);
    }

    currentStrokePointsRef.current = [];
  }, [onStrokeEnd, drawingState.color, drawingState.thickness, drawingState.mode]);

  // Update canvas size to match container
  const updateCanvasSize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const canvas = canvasRef.current;

    // Only resize if dimensions changed
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }, []);

  // Initialize map and canvas
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Create map
    const map = L.map(containerRef.current, {
      center: [position.lat, position.lng],
      zoom: position.zoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Add grayscale tile layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      className: 'grayscale-tiles',
    }).addTo(map);

    mapRef.current = map;

    // Set initial canvas origin
    canvasOriginRef.current = map.getCenter();
    canvasZoomRef.current = map.getZoom();

    // Notify parent about canvas origin
    onCanvasOriginInit?.(canvasOriginRef.current, canvasZoomRef.current);

    // Create canvas element (positioned over the map)
    const canvas = document.createElement('canvas');
    const rect = containerRef.current.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';

    containerRef.current.appendChild(canvas);
    canvasRef.current = canvas;

    // Update zoom state
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // On map move end, update position
    map.on('moveend', () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      setCurrentZoom(zoom);

      // Update canvas origin
      canvasOriginRef.current = center;
      canvasZoomRef.current = zoom;

      onPositionChange?.({ lat: center.lat, lng: center.lng, zoom });
    });

    // Handle window resize
    const handleResize = () => {
      updateCanvasSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
      map.remove();
      mapRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  // Update map interactivity based on drawing mode
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    if (drawingState.mode === 'navigate') {
      map.dragging.enable();
      map.touchZoom.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
    }
  }, [drawingState.mode]);

  // Reload tiles when switching to navigate mode (after drawing)
  useEffect(() => {
    if (drawingState.mode === 'navigate' && canvasId) {
      void reloadTilesForCurrentView();
    }
  }, [drawingState.mode, canvasId, reloadTilesForCurrentView]);

  // Reload tiles after map move in navigate mode
  useEffect(() => {
    if (!mapRef.current || drawingState.mode !== 'navigate' || !canvasId) return;

    const handleMoveEnd = () => {
      void reloadTilesForCurrentView();
    };

    const map = mapRef.current;
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [drawingState.mode, canvasId, reloadTilesForCurrentView]);

  // Update position from props
  useEffect(() => {
    if (!mapRef.current) return;

    const currentCenter = mapRef.current.getCenter();
    const currentMapZoom = mapRef.current.getZoom();

    if (
      Math.abs(currentCenter.lat - position.lat) > 0.0001 ||
      Math.abs(currentCenter.lng - position.lng) > 0.0001 ||
      currentMapZoom !== position.zoom
    ) {
      mapRef.current.setView([position.lat, position.lng], position.zoom, { animate: false });
    }
  }, [position.lat, position.lng, position.zoom]);

  // Load initial tiles when tiles and canvasId are provided
  useEffect(() => {
    if (!tiles || tiles.length === 0 || !canvasId || !canvasRef.current || !canvasOriginRef.current) return;

    const loadInitialTiles = async () => {
      const tileImages: Array<{ z: number; x: number; y: number; image: HTMLImageElement }> = [];

      for (const tile of tiles) {
        const imageUrl = api.tiles.getImageUrl(canvasId, tile.z, tile.x, tile.y);
        try {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`Failed to load tile ${tile.z}/${tile.x}/${tile.y}`));
            image.src = imageUrl;
          });
          tileImages.push({ ...tile, image });
        } catch (err) {
          console.error('Failed to load tile:', err);
        }
      }

      if (tileImages.length > 0 && canvasRef.current && canvasOriginRef.current) {
        // Use rounded zoom for tile loading (tiles are stored at integer zoom levels)
        const roundedZoom = Math.round(canvasZoomRef.current);
        loadTilesToCanvas(canvasRef.current, canvasOriginRef.current, roundedZoom, tileImages);
      }
    };

    void loadInitialTiles();
  }, [tiles, canvasId]);

  // Redraw strokes from history (for undo/redo)
  const redrawStrokes = useCallback((strokesData: StrokeData[]) => {
    const ctx = getContext();
    if (!ctx || !canvasRef.current) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Redraw each stroke
    for (const stroke of strokesData) {
      if (stroke.points.length === 0) continue;

      ctx.beginPath();
      ctx.strokeStyle = stroke.mode === 'erase' ? 'rgba(0,0,0,1)' : stroke.color;
      ctx.lineWidth = stroke.thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.mode === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      const firstPoint = stroke.points[0];
      if (!firstPoint) continue;

      if (stroke.points.length === 1) {
        // Single point - draw a dot
        ctx.beginPath();
        ctx.arc(firstPoint.x, firstPoint.y, stroke.thickness / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.mode === 'erase' ? 'rgba(0,0,0,1)' : stroke.color;
        ctx.fill();
      } else {
        // Multiple points - draw lines
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const point = stroke.points[i];
          if (point) {
            ctx.lineTo(point.x, point.y);
          }
        }
        ctx.stroke();
      }
    }

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  }, [getContext]);

  // Redraw when strokes change (undo/redo)
  useEffect(() => {
    if (strokes !== undefined) {
      redrawStrokes(strokes);
    }
  }, [strokes, redrawStrokes]);

  const cursor = drawingState.mode === 'navigate' ? 'grab' : !isDrawableZoom ? 'not-allowed' : drawingState.mode === 'draw' ? 'crosshair' : 'cell';
  const pointerEvents = drawingState.mode === 'navigate' ? 'none' : 'auto';

  return (
    <>
      <style>{`
        .grayscale-tiles {
          filter: grayscale(100%);
        }
      `}</style>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
      {/* Transparent overlay for capturing pointer events */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents,
          cursor,
          touchAction: 'none',
          zIndex: 500,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {/* Warning messages */}
      {drawingState.mode !== 'navigate' && !isDrawableZoom && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            borderRadius: 8,
            fontSize: 14,
            zIndex: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          {currentZoom < MIN_DRAWABLE_ZOOM
            ? `ズームイン してください (現在: ${currentZoom}, 必要: ${MIN_DRAWABLE_ZOOM}以上)`
            : `ズームアウト してください (現在: ${currentZoom}, 最大: ${MAX_DRAWABLE_ZOOM})`}
        </div>
      )}
    </>
  );
}

export { DEFAULT_POSITION };
