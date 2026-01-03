import type L from 'leaflet';
import { OGP_IMAGE_WIDTH, OGP_IMAGE_HEIGHT } from '../types/index';

interface ScreenshotOptions {
  width?: number;
  height?: number;
  hideControls?: boolean;
}

export async function captureMapScreenshot(
  map: L.Map,
  options: ScreenshotOptions = {}
): Promise<Blob | null> {
  const {
    width = OGP_IMAGE_WIDTH,
    height = OGP_IMAGE_HEIGHT,
    hideControls = true,
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
    const imageDataUrl = typeof result === 'string' ? result : null;

    map.removeControl(screenshoter);

    if (!imageDataUrl) {
      console.warn('Screenshot capture returned empty');
      return null;
    }

    const resizedDataUrl = await resizeImage(imageDataUrl, width, height);

    return dataURLtoBlob(resizedDataUrl);
  } catch (error) {
    console.error('Failed to capture map screenshot:', error);
    return null;
  }
}

async function resizeImage(
  dataUrl: string,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const sourceAspect = img.width / img.height;
      const targetAspect = targetWidth / targetHeight;

      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;

      if (sourceAspect > targetAspect) {
        sw = img.height * targetAspect;
        sx = (img.width - sw) / 2;
      } else if (sourceAspect < targetAspect) {
        sh = img.width / targetAspect;
        sy = (img.height - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = dataUrl;
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
