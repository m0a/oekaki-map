import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapWithDrawing, DEFAULT_POSITION } from './components/MapWithDrawing/MapWithDrawing';
import { Toolbar } from './components/Toolbar/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { useDrawing } from './hooks/useDrawing';
import { useCanvas } from './hooks/useCanvas';
import { useAutoSave } from './hooks/useAutoSave';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useLayers } from './hooks/useLayers';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useShare } from './hooks/useShare';
import { useGeolocation } from './hooks/useGeolocation';
import { extractTilesFromCanvas } from './utils/tiles';
import type { MapPosition, StrokeData } from './types';

interface AppProps {
  canvasId: string | undefined;
}

export function App({ canvasId }: AppProps) {
  const [mapPosition, setMapPosition] = useState<MapPosition | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // Canvas origin tracking
  const canvasOriginRef = useRef<L.LatLng | null>(null);
  const canvasZoomRef = useRef<number>(18);

  // Custom hooks
  const drawing = useDrawing();
  const canvas = useCanvas(canvasId);
  const autoSave = useAutoSave();
  const undoRedo = useUndoRedo();
  const layers = useLayers();
  const share = useShare();
  const geolocation = useGeolocation();

  // Keyboard shortcuts for undo/redo
  useKeyboardShortcuts({
    onUndo: undoRedo.undo,
    onRedo: undoRedo.redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
  });

  // Initialize map position from canvas or default
  // Priority: share state > center state > default
  useEffect(() => {
    if (isInitialized) return;

    if (canvas.canvas) {
      // Use share state if available (for shared URLs), otherwise use center state
      const hasShareState = canvas.canvas.shareLat !== null &&
                            canvas.canvas.shareLng !== null &&
                            canvas.canvas.shareZoom !== null;

      if (hasShareState) {
        // Use shared position (for users opening a shared URL)
        // Type guard ensures these are non-null after hasShareState check
        const shareLat = canvas.canvas.shareLat as number;
        const shareLng = canvas.canvas.shareLng as number;
        const shareZoom = canvas.canvas.shareZoom as number;
        setMapPosition({
          lat: shareLat,
          lng: shareLng,
          zoom: shareZoom,
        });
      } else {
        // Use saved canvas position
        setMapPosition({
          lat: canvas.canvas.centerLat,
          lng: canvas.canvas.centerLng,
          zoom: canvas.canvas.zoom,
        });
      }
      setIsInitialized(true);
    } else if (!canvasId && !canvas.isLoading) {
      // New canvas - use default position
      setMapPosition(DEFAULT_POSITION);
      setIsInitialized(true);
    }
  }, [canvas.canvas, canvas.isLoading, canvasId, isInitialized]);

  // Load layers when canvas is available
  useEffect(() => {
    if (canvas.canvas?.id) {
      void layers.loadLayers(canvas.canvas.id);
    }
  }, [canvas.canvas?.id, layers.loadLayers]);

  // Create default layer if canvas has no layers (only for existing canvases loaded from server)
  // Note: For newly created canvases, handleCreateLayer handles the first layer creation
  useEffect(() => {
    // Only run after layers have been loaded (not on initial render)
    if (canvas.canvas?.id && layers.layers.length === 0 && !layers.isLoading && canvasId) {
      // Only create default layer for existing canvases (those with a URL canvasId)
      void layers.createDefaultLayerIfNeeded(canvas.canvas.id);
    }
  }, [canvas.canvas?.id, layers.layers.length, layers.isLoading, canvasId, layers.createDefaultLayerIfNeeded]);

  // Layer panel handlers
  const handleToggleLayerPanel = useCallback(() => {
    setIsLayerPanelOpen((prev) => !prev);
  }, []);

  const handleCreateLayer = useCallback(async () => {
    let canvasId = canvas.canvas?.id;
    // Create canvas if it doesn't exist
    if (!canvasId && mapPosition) {
      try {
        canvasId = await canvas.createCanvas(mapPosition);
      } catch (err) {
        console.error('Failed to create canvas:', err);
        return;
      }
    }
    if (canvasId) {
      await layers.createLayer(canvasId);
    }
  }, [canvas, mapPosition, layers.createLayer]);

  const handleToggleLayerVisibility = useCallback(async (layerId: string) => {
    if (canvas.canvas?.id) {
      await layers.toggleLayerVisibility(canvas.canvas.id, layerId);
    }
  }, [canvas.canvas?.id, layers.toggleLayerVisibility]);

  const handleDeleteLayer = useCallback(async (layerId: string) => {
    if (canvas.canvas?.id) {
      const success = await layers.deleteLayer(canvas.canvas.id, layerId);
      if (success) {
        undoRedo.removeStrokesForLayer(layerId);
      }
    }
  }, [canvas.canvas?.id, layers.deleteLayer, undoRedo.removeStrokesForLayer]);

  const handleRenameLayer = useCallback(async (layerId: string, newName: string) => {
    if (canvas.canvas?.id) {
      await layers.updateLayer(canvas.canvas.id, layerId, { name: newName });
    }
  }, [canvas.canvas?.id, layers.updateLayer]);

  const handleReorderLayers = useCallback(async (layerId: string, newOrder: number) => {
    if (canvas.canvas?.id) {
      await layers.reorderLayers(canvas.canvas.id, layerId, newOrder);
    }
  }, [canvas.canvas?.id, layers.reorderLayers]);

  // Map ready handler
  const handleMapReady = useCallback((map: L.Map) => {
    setMapInstance(map);
  }, []);

  // Geolocation handler - move map to current position
  const handleGetLocation = useCallback(async () => {
    const position = await geolocation.getCurrentPosition();
    if (position && mapPosition) {
      setMapPosition({
        lat: position.lat,
        lng: position.lng,
        zoom: mapPosition.zoom, // Keep current zoom level
      });
    }
  }, [geolocation.getCurrentPosition, mapPosition]);

  // Compute visible layer IDs for filtering strokes
  const visibleLayerIds = useMemo(() => {
    return layers.layers.filter((l) => l.visible).map((l) => l.id);
  }, [layers.layers]);

  // Share handler (must be after visibleLayerIds declaration)
  const handleShare = useCallback(async () => {
    if (!canvas.canvas?.id || !mapPosition) return;
    await share.share(canvas.canvas.id, mapPosition, {
      map: mapInstance,
      strokes: undoRedo.strokes,
      visibleLayerIds
    });
  }, [canvas.canvas?.id, mapPosition, share.share, mapInstance, undoRedo.strokes, visibleLayerIds]);

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
      // IMPORTANT: Capture canvas content BEFORE updating undo state
      // This prevents race condition where redrawAll modifies canvas before extraction
      const canvasCopy = document.createElement('canvas');
      canvasCopy.width = canvasElement.width;
      canvasCopy.height = canvasElement.height;
      const copyCtx = canvasCopy.getContext('2d');
      if (copyCtx) {
        copyCtx.drawImage(canvasElement, 0, 0);
      }

      // Now safe to add stroke to undo history (this triggers redrawAll)
      if (strokeData && strokeData.points.length > 0) {
        undoRedo.push(strokeData);
      }

      // Create canvas if needed, capture ID for later use
      let currentCanvasId = canvas.canvas?.id;
      if (!currentCanvasId) {
        if (!mapPosition) return;
        try {
          currentCanvasId = await canvas.createCanvas(mapPosition);
          // Create default layer for new canvas
          if (currentCanvasId) {
            await layers.createDefaultLayerIfNeeded(currentCanvasId);
          }
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
          // Use the captured canvas copy instead of live canvas element
          const tiles = await extractTilesFromCanvas(
            canvasCopy,
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
        onMapReady={handleMapReady}
        tiles={canvas.tiles}
        canvasId={canvas.canvas?.id}
        onFlushSave={autoSave.flushSave}
        strokes={undoRedo.strokes}
        activeLayerId={layers.activeLayerId}
        visibleLayerIds={visibleLayerIds}
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
        isLayerPanelOpen={isLayerPanelOpen}
        onToggleLayerPanel={handleToggleLayerPanel}
        canvasId={canvas.canvas?.id}
        currentPosition={mapPosition ?? undefined}
        onShare={handleShare}
        isSharing={share.isSharing}
        onGetLocation={handleGetLocation}
        isGettingLocation={geolocation.isLoading}
      />

      {/* Layer panel */}
      {isLayerPanelOpen && (
        <LayerPanel
          layers={layers.layers}
          activeLayerId={layers.activeLayerId}
          canCreateLayer={layers.canCreateLayer}
          onSelectLayer={layers.selectLayer}
          onCreateLayer={handleCreateLayer}
          onToggleVisibility={handleToggleLayerVisibility}
          onDeleteLayer={handleDeleteLayer}
          onRenameLayer={handleRenameLayer}
          onReorderLayers={handleReorderLayers}
          onClose={handleToggleLayerPanel}
        />
      )}

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

      {/* Share error */}
      {share.error && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            backgroundColor: 'rgba(220, 53, 69, 0.9)',
            color: 'white',
            borderRadius: 8,
            fontSize: 14,
            zIndex: 1001,
          }}
          onClick={share.clearError}
        >
          {share.error}
        </div>
      )}

      {/* Clipboard copy success toast */}
      {share.copied && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            backgroundColor: 'rgba(40, 167, 69, 0.9)',
            color: 'white',
            borderRadius: 8,
            fontSize: 14,
            zIndex: 1001,
          }}
        >
          URLをコピーしました
        </div>
      )}

      {/* Geolocation error */}
      {geolocation.error && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            backgroundColor: 'rgba(220, 53, 69, 0.9)',
            color: 'white',
            borderRadius: 8,
            fontSize: 14,
            zIndex: 1001,
          }}
          onClick={geolocation.clearError}
        >
          {geolocation.error}
        </div>
      )}
    </div>
  );
}
