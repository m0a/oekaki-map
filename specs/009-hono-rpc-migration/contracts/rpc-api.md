# RPC API Contracts

**Date**: 2026-01-06
**Feature**: 009-hono-rpc-migration

## Overview

This document maps all existing REST API endpoints to their Hono RPC client equivalents. Each endpoint shows the before/after migration patterns with full type information.

## API Domains

The oekaki-map API consists of 5 domains:

1. **Canvas** - Drawing canvas CRUD operations
2. **Tiles** - Tile image storage and retrieval
3. **Layers** - Layer management
4. **OGP** - Open Graph Protocol metadata and images
5. **Logs** - Error and debug logging

## 1. Canvas API

### POST /api/canvas

**Purpose**: Create new canvas

**Before** (manual fetch):
```typescript
const res = await fetch('/api/canvas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    centerLat: 35.6812,
    centerLng: 139.7671,
    zoom: 15
  })
});
const data = await res.json() as { canvas: Canvas };
```

**After** (RPC):
```typescript
const res = await client.api.canvas.$post({
  json: {
    centerLat: 35.6812,
    centerLng: 139.7671,
    zoom: 15
  }
});
const data = await res.json(); // Type: { canvas: Canvas }
```

**Type Safety Improvements**:
- ✅ Request validated against `CreateCanvasRequest` at compile time
- ✅ Response type automatically inferred (no `as`)
- ✅ IDE autocomplete for all fields

---

### GET /api/canvas/:id

**Purpose**: Retrieve canvas by ID

**Before**:
```typescript
const res = await fetch(`/api/canvas/${canvasId}`);
if (!res.ok) {
  if (res.status === 404) throw new Error('Canvas not found');
  throw new Error('Failed to get canvas');
}
const data = await res.json() as GetCanvasResponse;
```

**After**:
```typescript
const res = await client.api.canvas[':id'].$get({
  param: { id: canvasId }
});
if (!res.ok) {
  if (res.status === 404) throw new Error('Canvas not found');
  throw new Error('Failed to get canvas');
}
const data = await res.json(); // Type: GetCanvasResponse
```

**Type Safety Improvements**:
- ✅ Parameter `id` validated at compile time
- ✅ 404 status code typed in response
- ✅ No manual type assertion needed

---

### PATCH /api/canvas/:id

**Purpose**: Update canvas metadata (position or share state)

**Before**:
```typescript
const res = await fetch(`/api/canvas/${canvasId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    centerLat: newLat,
    centerLng: newLng,
    zoom: newZoom
  })
});
const updated = await res.json() as Canvas;
```

**After**:
```typescript
const res = await client.api.canvas[':id'].$patch({
  param: { id: canvasId },
  json: {
    centerLat: newLat,
    centerLng: newLng,
    zoom: newZoom
  }
});
const updated = await res.json(); // Type: Canvas
```

**Type Safety Improvements**:
- ✅ Partial update validated against `UpdateCanvasRequest`
- ✅ Unknown fields rejected at compile time
- ✅ Response type automatically inferred

---

## 2. Tiles API

### GET /api/canvas/:id/tiles

**Purpose**: Get list of tiles for visible area

**Before**:
```typescript
const params = new URLSearchParams({
  z: String(z),
  minX: String(minX),
  maxX: String(maxX),
  minY: String(minY),
  maxY: String(maxY)
});
const res = await fetch(`/api/canvas/${canvasId}/tiles?${params}`);
const data = await res.json() as { tiles: TileCoordinate[] };
```

**After**:
```typescript
const res = await client.api.canvas[':id'].tiles.$get({
  param: { id: canvasId },
  query: {
    z: String(z),
    minX: String(minX),
    maxX: String(maxX),
    minY: String(minY),
    maxY: String(maxY)
  }
});
const data = await res.json(); // Type: { tiles: TileCoordinate[] }
```

**Type Safety Improvements**:
- ✅ Query parameters validated at compile time
- ✅ Missing parameters detected before runtime
- ✅ Response type automatically inferred

---

### POST /api/canvas/:id/tiles

**Purpose**: Upload tile images (FormData)

**Before**:
```typescript
const formData = new FormData();
tiles.forEach((tile, index) => {
  formData.append(`tile_${index}_z`, String(tile.z));
  formData.append(`tile_${index}_x`, String(tile.x));
  formData.append(`tile_${index}_y`, String(tile.y));
  formData.append(`tile_${index}_image`, tile.blob);
});
formData.append('count', String(tiles.length));

