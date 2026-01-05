import type L from 'leaflet';
import { OGP_IMAGE_WIDTH, OGP_IMAGE_HEIGHT } from '../types/index';

interface ScreenshotOptions {
  width?: number;
  height?: number;
  hideControls?: boolean;
  /** Drawing canvas element to composite on top of the map */
  drawingCanvas?: HTMLCanvasElement | null;
}

export async function captureMapScreenshot(
  map: L.Map,
  options: ScreenshotOptions = {}
): Promise<Blob | null> {
  const {
    width = OGP_IMAGE_WIDTH,
    height = OGP_IMAGE_HEIGHT,
    hideControls = true,
    drawingCanvas,
  } = options;

  try {
    const { SimpleMapScreenshoter } = await import(
      'leaflet-simple-map-screenshoter'
    );

    const screenshoter = new SimpleMapScreenshoter({
      cropImageByInnerWH: true,
      mimeType: 'image/png',
      hideElementsWithSelectors: hideControls
        ? ['.leaflet-control-container']
        : [],
    });

    screenshoter.addTo(map);

    const result = await screenshoter.takeScreen('image');
    const mapImageDataUrl = typeof result === 'string' ? result : null;

    map.removeControl(screenshoter);

    if (!mapImageDataUrl) {
      console.warn('Screenshot capture returned empty');
      return null;
    }

    // Composite map and drawing canvas
    const compositedDataUrl = await compositeMapAndCanvas(
      mapImageDataUrl,
      drawingCanvas,
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
 * Composite the map screenshot with the drawing canvas
 */
async function compositeMapAndCanvas(
  mapDataUrl: string,
  drawingCanvas: HTMLCanvasElement | null | undefined,
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

      // Draw map as background
      ctx.drawImage(mapImg, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

      // Draw the drawing canvas on top if available
      if (drawingCanvas && drawingCanvas.width > 0 && drawingCanvas.height > 0) {
        // Use the same crop region for the drawing canvas
        const canvasAspect = drawingCanvas.width / drawingCanvas.height;
        let csx = 0;
        let csy = 0;
        let csw = drawingCanvas.width;
        let csh = drawingCanvas.height;

        if (canvasAspect > targetAspect) {
          csw = drawingCanvas.height * targetAspect;
          csx = (drawingCanvas.width - csw) / 2;
        } else if (canvasAspect < targetAspect) {
          csh = drawingCanvas.width / targetAspect;
          csy = (drawingCanvas.height - csh) / 2;
        }

        ctx.drawImage(drawingCanvas, csx, csy, csw, csh, 0, 0, targetWidth, targetHeight);
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
