import { useCallback, useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import { MapWithDrawing, DEFAULT_POSITION } from './components/MapWithDrawing/MapWithDrawing';
import { Toolbar } from './components/Toolbar/Toolbar';
import { useDrawing } from './hooks/useDrawing';
import { useCanvas } from './hooks/useCanvas';
import { useAutoSave } from './hooks/useAutoSave';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { extractTilesFromCanvas } from './utils/tiles';
import type { MapPosition, StrokeData } from './types';

interface AppProps {
  canvasId: string | undefined;
}

export function App({ canvasId }: AppProps) {
  const [mapPosition, setMapPosition] = useState<MapPosition | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Canvas origin tracking
  const canvasOriginRef = useRef<L.LatLng | null>(null);
  const canvasZoomRef = useRef<number>(18);

  // Custom hooks
  const drawing = useDrawing();
  const canvas = useCanvas(canvasId);
  const autoSave = useAutoSave();
  const undoRedo = useUndoRedo();

  // Keyboard shortcuts for undo/redo
  useKeyboardShortcuts({
    onUndo: undoRedo.undo,
    onRedo: undoRedo.redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
  });

  // Initialize map position from canvas or default
  useEffect(() => {
    if (isInitialized) return;

    if (canvas.canvas) {
      // Use saved canvas position
      setMapPosition({
        lat: canvas.canvas.centerLat,
        lng: canvas.canvas.centerLng,
        zoom: canvas.canvas.zoom,
      });
      setIsInitialized(true);
    } else if (!canvasId && !canvas.isLoading) {
      // New canvas - use default position
      setMapPosition(DEFAULT_POSITION);
      setIsInitialized(true);
    }
  }, [canvas.canvas, canvas.isLoading, canvasId, isInitialized]);

  // Handle map position changes
  const handlePositionChange = useCallback(
    (position: MapPosition) => {
      setMapPosition(position);

      // Update canvas position in backend if we have a canvas
      if (canvas.canvas) {
        autoSave.scheduleSave(async () => {
          await canvas.updatePosition(position);
        });
      }
    },
    [canvas.canvas, canvas.updatePosition, autoSave]
  );

  // Handle canvas origin initialization
  const handleCanvasOriginInit = useCallback((origin: L.LatLng, zoom: number) => {
    canvasOriginRef.current = origin;
    canvasZoomRef.current = zoom;
  }, []);

  // Handle stroke end - save canvas state and add to undo history
  const handleStrokeEnd = useCallback(
    async (canvasElement: HTMLCanvasElement, bounds: L.LatLngBounds, zoom: number, strokeData?: StrokeData) => {
      // Add stroke to undo history if provided
      if (strokeData && strokeData.points.length > 0) {
        undoRedo.push(strokeData);
      }

      // Create canvas if needed, capture ID for later use
      let currentCanvasId = canvas.canvas?.id;
      if (!currentCanvasId) {
        if (!mapPosition) return;
        try {
          currentCanvasId = await canvas.createCanvas(mapPosition);
        } catch (err) {
          console.error('Failed to create canvas:', err);
          return;
        }
      }

      // Extract and save tiles
      // Use bounds center as canvas origin (viewport-sized canvas is centered on map center)
      const boundsCenter = bounds.getCenter();
      const targetZoom = Math.round(zoom);

      // Capture canvasId in closure to ensure it's available when the save runs
      const canvasIdToSave = currentCanvasId;
      autoSave.scheduleSave(async () => {
        try {
          const tiles = await extractTilesFromCanvas(
            canvasElement,
            boundsCenter,
            zoom,
            targetZoom,
            bounds
          );

          if (tiles.length > 0) {
            await canvas.saveTiles(tiles, canvasIdToSave);
          }
        } catch (err) {
          console.error('Failed to save tiles:', err);
          throw err;
        }
      });
    },
    [canvas, mapPosition, autoSave, undoRedo]
  );

  // Don't render map until position is initialized
  if (!mapPosition) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f0f0f0',
        }}
      >
        読み込み中...
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {/* Map with drawing layer */}
      <MapWithDrawing
        position={mapPosition}
        onPositionChange={handlePositionChange}
        drawingState={drawing.state}
        onStrokeEnd={handleStrokeEnd}
        onCanvasOriginInit={handleCanvasOriginInit}
        tiles={canvas.tiles}
        canvasId={canvas.canvas?.id}
        onFlushSave={autoSave.flushSave}
        strokes={undoRedo.strokes}
      />

      {/* Toolbar */}
      <Toolbar
        color={drawing.state.color}
        thickness={drawing.state.thickness}
        mode={drawing.state.mode}
        onColorChange={drawing.setColor}
        onThicknessChange={drawing.setThickness}
        onModeChange={drawing.setMode}
        canUndo={undoRedo.canUndo}
        canRedo={undoRedo.canRedo}
        onUndo={undoRedo.undo}
        onRedo={undoRedo.redo}
      />

      {/* Save status indicator */}
      {autoSave.isSaving && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            padding: '8px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            borderRadius: 8,
            fontSize: 14,
            zIndex: 1000,
          }}
        >
          保存中...
        </div>
      )}

      {/* Error indicator */}
      {autoSave.error && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            padding: '8px 16px',
            backgroundColor: 'rgba(220, 53, 69, 0.9)',
            color: 'white',
            borderRadius: 8,
            fontSize: 14,
            zIndex: 1000,
          }}
        >
          {autoSave.error}
        </div>
      )}

      {/* Loading indicator */}
      {canvas.isLoading && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '16px 24px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 16,
            zIndex: 1000,
          }}
        >
          読み込み中...
        </div>
      )}

      {/* Canvas error */}
      {canvas.error && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '16px 24px',
            backgroundColor: 'rgba(220, 53, 69, 0.95)',
            color: 'white',
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 16,
            zIndex: 1000,
          }}
        >
          {canvas.error}
        </div>
      )}
    </div>
  );
}