const res = await fetch(`/api/canvas/${canvasId}/tiles`, {
  method: 'POST',
  body: formData
});
const data = await res.json() as SaveTilesResponse;
```

**After** (Hybrid RPC/fetch):
```typescript
// Get type-safe URL from RPC client
const url = client.api.canvas[':id'].tiles.$url({
  param: { id: canvasId }
});

// Build FormData (same as before)
const formData = new FormData();
tiles.forEach((tile, index) => {
  formData.append(`tile_${index}_z`, String(tile.z));
  formData.append(`tile_${index}_x`, String(tile.x));
  formData.append(`tile_${index}_y`, String(tile.y));
  formData.append(`tile_${index}_image`, tile.blob);
});
formData.append('count', String(tiles.length));

// Manual fetch with RPC-generated URL
const res = await fetch(url, {
  method: 'POST',
  body: formData
});
const data = await res.json() as SaveTilesResponse;
```

**Rationale for Hybrid Approach**:
- ⚠️ Hono RPC doesn't support FormData natively (as of 2026-01)
- ✅ Using `$url()` provides type-safe URL generation
- ✅ FormData handling unchanged (proven to work)
- ✅ Response still needs manual type assertion (no RPC for response parsing)

**Alternative Considered**:
```typescript
// Could use RPC's form syntax (experimental)
const res = await client.api.canvas[':id'].tiles.$post({
  param: { id: canvasId },
  form: formData  // May not work reliably
});
```

**Decision**: Use `$url()` + manual fetch for reliability

---

### GET /api/tiles/:canvasId/:z/:x/:y.webp

**Purpose**: Retrieve individual tile image

**Before**:
```typescript
function getImageUrl(
  canvasId: string,
  z: number,
  x: number,
  y: number,
  updatedAt?: string
): string {
  const base = `/api/tiles/${canvasId}/${z}/${x}/${y}.webp`;
  return updatedAt ? `${base}?v=${updatedAt}` : base;
}

// Used in <img src={getImageUrl(...)} />
```

**After** (URL generation only):
```typescript
function getImageUrl(
  canvasId: string,
  z: number,
  x: number,
  y: number,
  updatedAt?: string
): string {
  const base = client.api.tiles[':canvasId'][':z'][':x'][':y.webp'].$url({
    param: { canvasId, z: String(z), x: String(x), y: String(y) }
  });
  return updatedAt ? `${base}?v=${updatedAt}` : base;
}
```

**Type Safety Improvements**:
- ✅ URL parameters validated at compile time
- ✅ Typos in parameter names caught by TypeScript
- ⚠️ Response is binary (WebP), no RPC type benefit

**Decision**: Keep manual URL construction (simpler, no type benefit for images)

---

## 3. Layers API

### GET /api/canvas/:canvasId/layers

**Purpose**: Get all layers for a canvas

**Before**:
```typescript
const res = await fetch(`/api/canvas/${canvasId}/layers`);
const data = await res.json() as GetLayersResponse;
```

**After**:
```typescript
const res = await client.api.canvas[':canvasId'].layers.$get({
  param: { canvasId }
});
const data = await res.json(); // Type: GetLayersResponse
```

---

### POST /api/canvas/:canvasId/layers

**Purpose**: Create new layer

**Before**:
```typescript
const res = await fetch(`/api/canvas/${canvasId}/layers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'New Layer' })
});
const data = await res.json() as { layer: Layer };
```

**After**:
```typescript
const res = await client.api.canvas[':canvasId'].layers.$post({
  param: { canvasId },
  json: { name: 'New Layer' }
});
const data = await res.json(); // Type: { layer: Layer }
```

---

### PUT /api/canvas/:canvasId/layers/:id

**Purpose**: Update layer (name, visibility, z-index)

**Before**:
```typescript
const res = await fetch(`/api/canvas/${canvasId}/layers/${layerId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ visible: false })
});
const data = await res.json() as { layer: Layer };
```

**After**:
```typescript
const res = await client.api.canvas[':canvasId'].layers[':id'].$put({
  param: { canvasId, id: layerId },
  json: { visible: false }
});
const data = await res.json(); // Type: { layer: Layer }
```

---

### DELETE /api/canvas/:canvasId/layers/:id

**Purpose**: Delete layer

**Before**:
```typescript
const res = await fetch(`/api/canvas/${canvasId}/layers/${layerId}`, {
  method: 'DELETE'
});
const data = await res.json() as { success: boolean };
```

**After**:
```typescript
const res = await client.api.canvas[':canvasId'].layers[':id'].$delete({
  param: { canvasId, id: layerId }
});
const data = await res.json(); // Type: { success: boolean }
```

---

## 4. OGP API

### POST /api/ogp/:canvasId

**Purpose**: Upload OGP preview image (FormData)

**Before**:
```typescript
const formData = new FormData();
formData.append('image', image, 'preview.png');
formData.append('placeName', placeName);

