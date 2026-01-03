import { describe, it, expect, beforeEach } from 'vitest';

// Integration tests for Layers API endpoints
// These tests require a running backend server

const API_URL = 'http://localhost:8787/api';

// Helper to create a canvas for testing
async function createTestCanvas() {
  const response = await fetch(`${API_URL}/canvas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      centerLat: 35.6812,
      centerLng: 139.7671,
      zoom: 14,
    }),
  });
  const { canvas } = await response.json();
  return canvas;
}

describe('GET /canvas/:canvasId/layers', () => {
  it('should return empty layers list for new canvas', async () => {
    const canvas = await createTestCanvas();

    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.layers).toEqual([]);
  });

  it('should return 404 for non-existent canvas', async () => {
    const response = await fetch(`${API_URL}/canvas/nonexistent12345678901/layers`);
    expect(response.status).toBe(404);
  });
});

describe('POST /canvas/:canvasId/layers', () => {
  it('should create a new layer with auto-generated name', async () => {
    const canvas = await createTestCanvas();

    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.layer).toBeDefined();
    expect(data.layer.id).toHaveLength(21);
    expect(data.layer.canvasId).toBe(canvas.id);
    expect(data.layer.name).toMatch(/^レイヤー \d+$/);
    expect(data.layer.order).toBe(0);
    expect(data.layer.visible).toBe(true);
  });

  it('should create a new layer with custom name', async () => {
    const canvas = await createTestCanvas();

    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '背景' }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.layer.name).toBe('背景');
  });

  it('should increment order for each new layer', async () => {
    const canvas = await createTestCanvas();

    // Create first layer
    const res1 = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const layer1 = (await res1.json()).layer;

    // Create second layer
    const res2 = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const layer2 = (await res2.json()).layer;

    expect(layer1.order).toBe(0);
    expect(layer2.order).toBe(1);
  });

  it('should reject creation when max layers reached', async () => {
    const canvas = await createTestCanvas();

    // Create 10 layers
    for (let i = 0; i < 10; i++) {
      await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }

    // Try to create 11th layer
    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('MAX_LAYERS_EXCEEDED');
  });
});

describe('PATCH /canvas/:canvasId/layers/:id', () => {
  it('should update layer name', async () => {
    const canvas = await createTestCanvas();

    // Create layer
    const createRes = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { layer } = await createRes.json();

    // Update name
    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers/${layer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新しい名前' }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.layer.name).toBe('新しい名前');
  });

  it('should update layer visibility', async () => {
    const canvas = await createTestCanvas();

    // Create layer
    const createRes = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { layer } = await createRes.json();

    // Update visibility
    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers/${layer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: false }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.layer.visible).toBe(false);
  });

  it('should update layer order', async () => {
    const canvas = await createTestCanvas();

    // Create two layers
    await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const createRes2 = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const layer2 = (await createRes2.json()).layer;

    // Move layer2 to position 0
    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers/${layer2.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: 0 }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.layer.order).toBe(0);
  });

  it('should return 404 for non-existent layer', async () => {
    const canvas = await createTestCanvas();

    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers/nonexistent12345678901`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    });

    expect(response.status).toBe(404);
  });
});

describe('DELETE /canvas/:canvasId/layers/:id', () => {
  it('should delete a layer', async () => {
    const canvas = await createTestCanvas();

    // Create two layers (need at least 2 to delete one)
    await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const createRes2 = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const layer2 = (await createRes2.json()).layer;

    // Delete second layer
    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers/${layer2.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);

    // Verify layer is gone
    const listRes = await fetch(`${API_URL}/canvas/${canvas.id}/layers`);
    const { layers } = await listRes.json();
    expect(layers.length).toBe(1);
  });

  it('should not delete the last layer', async () => {
    const canvas = await createTestCanvas();

    // Create one layer
    const createRes = await fetch(`${API_URL}/canvas/${canvas.id}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const { layer } = await createRes.json();

    // Try to delete the only layer
    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers/${layer.id}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('CANNOT_DELETE_LAST_LAYER');
  });

  it('should return 404 for non-existent layer', async () => {
    const canvas = await createTestCanvas();

    const response = await fetch(`${API_URL}/canvas/${canvas.id}/layers/nonexistent12345678901`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
  });
});
