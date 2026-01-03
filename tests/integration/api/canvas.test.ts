import { describe, it, expect, beforeAll } from 'vitest';

// Integration tests for Canvas API endpoints
// These tests require a running backend server

const API_URL = 'http://localhost:8787';

describe('POST /canvas', () => {
  it('should create a new canvas with valid data', async () => {
    const response = await fetch(`${API_URL}/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerLat: 35.6812,
        centerLng: 139.7671,
        zoom: 14,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.canvas).toBeDefined();
    expect(data.canvas.id).toHaveLength(21);
    expect(data.canvas.centerLat).toBe(35.6812);
    expect(data.canvas.centerLng).toBe(139.7671);
    expect(data.canvas.zoom).toBe(14);
    expect(data.canvas.tileCount).toBe(0);
  });

  it('should reject invalid latitude', async () => {
    const response = await fetch(`${API_URL}/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerLat: 100, // Invalid: > 90
        centerLng: 139.7671,
        zoom: 14,
      }),
    });

    expect(response.status).toBe(400);
  });

  it('should reject invalid zoom level', async () => {
    const response = await fetch(`${API_URL}/canvas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centerLat: 35.6812,
        centerLng: 139.7671,
        zoom: 25, // Invalid: > 19
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe('GET /canvas/:id', () => {
  it('should return 404 for non-existent canvas', async () => {
    const response = await fetch(`${API_URL}/canvas/nonexistent12345678901`);
    expect(response.status).toBe(404);
  });

  it('should return canvas with tiles list', async () => {
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

    // Then fetch it
    const response = await fetch(`${API_URL}/canvas/${canvas.id}`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.canvas.id).toBe(canvas.id);
    expect(data.tiles).toEqual([]);
  });
});
