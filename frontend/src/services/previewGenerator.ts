import type L from 'leaflet';
import { OGP_IMAGE_WIDTH, OGP_IMAGE_HEIGHT } from '../types/index';
import type { StrokeData } from '../types/index';

interface ScreenshotOptions {
  width?: number;
  height?: number;
  hideControls?: boolean;
  /** Drawing canvas element containing saved tiles */
  drawingCanvas?: HTMLCanvasElement | null;
  /** Stroke data to render on top of the map (current session strokes) */
  strokes?: StrokeData[];
  /** Visible layer IDs to filter strokes */
  visibleLayerIds?: string[];
}

/**
 * Capture map screenshot using leaflet-image
 */
async function captureMapWithLeafletImage(map: L.Map): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    // Import leaflet-image dynamically
    import('leaflet-image')
      .then((leafletImageModule) => {
        const leafletImage = leafletImageModule.default || leafletImageModule;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        leafletImage(map, (err: Error | null, canvas: HTMLCanvasElement) => {
          if (err) {
            reject(err);
          } else {
            resolve(canvas);
          }
        });
      })
      .catch((err: unknown) => {
        reject(err instanceof Error ? err : new Error('Failed to load leaflet-image'));
      });
  });
}

export async function captureMapScreenshot(
  map: L.Map,
  options: ScreenshotOptions = {}
): Promise<Blob | null> {
  const {
    width = OGP_IMAGE_WIDTH,
    height = OGP_IMAGE_HEIGHT,
    drawingCanvas,
    strokes,
    visibleLayerIds,
  } = options;

  try {
    // Capture map screenshot using leaflet-image
    const mapCanvas = await captureMapWithLeafletImage(map);

    // Convert canvas to data URL
    const mapDataUrl = mapCanvas.toDataURL('image/png');

    // Composite map, drawing canvas, and strokes
    const compositedDataUrl = await compositeMapAndDrawings(
      mapDataUrl,
      map,
      drawingCanvas,
      strokes,
      visibleLayerIds,
      width,
      height
    );

    return dataURLtoBlob(compositedDataUrl);
  } catch (error) {
    console.error('Failed to capture map screenshot:', error);
    return null;
  }
}

/**
 * Composite the map screenshot with drawing canvas and strokes
 * Order: map background -> drawing canvas (saved tiles) -> strokes (current session)
 */
async function compositeMapAndDrawings(
  mapDataUrl: string,
  map: L.Map,
  drawingCanvas: HTMLCanvasElement | null | undefined,
  strokes: StrokeData[] | undefined,
  visibleLayerIds: string[] | undefined,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const mapImg = new Image();
    mapImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Calculate scale factor from map size to target size
      const mapSize = map.getSize();
      const scaleX = targetWidth / mapSize.x;
      const scaleY = targetHeight / mapSize.y;
      const scale = Math.min(scaleX, scaleY);

      // Calculate offset to center the content
      const offsetX = (targetWidth - mapSize.x * scale) / 2;
      const offsetY = (targetHeight - mapSize.y * scale) / 2;

      // Calculate crop/resize for map image (center crop to target aspect ratio)
      const sourceAspect = mapImg.width / mapImg.height;
      const targetAspect = targetWidth / targetHeight;

      let sx = 0;
      let sy = 0;
      let sw = mapImg.width;
      let sh = mapImg.height;

      if (sourceAspect > targetAspect) {
        sw = mapImg.height * targetAspect;
        sx = (mapImg.width - sw) / 2;
      } else if (sourceAspect < targetAspect) {
        sh = mapImg.width / targetAspect;
        sy = (mapImg.height - sh) / 2;
      }

      // 1. Draw map as background
      ctx.drawImage(mapImg, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

      // 2. Draw the drawing canvas (saved tiles) on top if available
      if (drawingCanvas && drawingCanvas.width > 0 && drawingCanvas.height > 0) {
        // Use the same scale and offset as for strokes
        const scaledWidth = drawingCanvas.width * scale;
        const scaledHeight = drawingCanvas.height * scale;
        const canvasOffsetX = (targetWidth - scaledWidth) / 2;
        const canvasOffsetY = (targetHeight - scaledHeight) / 2;

        ctx.drawImage(
          drawingCanvas,
          0, 0, drawingCanvas.width, drawingCanvas.height,
          canvasOffsetX, canvasOffsetY, scaledWidth, scaledHeight
        );
      }

      // 3. Draw strokes on top if available (current session strokes)
      if (strokes && strokes.length > 0) {
        const currentZoom = map.getZoom();

        for (const stroke of strokes) {
          if (stroke.points.length === 0) continue;
          if (visibleLayerIds && !visibleLayerIds.includes(stroke.layerId)) continue;

          // Convert geographic coordinates to screen coordinates
          const screenPoints: Array<{ x: number; y: number }> = [];
          for (const latLng of stroke.points) {
            const point = map.latLngToContainerPoint([latLng.lat, latLng.lng]);
            // Apply scale and offset to match OGP image dimensions
            screenPoints.push({
              x: point.x * scale + offsetX,
              y: point.y * scale + offsetY,
            });
          }

          if (screenPoints.length === 0) continue;

          // Scale thickness based on zoom difference and image scale
          const zoomDiff = currentZoom - stroke.zoom;
          const scaledThickness = stroke.thickness * Math.pow(2, zoomDiff) * scale;

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

        // Reset composite operation
        ctx.globalCompositeOperation = 'source-over';
      }

      resolve(canvas.toDataURL('image/png'));
    };

    mapImg.onerror = () => {
      reject(new Error('Failed to load map image for compositing'));
    };

    mapImg.src = mapDataUrl;
  });
}

export function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mimeMatch = arr[0]?.match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? 'image/png';
  const base64Data = arr[1] ?? '';
  const bstr = atob(base64Data);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export async function getDefaultPreviewImage(): Promise<Blob | null> {
  try {
    const response = await fetch('/ogp-default.svg');
    if (!response.ok) {
      return null;
    }
    return await response.blob();
  } catch {
    return null;
  }
}
