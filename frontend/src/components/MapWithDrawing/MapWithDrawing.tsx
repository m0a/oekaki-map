import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPosition, DrawingState } from '../../types';
import { loadTilesToCanvas } from '../../utils/tiles';
import { api } from '../../services/api';

interface TileInfo {
  z: number;
  x: number;
  y: number;
}

interface MapWithDrawingProps {
  position: MapPosition;
  onPositionChange?: (position: MapPosition) => void;
  drawingState: DrawingState;
  onStrokeEnd?: (canvas: HTMLCanvasElement, bounds: L.LatLngBounds, zoom: number) => void;
  onCanvasOriginInit?: (origin: L.LatLng, zoom: number) => void;
  tiles?: TileInfo[] | undefined;
  canvasId?: string | undefined;
}

// Default position: Tokyo, Japan
const DEFAULT_POSITION: MapPosition = {
  lat: 35.6812,
  lng: 139.7671,
  zoom: 18,
};

// Canvas size (covers a large area for drawing)
// At zoom 18, 1 pixel ≈ 0.6m, so 4096px ≈ 2.5km coverage
const CANVAS_SIZE = 4096;

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
}: MapWithDrawingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Current zoom level state
  const [currentZoom, setCurrentZoom] = useState(position.zoom);
  const isDrawableZoom = currentZoom >= MIN_DRAWABLE_ZOOM && currentZoom <= MAX_DRAWABLE_ZOOM;

  // Drawing state
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<L.Point | null>(null);

  // Canvas origin in lat/lng (set when map initializes)
  const canvasOriginRef = useRef<L.LatLng | null>(null);
  const canvasZoomRef = useRef<number>(18);

  // Get canvas context
  const getContext = useCallback(() => {
    if (!canvasRef.current) return null;
    return canvasRef.current.getContext('2d');
  }, []);

  // Update canvas position based on map state
  const updateCanvasTransform = useCallback(() => {
    if (!mapRef.current || !canvasContainerRef.current || !canvasOriginRef.current) return;

    const map = mapRef.current;
    const origin = canvasOriginRef.current;
    const originZoom = canvasZoomRef.current;
    const currentZoom = map.getZoom();

    // Use layerPoint for correct positioning within pane
    const originPoint = map.latLngToLayerPoint(origin);

    // Calculate scale based on zoom difference
    const scale = Math.pow(2, currentZoom - originZoom);

    // Position the canvas container (center of canvas at origin)
    const offsetX = originPoint.x - (CANVAS_SIZE * scale) / 2;
    const offsetY = originPoint.y - (CANVAS_SIZE * scale) / 2;

    canvasContainerRef.current.style.left = offsetX + 'px';
    canvasContainerRef.current.style.top = offsetY + 'px';
    canvasContainerRef.current.style.transform = `scale(${scale})`;
    canvasContainerRef.current.style.transformOrigin = '0 0';
  }, []);

  // Convert screen point to canvas point
  const screenToCanvas = useCallback((clientX: number, clientY: number): L.Point | null => {
    if (!mapRef.current || !canvasRef.current || !canvasOriginRef.current) return null;

    const map = mapRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    // Get container point
    const containerPoint = L.point(clientX - rect.left, clientY - rect.top);

    // Convert to lat/lng
    const latLng = map.containerPointToLatLng(containerPoint);

    // Get the origin point at the original zoom level using project()
    // This gives us the world pixel coordinates at that zoom level
    const origin = canvasOriginRef.current;
    const originZoom = canvasZoomRef.current;

    // Project to world pixels at the canvas zoom level
    const originPixel = map.project(origin, originZoom);
    const pointPixel = map.project(latLng, originZoom);

    // Canvas center is at origin, so offset from center
    const canvasX = CANVAS_SIZE / 2 + (pointPixel.x - originPixel.x);
    const canvasY = CANVAS_SIZE / 2 + (pointPixel.y - originPixel.y);

    return L.point(canvasX, canvasY);
  }, []);

  // Draw a line on the canvas
  const drawLine = useCallback((from: L.Point, to: L.Point) => {
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

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (drawingState.mode === 'navigate') return;
    if (!isDrawableZoom) return;

    e.preventDefault();
    e.stopPropagation();

    isDrawingRef.current = true;

    const point = screenToCanvas(e.clientX, e.clientY);
    if (point) {
      lastPointRef.current = point;

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
  }, [drawingState, screenToCanvas, getContext, isDrawableZoom]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawingRef.current || drawingState.mode === 'navigate' || !isDrawableZoom) return;

    e.preventDefault();
    e.stopPropagation();

    const point = screenToCanvas(e.clientX, e.clientY);
    if (point && lastPointRef.current) {
      drawLine(lastPointRef.current, point);
      lastPointRef.current = point;
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
      onStrokeEnd(canvasRef.current, bounds, zoom);
    }
  }, [onStrokeEnd]);

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

    // Set canvas origin to actual map center (after map is created)
    const center = map.getCenter();
    canvasOriginRef.current = center;
    canvasZoomRef.current = map.getZoom();

    // Notify parent about canvas origin
    onCanvasOriginInit?.(canvasOriginRef.current, canvasZoomRef.current);

    // Create canvas container in overlay pane
    const overlayPane = map.getPane('overlayPane');
    if (overlayPane) {
      const canvasContainer = document.createElement('div');
      canvasContainer.style.position = 'absolute';
      canvasContainer.style.width = CANVAS_SIZE + 'px';
      canvasContainer.style.height = CANVAS_SIZE + 'px';
      canvasContainer.style.pointerEvents = 'none';
      canvasContainer.style.zIndex = '400';

      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      canvasContainer.appendChild(canvas);
      overlayPane.appendChild(canvasContainer);

      canvasRef.current = canvas;
      canvasContainerRef.current = canvasContainer;

      // Initial transform
      updateCanvasTransform();
    }

    // Update canvas transform on map move/zoom
    map.on('move', updateCanvasTransform);
    map.on('zoom', updateCanvasTransform);
    map.on('zoomend', () => {
      updateCanvasTransform();
      setCurrentZoom(map.getZoom());
    });
    map.on('viewreset', updateCanvasTransform);
    map.on('moveend', () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      setCurrentZoom(zoom);
      onPositionChange?.({ lat: center.lat, lng: center.lng, zoom });
    });

    return () => {
      if (canvasContainerRef.current && canvasContainerRef.current.parentNode) {
        canvasContainerRef.current.parentNode.removeChild(canvasContainerRef.current);
      }
      map.remove();
      mapRef.current = null;
      canvasRef.current = null;
      canvasContainerRef.current = null;
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
    const currentZoom = mapRef.current.getZoom();

    if (
      Math.abs(currentCenter.lat - position.lat) > 0.0001 ||
      Math.abs(currentCenter.lng - position.lng) > 0.0001 ||
      currentZoom !== position.zoom
    ) {
      mapRef.current.setView([position.lat, position.lng], position.zoom, { animate: false });
    }
  }, [position.lat, position.lng, position.zoom]);

  // Load tiles when tiles and canvasId are provided
  useEffect(() => {
    if (!tiles || tiles.length === 0 || !canvasId || !canvasRef.current || !canvasOriginRef.current) return;

    const loadTiles = async () => {
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
        loadTilesToCanvas(canvasRef.current, canvasOriginRef.current, canvasZoomRef.current, tileImages);
      }
    };

    loadTiles();
  }, [tiles, canvasId]);

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
      {/* Zoom level warning */}
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