const res = await fetch(`/api/ogp/${canvasId}`, {
  method: 'POST',
  body: formData
});
const data = await res.json() as {
  success: boolean;
  imageUrl: string;
  placeName: string;
  generatedAt: string;
};
```

**After** (Hybrid RPC/fetch):
```typescript
const url = client.api.ogp[':canvasId'].$url({
  param: { canvasId }
});

const formData = new FormData();
formData.append('image', image, 'preview.png');
formData.append('placeName', placeName);

const res = await fetch(url, {
  method: 'POST',
  body: formData
});
const data = await res.json(); // Manual type assertion still needed
```

**Rationale**: Same as tiles - FormData not supported by RPC

---

### GET /api/ogp/:canvasId

**Purpose**: Get OGP metadata

**Before**:
```typescript
const res = await fetch(`/api/ogp/${canvasId}`);
const metadata = await res.json() as {
  title: string;
  description: string;
  imageUrl: string;
  // ...
};
```

**After**:
```typescript
const res = await client.api.ogp[':canvasId'].$get({
  param: { canvasId }
});
const metadata = await res.json(); // Type inferred automatically
```

---

## 5. Logs API

### POST /api/logs/error

**Purpose**: Log client-side errors

**Before**:
```typescript
await fetch('/api/logs/error', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: error.message,
    stack: error.stack,
    context: { page: '/canvas/123' }
  })
});
```

**After**:
```typescript
await client.api.logs.error.$post({
  json: {
    message: error.message,
    stack: error.stack,
    context: { page: '/canvas/123' }
  }
});
```

---

### POST /api/logs/debug

**Purpose**: Log debug information

**Before**:
```typescript
await fetch('/api/logs/debug', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Debug info' })
});
```

**After**:
```typescript
await client.api.logs.debug.$post({
  json: { message: 'Debug info' }
});
```

---

## Migration Summary

### Endpoints by Type

| Type | Count | RPC Strategy |
|------|-------|--------------|
| JSON GET | 5 | Full RPC with type inference |
| JSON POST/PATCH | 6 | Full RPC with type inference |
| DELETE | 1 | Full RPC with type inference |
| FormData POST | 2 | Hybrid: `$url()` + manual fetch |
| Image GET | 1 | Keep manual (no type benefit) |

### Type Safety Gains

| Endpoint | Before Type Safety | After Type Safety |
|----------|-------------------|-------------------|
| GET Canvas | Manual `as Canvas` | Automatic inference |
| POST Canvas | Manual `as { canvas: Canvas }` | Automatic inference |
| GET Layers | Manual `as GetLayersResponse` | Automatic inference |
| POST Tiles | Manual `as SaveTilesResponse` | Partial (hybrid approach) |
| All endpoints | No param validation | Compile-time param validation |

### Breaking Changes

**None** - All endpoints remain backward compatible. Migration is additive.

## Next Steps

See `quickstart.md` for step-by-step migration guide for developers.
