import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPosition, DrawingState, StrokeData, TileInfo } from '../../types';
import { getTileBounds, projectToPixel } from '../../utils/tiles';
import { client, callRpc } from '../../services/rpc';
import { useTileCache } from '../../hooks/useTileCache';
import { TILE_DIMENSION } from '../../types';
import { logDebug } from '../../lib/errorLogger';

// Version for debugging
const BUILD_VERSION = '2026-01-19-v16';

interface MapWithDrawingProps {
  position?: MapPosition;
  onPositionChange?: (position: MapPosition) => void;
  drawingState: DrawingState;
  onStrokeEnd?: (canvas: HTMLCanvasElement, bounds: L.LatLngBounds, zoom: number, strokeData?: StrokeData) => void;
  onCanvasOriginInit?: (origin: L.LatLng, zoom: number) => void;
  onMapReady?: (map: L.Map) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  tiles?: TileInfo[] | undefined;
  canvasId?: string | undefined;
  onFlushSave?: () => Promise<void>;
  strokes?: StrokeData[];
  activeLayerId?: string | null;
  visibleLayerIds?: string[];
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
  onMapReady,
  onCanvasReady,
  tiles,
  canvasId,
  onFlushSave,
  strokes,
  activeLayerId,
  visibleLayerIds,
}: MapWithDrawingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Tile cache hook
  const { loadTiles, getCachedTiles, clearCache } = useTileCache();

  // Current zoom level state
  const [currentZoom, setCurrentZoom] = useState(position.zoom);
  const [isMapReady, setIsMapReady] = useState(false);
  const isDrawableZoom = currentZoom >= MIN_DRAWABLE_ZOOM && currentZoom <= MAX_DRAWABLE_ZOOM;

  // Drawing state
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Multi-touch state for detecting pinch/zoom gestures
  const [isMultiTouch, setIsMultiTouch] = useState(false);
  const activePointersRef = useRef<Set<number>>(new Set());
  const wasMultiTouchRef = useRef(false);

  // Delayed draw start to detect multi-touch
  const drawStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPointerRef = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null);
  const DRAW_START_DELAY = 80; // ms to wait before starting draw

  // Track last touch time to ignore synthetic mouse events
  const lastTouchTimeRef = useRef<number>(0);
  const SYNTHETIC_MOUSE_THRESHOLD = 500; // ms - ignore mouse events within this time after touch

  // Current stroke points for undo/redo (stored as geographic coordinates)
  const currentStrokePointsRef = useRef<Array<{ lat: number; lng: number }>>([]);

  // RequestAnimationFrame ID for throttling pointer move events
  const rafIdRef = useRef<number | null>(null);

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

  // Convert canvas point to geographic coordinates
  const canvasToLatLng = useCallback((point: { x: number; y: number }): { lat: number; lng: number } | null => {
    if (!mapRef.current) return null;
    const latLng = mapRef.current.containerPointToLatLng([point.x, point.y]);
    return { lat: latLng.lat, lng: latLng.lng };
  }, []);

  // Convert geographic coordinates to canvas point
  const latLngToCanvas = useCallback((latLng: { lat: number; lng: number }): { x: number; y: number } | null => {
    if (!mapRef.current) return null;
    const point = mapRef.current.latLngToContainerPoint([latLng.lat, latLng.lng]);
    return { x: point.x, y: point.y };
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

  // Clear canvas and reload tiles for current view (uses tile cache)
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

    // Clear cache for this canvas before reloading (to get fresh tiles after save)
    clearCache(canvasId);

    // Get visible bounds
    const bounds = map.getBounds();
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();

    // Collect all tiles to load
    const tilesToLoad: TileInfo[] = [];

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

        const { data, error } = await callRpc<{ tiles: TileInfo[] }>(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          client.api.canvas[':id'].tiles.$get({
            param: { id: canvasId },
            query: {
              z: String(tileZoom),
              minX: String(minX),
              maxX: String(maxX),
              minY: String(minY),
              maxY: String(maxY),
            },
          })
        );

        if (!error && data && data.tiles && data.tiles.length > 0) {
          // Add tiles to load list with updatedAt for cache versioning
          for (const tile of data.tiles) {
            const tileInfo: TileInfo = { z: tile.z, x: tile.x, y: tile.y };
            if (tile.updatedAt) {
              tileInfo.updatedAt = tile.updatedAt;
            }
            tilesToLoad.push(tileInfo);
          }
        }
      }

      // Load tiles using cache (with cache buster for fresh data after save)
      if (tilesToLoad.length > 0) {
        // Add cache buster timestamp for fresh data
        const tilesWithCacheBuster = tilesToLoad.map(t => ({
          ...t,
          updatedAt: t.updatedAt || String(Date.now()),
        }));
        await loadTiles(canvasId, tilesWithCacheBuster);
      }
    } catch (err) {
      console.error('Failed to reload tiles:', err);
    }
  }, [canvasId, onFlushSave, clearCache, loadTiles]);

  // Cancel pending draw start
  const cancelPendingDraw = useCallback(() => {
    if (drawStartTimerRef.current || pendingPointerRef.current) {
      void logDebug('cancelPendingDraw', {
        version: BUILD_VERSION,
        hadTimer: !!drawStartTimerRef.current,
        hadPendingPointer: !!pendingPointerRef.current,
      });
    }
    if (drawStartTimerRef.current) {
      clearTimeout(drawStartTimerRef.current);
      drawStartTimerRef.current = null;
    }
    pendingPointerRef.current = null;
  }, []);

  // Start drawing after delay (called from timer)
  const startDrawingDelayed = useCallback(() => {
    void logDebug('startDrawingDelayed_ENTRY', {
      hasPendingPointer: !!pendingPointerRef.current,
      wasMultiTouch: wasMultiTouchRef.current,
    });

    if (!pendingPointerRef.current) return;
    if (wasMultiTouchRef.current) return;

    const { clientX, clientY } = pendingPointerRef.current;
    pendingPointerRef.current = null;
    drawStartTimerRef.current = null;

    void logDebug('startDrawingDelayed_START', { clientX, clientY });
    isDrawingRef.current = true;
    currentStrokePointsRef.current = [];

    const point = screenToCanvas(clientX, clientY);
    if (point) {
      lastPointRef.current = point;

      const latLng = canvasToLatLng(point);
      if (latLng) {
        currentStrokePointsRef.current.push(latLng);
      }

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
  }, [screenToCanvas, canvasToLatLng, getContext, drawingState.thickness, drawingState.color, drawingState.mode]);

  // Switch to multi-touch mode (cancel drawing, let Leaflet handle gestures)
  const enterMultiTouchMode = useCallback(() => {
    if (wasMultiTouchRef.current) return;

    void logDebug('enterMultiTouchMode', { version: BUILD_VERSION });
    wasMultiTouchRef.current = true;
    cancelPendingDraw();

    // Set React state (for UI updates if needed)
    setIsMultiTouch(true);

    // End current stroke if drawing - SAVE IT FIRST!
    if (isDrawingRef.current) {
      // Cancel any pending animation frame
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      isDrawingRef.current = false;
      lastPointRef.current = null;

      // Save the stroke before clearing!
      if (canvasRef.current && mapRef.current && onStrokeEnd && currentStrokePointsRef.current.length > 0) {
        const map = mapRef.current;
        const bounds = map.getBounds();
        const zoom = map.getZoom();

        const strokeData: StrokeData = {
          id: crypto.randomUUID(),
          layerId: activeLayerId || 'default',
          points: [...currentStrokePointsRef.current],
          color: drawingState.color,
          thickness: drawingState.thickness,
          mode: drawingState.mode === 'erase' ? 'erase' : 'draw',
          timestamp: Date.now(),
          zoom: zoom,
        };

        void logDebug('enterMultiTouchMode_SAVE_STROKE', {
          version: BUILD_VERSION,
          pointCount: strokeData.points.length,
        });

        onStrokeEnd(canvasRef.current, bounds, zoom, strokeData);
      }

      currentStrokePointsRef.current = [];
    }

    // Note: Leaflet's touchZoom is always enabled in draw mode now,
    // so no need to enable it here. Overlay has pointerEvents: 'none'
    // so Leaflet receives touch events directly.
  }, [cancelPendingDraw, onStrokeEnd, activeLayerId, drawingState.color, drawingState.thickness, drawingState.mode]);

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    void logDebug('pointerDown_ENTRY', {
      version: BUILD_VERSION,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      mode: drawingState.mode,
      wasMultiTouch: wasMultiTouchRef.current,
      isMultiTouch,
    });

    // Track active pointers for multi-touch detection
    const previousSize = activePointersRef.current.size;
    activePointersRef.current.add(e.pointerId);
    const newSize = activePointersRef.current.size;

    void logDebug('pointerDown', {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      previousSize,
      newSize,
      mode: drawingState.mode,
    });

    // Detect multi-touch (2+ pointers) via pointer events
    if (newSize >= 2) {
      enterMultiTouchMode();
      return;
    }

    // If in multi-touch mode, don't start drawing
    if (wasMultiTouchRef.current) {
      return;
    }

    if (drawingState.mode === 'navigate') return;
    if (!isDrawableZoom) return;

    // For touch input, let the global touch handler manage drawing
    // This avoids conflicts between overlay pointer events and global touch events
    if (e.pointerType === 'touch') {
      void logDebug('pointerDown_SKIP_TOUCH', {
        version: BUILD_VERSION,
        reason: 'Handled by global touch handler',
      });
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // For mouse/pen, start drawing immediately
    isDrawingRef.current = true;
    currentStrokePointsRef.current = [];

    const point = screenToCanvas(e.clientX, e.clientY);
    if (point) {
      lastPointRef.current = point;

      const latLng = canvasToLatLng(point);
      if (latLng) {
        currentStrokePointsRef.current.push(latLng);
      }

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
  }, [drawingState, screenToCanvas, canvasToLatLng, getContext, isDrawableZoom, enterMultiTouchMode, cancelPendingDraw, startDrawingDelayed, DRAW_START_DELAY]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || drawingState.mode === 'navigate' || !isDrawableZoom) return;

    e.preventDefault();
    e.stopPropagation();

    // Use requestAnimationFrame to throttle drawing for better performance
    // Cancel previous frame if not processed yet
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      // Get coalesced events for smoother drawing on mobile devices
      // Browsers may combine multiple touch events into one, causing gaps in the line
      const coalescedEvents = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];

      for (const event of coalescedEvents) {
        const point = screenToCanvas(event.clientX, event.clientY);
        if (point && lastPointRef.current) {
          drawLine(lastPointRef.current, point);
          lastPointRef.current = point;

          // Store geographic coordinates for undo/redo
          const latLng = canvasToLatLng(point);
          if (latLng) {
            currentStrokePointsRef.current.push(latLng);
          }
        }
      }

      rafIdRef.current = null;
    });
  }, [drawingState.mode, screenToCanvas, canvasToLatLng, drawLine, isDrawableZoom]);

  // Handle pointer up
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Track active pointers
    activePointersRef.current.delete(e.pointerId);
    const remainingPointers = activePointersRef.current.size;

    void logDebug('pointerUp', {
      pointerId: e.pointerId,
      remainingPointers,
      wasMultiTouch: wasMultiTouchRef.current,
    });

    // If all pointers released and was in multi-touch mode, reset
    if (remainingPointers === 0 && wasMultiTouchRef.current) {
      void logDebug('multiTouchEnd', { version: BUILD_VERSION });
      wasMultiTouchRef.current = false;
      setIsMultiTouch(false);
      // No need to restore pointerEvents - overlay always has 'none'
      // No need to disable touchZoom - it stays enabled for next gesture
      return;
    }

    if (!isDrawingRef.current) return;

    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;

    // Notify about stroke end
    if (canvasRef.current && mapRef.current && onStrokeEnd) {
      const map = mapRef.current;
      const bounds = map.getBounds();
      const zoom = map.getZoom();

      // Create stroke data for undo/redo (using geographic coordinates)
      const strokeData: StrokeData = {
        id: crypto.randomUUID(),
        layerId: activeLayerId || 'default',
        points: [...currentStrokePointsRef.current],
        color: drawingState.color,
        thickness: drawingState.thickness,
        mode: drawingState.mode === 'erase' ? 'erase' : 'draw',
        timestamp: Date.now(),
        zoom: zoom,
      };

      onStrokeEnd(canvasRef.current, bounds, zoom, strokeData);
    }

    currentStrokePointsRef.current = [];
  }, [onStrokeEnd, drawingState.color, drawingState.thickness, drawingState.mode, activeLayerId]);

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

    // Notify parent that map is ready
    onMapReady?.(map);

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

    // Notify parent that canvas is ready
    onCanvasReady?.(canvas);

    // Sync canvas transform during pan
    const syncCanvasPan = () => {
      if (!canvasRef.current || !canvasOriginRef.current) return;
      if (canvasZoomRef.current === null) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Where should the canvas origin appear on screen now?
      const originPos = map.latLngToContainerPoint(canvasOriginRef.current);

      // Translate to move canvas center to where origin should be
      const dx = originPos.x - centerX;
      const dy = originPos.y - centerY;

      // Apply transform
      canvas.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    // Hide canvas during zoom (zoom animation is too complex to sync properly)
    const handleZoomStart = () => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = '0';
      }
    };

    // Show canvas after zoom ends (will be redrawn by moveend handler)
    const handleZoomEnd = () => {
      setCurrentZoom(map.getZoom());
      // Canvas will be shown after redraw in moveend handler
    };

    // Listen to events
    map.on('move', syncCanvasPan);
    map.on('zoomstart', handleZoomStart);
    map.on('zoomend', handleZoomEnd);

    // On map move end, update position (transform reset happens after redraw)
    map.on('moveend', () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      setCurrentZoom(zoom);

      // Update canvas origin (transform will be reset after redraw to avoid flicker)
      canvasOriginRef.current = center;
      canvasZoomRef.current = zoom;

      onPositionChange?.({ lat: center.lat, lng: center.lng, zoom });
    });

    // Handle window resize
    const handleResize = () => {
      updateCanvasSize();
    };
    window.addEventListener('resize', handleResize);

    // Mark map as ready for tile loading
    setIsMapReady(true);

    return () => {
      // Cleanup RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

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
  // In draw/erase mode, keep touchZoom enabled so pinch gestures work
  // Drawing is cancelled when multi-touch is detected
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    if (drawingState.mode === 'navigate') {
      map.dragging.enable();
      map.touchZoom.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
    } else {
      // Keep touchZoom enabled for pinch gestures even in draw mode
      // Single-touch drawing is handled by global touch listeners
      // Multi-touch is detected and drawing is cancelled
      map.dragging.disable();
      map.touchZoom.enable(); // Keep enabled for pinch zoom
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
    }
  }, [drawingState.mode]);

  // Global touch event listeners for multi-touch detection AND drawing
  // This handles drawing directly from global touch events because overlay's events
  // may not work correctly after multi-touch due to browser event routing timing
  useEffect(() => {
    if (drawingState.mode === 'navigate') return;

    // Helper to get point from touch
    const getTouchPoint = (touch: Touch): { x: number; y: number } | null => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    };

    // Helper to convert point to LatLng
    const pointToLatLng = (point: { x: number; y: number }): { lat: number; lng: number } | null => {
      if (!mapRef.current) return null;
      const latLng = mapRef.current.containerPointToLatLng([point.x, point.y]);
      return { lat: latLng.lat, lng: latLng.lng };
    };

    const handleGlobalTouchStart = (e: TouchEvent) => {
      // Track touch time to ignore synthetic mouse events
      lastTouchTimeRef.current = Date.now();

      void logDebug('globalTouchStart', {
        version: BUILD_VERSION,
        touchCount: e.touches.length,
        mode: drawingState.mode,
        wasMultiTouch: wasMultiTouchRef.current,
        isDrawing: isDrawingRef.current,
      });

      // Detect multi-touch immediately
      if (e.touches.length >= 2) {
        enterMultiTouchMode();
        return;
      }

      // Single touch after multi-touch ended - start drawing via global handler
      // This bypasses overlay's pointer events which may not work correctly
      if (e.touches.length === 1 && !wasMultiTouchRef.current && !isDrawingRef.current) {
        if (!isDrawableZoom) {
          void logDebug('globalTouchStart_NOT_DRAWABLE_ZOOM', {
            version: BUILD_VERSION,
            isDrawableZoom,
          });
          return;
        }

        const touch = e.touches[0];
        if (!touch) return;

        void logDebug('globalTouchStart_SCHEDULING_DRAW', {
          version: BUILD_VERSION,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });

        // Schedule drawing start after delay (to detect potential multi-touch)
        cancelPendingDraw();
        pendingPointerRef.current = {
          pointerId: -1,
          clientX: touch.clientX,
          clientY: touch.clientY,
        };

        drawStartTimerRef.current = setTimeout(() => {
          void logDebug('globalTouchStart_TIMEOUT_FIRED', {
            version: BUILD_VERSION,
            hasPendingPointer: !!pendingPointerRef.current,
            wasMultiTouch: wasMultiTouchRef.current,
          });

          if (!pendingPointerRef.current || wasMultiTouchRef.current) {
            void logDebug('globalTouchStart_TIMEOUT_CANCELLED', {
              version: BUILD_VERSION,
              hasPendingPointer: !!pendingPointerRef.current,
              wasMultiTouch: wasMultiTouchRef.current,
            });
            pendingPointerRef.current = null;
            drawStartTimerRef.current = null;
            return;
          }

          // Ensure canvas is visible before drawing
          if (canvasRef.current && canvasRef.current.style.opacity !== '1') {
            canvasRef.current.style.opacity = '1';
            canvasRef.current.style.transform = '';
            canvasRef.current.style.transformOrigin = '';
            void logDebug('globalTouchStart_FORCE_SHOW_CANVAS', { version: BUILD_VERSION });
          }

          void logDebug('globalTouchStart_DRAW_START', {
            version: BUILD_VERSION,
            canvasOpacity: canvasRef.current?.style.opacity,
            canvasTransform: canvasRef.current?.style.transform,
            canvasWidth: canvasRef.current?.width,
            canvasHeight: canvasRef.current?.height,
          });

          const point = getTouchPoint({ clientX: pendingPointerRef.current.clientX, clientY: pendingPointerRef.current.clientY } as Touch);
          if (point) {
            isDrawingRef.current = true;
            currentStrokePointsRef.current = [];
            lastPointRef.current = point;

            const latLng = pointToLatLng(point);
            if (latLng) {
              currentStrokePointsRef.current.push(latLng);
            }

            // Draw initial dot
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

          pendingPointerRef.current = null;
          drawStartTimerRef.current = null;
        }, DRAW_START_DELAY);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      // iOS may add second finger during touchmove, not touchstart
      if (e.touches.length >= 2) {
        if (!wasMultiTouchRef.current) {
          void logDebug('multiTouchInMove', { touchCount: e.touches.length });
          enterMultiTouchMode();
        }
        return;
      }

      // If pending draw and moving, start drawing immediately
      if (!isDrawingRef.current && pendingPointerRef.current && e.touches.length === 1) {
        cancelPendingDraw();
        const touch = e.touches[0];
        if (touch && isDrawableZoom) {
          const point = getTouchPoint(touch);
          if (point) {
            // Ensure canvas is visible before drawing
            if (canvasRef.current && canvasRef.current.style.opacity !== '1') {
              canvasRef.current.style.opacity = '1';
              canvasRef.current.style.transform = '';
              canvasRef.current.style.transformOrigin = '';
              void logDebug('globalTouchMove_FORCE_SHOW_CANVAS', { version: BUILD_VERSION });
            }

            void logDebug('globalTouchMove_IMMEDIATE_START', {
              version: BUILD_VERSION,
              canvasOpacity: canvasRef.current?.style.opacity,
              canvasTransform: canvasRef.current?.style.transform,
            });
            isDrawingRef.current = true;
            currentStrokePointsRef.current = [];
            lastPointRef.current = point;

            const latLng = pointToLatLng(point);
            if (latLng) {
              currentStrokePointsRef.current.push(latLng);
            }
          }
        }
      }

      // Continue drawing
      if (isDrawingRef.current && e.touches.length === 1) {
        const touch = e.touches[0];
        if (!touch) return;

        const point = getTouchPoint(touch);
        if (point && lastPointRef.current) {
          drawLine(lastPointRef.current, point);
          lastPointRef.current = point;

          const latLng = pointToLatLng(point);
          if (latLng) {
            currentStrokePointsRef.current.push(latLng);
          }

          // Prevent scrolling while drawing
          e.preventDefault();
        }
      }
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      void logDebug('globalTouchEnd', {
        version: BUILD_VERSION,
        remainingTouches: e.touches.length,
        wasMultiTouch: wasMultiTouchRef.current,
        isDrawing: isDrawingRef.current,
      });

      cancelPendingDraw();

      // When all fingers are lifted
      if (e.touches.length === 0) {
        // Reset multi-touch state
        if (wasMultiTouchRef.current) {
          wasMultiTouchRef.current = false;
          activePointersRef.current.clear();
          setIsMultiTouch(false);
          // No need to restore pointerEvents - overlay always has 'none'
          // No need to disable touchZoom - it stays enabled for next gesture
          void logDebug('multiTouchCleared', { version: BUILD_VERSION, mode: drawingState.mode });
        }

        // End stroke if drawing
        if (isDrawingRef.current) {
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }

          isDrawingRef.current = false;
          lastPointRef.current = null;

          // Notify about stroke end
          if (canvasRef.current && mapRef.current && onStrokeEnd) {
            const map = mapRef.current;
            const bounds = map.getBounds();
            const zoom = map.getZoom();

            const strokeData: StrokeData = {
              id: crypto.randomUUID(),
              layerId: activeLayerId || 'default',
              points: [...currentStrokePointsRef.current],
              color: drawingState.color,
              thickness: drawingState.thickness,
              mode: drawingState.mode === 'erase' ? 'erase' : 'draw',
              timestamp: Date.now(),
              zoom: zoom,
            };

            onStrokeEnd(canvasRef.current, bounds, zoom, strokeData);
          }

          currentStrokePointsRef.current = [];
        }
      }
    };

    // Listen for touch events on document (captures before overlay)
    // Use passive: false for touchmove to allow preventDefault
    document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleGlobalTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleGlobalTouchStart);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [drawingState.mode, drawingState.color, drawingState.thickness, isDrawableZoom, enterMultiTouchMode, cancelPendingDraw, getContext, drawLine, onStrokeEnd, activeLayerId, DRAW_START_DELAY]);

  // Global mouse event listeners for desktop drawing
  // Since overlay has pointerEvents: 'none', mouse events are handled globally
  useEffect(() => {
    if (drawingState.mode === 'navigate') return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only handle left click
      if (e.button !== 0) return;
      if (!isDrawableZoom) return;

      // Ignore synthetic mouse events generated after touch
      const timeSinceLastTouch = Date.now() - lastTouchTimeRef.current;
      if (timeSinceLastTouch < SYNTHETIC_MOUSE_THRESHOLD) {
        void logDebug('globalMouseDown_IGNORED_SYNTHETIC', {
          version: BUILD_VERSION,
          timeSinceLastTouch,
        });
        return;
      }

      // Check if click is within the map container
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top || e.clientY > rect.bottom) {
        return;
      }

      void logDebug('globalMouseDown', {
        version: BUILD_VERSION,
        clientX: e.clientX,
        clientY: e.clientY,
      });

      isDrawingRef.current = true;
      currentStrokePointsRef.current = [];

      const point = screenToCanvas(e.clientX, e.clientY);
      if (point) {
        lastPointRef.current = point;

        const latLng = canvasToLatLng(point);
        if (latLng) {
          currentStrokePointsRef.current.push(latLng);
        }

        // Draw initial dot
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
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;

      const point = screenToCanvas(e.clientX, e.clientY);
      if (point && lastPointRef.current) {
        drawLine(lastPointRef.current, point);
        lastPointRef.current = point;

        const latLng = canvasToLatLng(point);
        if (latLng) {
          currentStrokePointsRef.current.push(latLng);
        }
      }
    };

    const handleMouseUp = () => {
      if (!isDrawingRef.current) return;

      isDrawingRef.current = false;
      lastPointRef.current = null;

      // Notify about stroke end
      if (canvasRef.current && mapRef.current && onStrokeEnd) {
        const map = mapRef.current;
        const bounds = map.getBounds();
        const zoom = map.getZoom();

        const strokeData: StrokeData = {
          id: crypto.randomUUID(),
          layerId: activeLayerId || 'default',
          points: [...currentStrokePointsRef.current],
          color: drawingState.color,
          thickness: drawingState.thickness,
          mode: drawingState.mode === 'erase' ? 'erase' : 'draw',
          timestamp: Date.now(),
          zoom: zoom,
        };

        onStrokeEnd(canvasRef.current, bounds, zoom, strokeData);
      }

      currentStrokePointsRef.current = [];
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drawingState.mode, drawingState.color, drawingState.thickness, isDrawableZoom, screenToCanvas, canvasToLatLng, getContext, drawLine, onStrokeEnd, activeLayerId]);

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

  // Redraw all: tiles first, then strokes (ensures tiles are never lost)
  const redrawAll = useCallback((strokesData?: StrokeData[], visibleLayers?: string[]) => {
    const ctx = getContext();
    if (!ctx || !canvasRef.current || !mapRef.current || !canvasId) return;

    const canvas = canvasRef.current;
    const currentZoomLevel = mapRef.current.getZoom();

    // 1. Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw cached tiles first
    const cachedTiles = getCachedTiles(canvasId);
    if (cachedTiles.length > 0 && canvasOriginRef.current) {
      const canvasCenterX = canvas.width / 2;
      const canvasCenterY = canvas.height / 2;
      const originPoint = projectToPixel(
        canvasOriginRef.current.lat,
        canvasOriginRef.current.lng,
        canvasZoomRef.current
      );

      // Disable image smoothing to prevent sub-pixel rendering artifacts at tile boundaries
      ctx.imageSmoothingEnabled = false;

      for (const tile of cachedTiles) {
        const scale = Math.pow(2, tile.z - canvasZoomRef.current);
        const tileBounds = getTileBounds(tile.x, tile.y, tile.z);
        const tileCenterLat = (tileBounds.getNorth() + tileBounds.getSouth()) / 2;
        const tileCenterLng = (tileBounds.getWest() + tileBounds.getEast()) / 2;

        const tileCenterPoint = projectToPixel(tileCenterLat, tileCenterLng, canvasZoomRef.current);
        const offsetX = tileCenterPoint.x - originPoint.x;
        const offsetY = tileCenterPoint.y - originPoint.y;

        const destTileSize = TILE_DIMENSION / scale;
        // Round coordinates to integers to prevent sub-pixel gaps between tiles
        const destX = Math.round(canvasCenterX + offsetX - destTileSize / 2);
        const destY = Math.round(canvasCenterY + offsetY - destTileSize / 2);
        const destSize = Math.round(destTileSize);

        ctx.drawImage(
          tile.image,
          0, 0, TILE_DIMENSION, TILE_DIMENSION,
          destX, destY, destSize, destSize
        );
      }

      // Re-enable image smoothing for stroke drawing
      ctx.imageSmoothingEnabled = true;
    }

    // 3. Draw strokes on top
    if (strokesData) {
      for (const stroke of strokesData) {
        if (stroke.points.length === 0) continue;
        if (visibleLayers && !visibleLayers.includes(stroke.layerId)) continue;

        const screenPoints: Array<{ x: number; y: number }> = [];
        for (const latLng of stroke.points) {
          const screenPoint = latLngToCanvas(latLng);
          if (screenPoint) {
            screenPoints.push(screenPoint);
          }
        }

        if (screenPoints.length === 0) continue;

        const zoomDiff = currentZoomLevel - stroke.zoom;
        const scaledThickness = stroke.thickness * Math.pow(2, zoomDiff);

        ctx.beginPath();
        ctx.strokeStyle = stroke.mode === 'erase' ? 'rgba(0,0,0,1)' : stroke.color;
        ctx.lineWidth = scaledThickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.mode === 'erase') {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }

        const firstPoint = screenPoints[0];
        if (!firstPoint) continue;

        if (screenPoints.length === 1) {
          ctx.beginPath();
          ctx.arc(firstPoint.x, firstPoint.y, scaledThickness / 2, 0, Math.PI * 2);
          ctx.fillStyle = stroke.mode === 'erase' ? 'rgba(0,0,0,1)' : stroke.color;
          ctx.fill();
        } else {
          ctx.moveTo(firstPoint.x, firstPoint.y);
          for (let i = 1; i < screenPoints.length; i++) {
            const point = screenPoints[i];
            if (point) {
              ctx.lineTo(point.x, point.y);
            }
          }
          ctx.stroke();
        }
      }
    }

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  }, [getContext, canvasId, getCachedTiles, latLngToCanvas]);

  // Load initial tiles when tiles and canvasId are provided (uses tile cache)
  useEffect(() => {
    if (!isMapReady || !tiles || tiles.length === 0 || !canvasId || !canvasRef.current || !canvasOriginRef.current) return;

    const loadInitialTiles = async () => {
      // Convert tiles to TileInfo format with updatedAt
      const tileInfos: TileInfo[] = tiles.map(tile => {
        const tileInfo: TileInfo = { z: tile.z, x: tile.x, y: tile.y };
        const updatedAt = tile.updatedAt;
        if (updatedAt) {
          tileInfo.updatedAt = updatedAt;
        }
        return tileInfo;
      });

      // Load tiles into cache
      await loadTiles(canvasId, tileInfos);

      // Redraw using cached tiles
      redrawAll(strokes, visibleLayerIds);
    };

    void loadInitialTiles();
  }, [isMapReady, tiles, canvasId, loadTiles, redrawAll, strokes, visibleLayerIds]);

  // Redraw strokes from history (for undo/redo) - now uses redrawAll
  const redrawStrokes = useCallback((strokesData: StrokeData[], visibleLayers?: string[]) => {
    redrawAll(strokesData, visibleLayers);
  }, [redrawAll]);

  // Redraw when strokes or visible layers change (undo/redo)
  // Skip redraw during active drawing to avoid performance issues
  useEffect(() => {
    if (isDrawingRef.current) return;

    if (strokes !== undefined) {
      redrawStrokes(strokes, visibleLayerIds);
    }
  }, [strokes, visibleLayerIds, redrawStrokes]);

  // Reload tiles when switching to navigate mode (after drawing), then redraw strokes
  useEffect(() => {
    if (drawingState.mode === 'navigate' && canvasId) {
      const reloadAndRedraw = async () => {
        await reloadTilesForCurrentView();
        // Redraw strokes after tiles are loaded to maintain undo/redo state
        if (strokes !== undefined) {
          redrawStrokes(strokes, visibleLayerIds);
        }
      };
      void reloadAndRedraw();
    }
  }, [drawingState.mode, canvasId, reloadTilesForCurrentView, strokes, visibleLayerIds, redrawStrokes]);

  // Reload tiles after map move in navigate mode, then redraw strokes
  useEffect(() => {
    if (!mapRef.current || drawingState.mode !== 'navigate' || !canvasId) return;

    const handleMoveEnd = () => {
      void (async () => {
        await reloadTilesForCurrentView();
        // Redraw strokes after tiles are loaded to maintain undo/redo state
        if (strokes !== undefined) {
          redrawStrokes(strokes, visibleLayerIds);
        }
        // Reset transform and show canvas AFTER redraw
        if (canvasRef.current) {
          canvasRef.current.style.transform = '';
          canvasRef.current.style.transformOrigin = '';
          canvasRef.current.style.opacity = '1'; // Show canvas after redraw
        }
      })();
    };

    const map = mapRef.current;
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [drawingState.mode, canvasId, reloadTilesForCurrentView, strokes, visibleLayerIds, redrawStrokes]);

  const cursor = drawingState.mode === 'navigate' ? 'grab' : !isDrawableZoom ? 'not-allowed' : drawingState.mode === 'draw' ? 'crosshair' : 'cell';
  // Use 'pinch-zoom' in draw mode:
  // - Allows two-finger pinch zoom (browser native)
  // - Blocks single-finger pan (so drawing works)
  // - Blocks double-tap zoom
  const touchAction = drawingState.mode === 'navigate' ? 'auto' : 'pinch-zoom';

  // Overlay always has pointerEvents: 'none' to let Leaflet receive touch events
  // Drawing is handled via global touch event listeners on document
  // This ensures Leaflet can track gestures from the start (pinch/zoom, pan)
  useEffect(() => {
    if (!overlayRef.current) return;

    // Always 'none' - we handle drawing via global touch listeners
    overlayRef.current.style.pointerEvents = 'none';

    // touchAction: 'pinch-zoom' allows pinch-zoom but blocks single-finger pan
    const newTouchAction = drawingState.mode === 'navigate' ? 'auto' : 'pinch-zoom';
    overlayRef.current.style.touchAction = newTouchAction;

    void logDebug('touchAction_EFFECT', {
      version: BUILD_VERSION,
      mode: drawingState.mode,
      touchAction: newTouchAction,
    });
  }, [drawingState.mode]);

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
      {/* Transparent overlay for capturing pointer events (mouse/pen) */}
      {/* NOTE: pointerEvents is managed via useEffect to avoid React re-render issues */}
      {/* Touch events are handled globally on document for reliability after multi-touch */}
      <div
        ref={overlayRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto', // Initial value, managed by useEffect
          cursor,
          touchAction,
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
