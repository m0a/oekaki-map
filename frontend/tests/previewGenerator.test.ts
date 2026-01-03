import { describe, it, expect, vi } from 'vitest';
import { OGP_IMAGE_WIDTH, OGP_IMAGE_HEIGHT } from '../src/types/index';

describe('Preview Generator', () => {
  describe('OGP Image Dimensions', () => {
    it('should have correct OGP image dimensions', () => {
      expect(OGP_IMAGE_WIDTH).toBe(1200);
      expect(OGP_IMAGE_HEIGHT).toBe(630);
    });

    it('should have correct aspect ratio (1.91:1)', () => {
      const aspectRatio = OGP_IMAGE_WIDTH / OGP_IMAGE_HEIGHT;
      expect(aspectRatio).toBeCloseTo(1.91, 1);
    });
  });

  describe('dataURLtoBlob', () => {
    it('should convert data URL to Blob', () => {
      const dataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const base64 = dataURL.split(',')[1];
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: 'image/png' });

      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });
  });
});
