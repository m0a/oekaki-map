import { describe, it, expect } from 'vitest';

// Integration tests for Tiles API endpoints
// These tests require a running backend server with R2 bindings

const API_URL = 'http://localhost:8787';

describe('POST /canvas/:id/tiles', () => {
  it('should save tiles for existing canvas', async () => {
    // First create a canvas
    const createResponse = await fetch(`${API_URL}/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerLat: 35.6812,
        centerLng: 139.7671,
        zoom: 14,
      }),
    });
    const { canvas } = await createResponse.json();

    // Create a simple WebP-like blob for testing
    // In real tests, this would be an actual WebP image
    const tileBlob = new Blob(['test-image-data'], { type: 'image/webp' });

    const formData = new FormData();
    formData.append('tile_0_z', '14');
    formData.append('tile_0_x', '14354');
    formData.append('tile_0_y', '6451');
    formData.append('tile_0_image', tileBlob);
    formData.append('count', '1');

    const response = await fetch(`${API_URL}/canvas/${canvas.id}/tiles`, {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.saved).toHaveLength(1);
    expect(data.saved[0]).toEqual({ z: 14, x: 14354, y: 6451 });
    expect(data.canvas.tileCount).toBe(1);
  });

  it('should return 404 for non-existent canvas', async () => {
    const formData = new FormData();
    formData.append('tile_0_z', '14');
    formData.append('tile_0_x', '14354');
    formData.append('tile_0_y', '6451');
    formData.append('tile_0_image', new Blob(['test'], { type: 'image/webp' }));
    formData.append('count', '1');

    const response = await fetch(
      `${API_URL}/canvas/nonexistent12345678901/tiles`,
      {
        method: 'POST',
        body: formData,
      }
    );

    expect(response.status).toBe(404);
  });
});

describe('GET /canvas/:id/tiles', () => {
  it('should return tiles in visible area', async () => {
    // First create a canvas with a tile
    const createResponse = await fetch(`${API_URL}/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerLat: 35.6812,
        centerLng: 139.7671,
        zoom: 14,
      }),
    });
    const { canvas } = await createResponse.json();

    // Query tiles in an area
    const params = new URLSearchParams({
      z: '14',
      minX: '14350',
      maxX: '14360',
      minY: '6450',
      maxY: '6460',
    });

    const response = await fetch(
      `${API_URL}/canvas/${canvas.id}/tiles?${params}`
    );
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data.tiles)).toBe(true);
  });
});

describe('GET /tiles/:canvasId/:z/:x/:y.webp', () => {
  it('should return 404 for non-existent tile', async () => {
    const response = await fetch(
      `${API_URL}/tiles/nonexistent12345678901/14/14354/6451.webp`
    );
    expect(response.status).toBe(404);
  });
});
