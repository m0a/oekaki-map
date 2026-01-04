import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPosition, DrawingState, StrokeData, TileInfo } from '../../types';
import { getTileBounds, projectToPixel } from '../../utils/tiles';
import { api } from '../../services/api';
import { useTileCache } from '../../hooks/useTileCache';
import { TILE_DIMENSION } from '../../types';

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

  // Tile cache hook
  const { loadTiles, getCachedTiles, clearCache } = useTileCache();

  // Current zoom level state
  const [currentZoom, setCurrentZoom] = useState(position.zoom);
  const [isMapReady, setIsMapReady] = useState(false);
  const isDrawableZoom = currentZoom >= MIN_DRAWABLE_ZOOM && currentZoom <= MAX_DRAWABLE_ZOOM;

  // Drawing state
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Current stroke points for undo/redo (stored as geographic coordinates)
  const currentStrokePointsRef = useRef<Array<{ lat: number; lng: number }>>([]);

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

        const response = await api.tiles.getForArea(canvasId, tileZoom, minX, maxX, minY, maxY);

        if (response.tiles && response.tiles.length > 0) {
          // Add tiles to load list with updatedAt for cache versioning
          for (const tile of response.tiles) {
            const tileInfo: TileInfo = { z: tile.z, x: tile.x, y: tile.y };
            const updatedAt = (tile as TileInfo).updatedAt;
            if (updatedAt) {
              tileInfo.updatedAt = updatedAt;
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

      // Store geographic coordinates for undo/redo
      const latLng = canvasToLatLng(point);
      if (latLng) {
        currentStrokePointsRef.current.push(latLng);
      }

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
  }, [drawingState, screenToCanvas, canvasToLatLng, getContext, isDrawableZoom, currentZoom]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || drawingState.mode === 'navigate' || !isDrawableZoom) return;

    e.preventDefault();
    e.stopPropagation();

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
  }, [drawingState.mode, screenToCanvas, canvasToLatLng, drawLine, isDrawableZoom]);

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;

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

    // Sync canvas transform by copying from Leaflet's internal transform
    const syncCanvasTransform = () => {
      if (!canvasRef.current || !canvasOriginRef.current) return;
      if (canvasZoomRef.current === null) return;

      const canvas = canvasRef.current;
      const canvasRect = canvas.getBoundingClientRect();
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;

      // Where is the canvas origin NOW on screen?
      const originPos = map.latLngToContainerPoint(canvasOriginRef.current);
      const dx = originPos.x - centerX;
      const dy = originPos.y - centerY;

      // Calculate scale
      const currentZoomLevel = map.getZoom();
      const scale = Math.pow(2, currentZoomLevel - canvasZoomRef.current);

      canvas.style.transformOrigin = `${centerX}px ${centerY}px`;
      canvas.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    };

    // Handle zoom animation - Leaflet fires this at the START of zoom animation
    // with the TARGET zoom level, allowing us to apply the correct scale immediately
    const handleZoomAnim = (e: L.ZoomAnimEvent) => {
      if (!canvasRef.current || !canvasOriginRef.current) return;
      if (canvasZoomRef.current === null) return;

      const canvas = canvasRef.current;
      const canvasRect = canvas.getBoundingClientRect();
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;

      // e.zoom is the TARGET zoom level
      const targetScale = Math.pow(2, e.zoom - canvasZoomRef.current);

      // Calculate where the origin will be after zoom completes
      // e.center is the new map center after zoom
      // We need to project where our canvasOriginRef will appear
      // Use the zoom center from the event if available (origin is not in types but exists at runtime)
      const eventWithOrigin = e as L.ZoomAnimEvent & { origin?: L.Point };
      const zoomOrigin = eventWithOrigin.origin || map.latLngToContainerPoint(e.center);

      // Current origin position
      const currentOriginPos = map.latLngToContainerPoint(canvasOriginRef.current);

      // After zoom, points move relative to the zoom center
      // newPos = zoomCenter + (oldPos - zoomCenter) * scale
      const newOriginX = zoomOrigin.x + (currentOriginPos.x - zoomOrigin.x) * targetScale;
      const newOriginY = zoomOrigin.y + (currentOriginPos.y - zoomOrigin.y) * targetScale;

      const dx = newOriginX - centerX;
      const dy = newOriginY - centerY;

      canvas.style.transformOrigin = `${centerX}px ${centerY}px`;
      canvas.style.transform = `translate(${dx}px, ${dy}px) scale(${targetScale})`;
    };

    // Sync canvas transform during pan and zoom
    map.on('move', syncCanvasTransform);
    map.on('zoom', syncCanvasTransform);
    map.on('zoomanim', handleZoomAnim);

    // Update zoom state on zoom end (transform reset happens after redraw in moveend handler)
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
      // Note: transform reset is handled by moveend handler after redraw to avoid flicker
    });

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
  useEffect(() => {
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
        // Reset transform AFTER redraw to avoid flicker
        if (canvasRef.current) {
          canvasRef.current.style.transform = '';
          canvasRef.current.style.transformOrigin = '';
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
