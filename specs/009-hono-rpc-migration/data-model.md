# Data Model: Hono RPC Migration

**Date**: 2026-01-06
**Feature**: 009-hono-rpc-migration

## Overview

This document maps the existing API data structures to Hono RPC types. The migration is type-preserving - no data model changes are required. We're simply making the existing types flow end-to-end from backend to frontend automatically.

## Type Export Strategy

### Backend Type Exports

The backend already exports `AppType` from `backend/src/index.ts:144`:

```typescript
export type AppType = typeof app;
```

Additionally, shared domain types are exported from `backend/src/types/index.ts`:

```typescript
export type {
  Canvas,
  TileCoordinate,
  Layer,
  CreateCanvasRequest,
  UpdateCanvasRequest,
  GetCanvasResponse,
  SaveTilesResponse,
  CreateLayerRequest,
  UpdateLayerRequest,
  GetLayersResponse,
}
```

### Frontend Type Imports

**Before Migration** (manual sync):
```typescript
// frontend/src/types/index.ts - duplicated definitions
export type Canvas = {
  id: string;
  centerLat: number;
  // ... manually kept in sync
};
```

**After Migration** (automatic sync):
```typescript
// frontend/src/services/api.ts
import type { AppType } from '../../../backend/src/index';
import type { Canvas, Layer } from '../../../backend/src/types';
```

## Core Domain Types

### 1. Canvas

**Location**: `backend/src/types/index.ts`

```typescript
export type Canvas = {
  id: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  createdAt: string;
  updatedAt: string;
  // Share state (for URL sharing)
  shareLat: number | null;
  shareLng: number | null;
  shareZoom: number | null;
  // OGP metadata
  ogpPlaceName: string | null;
  ogpImageKey: string | null;
  ogpGeneratedAt: string | null;
};
```

**RPC Type Mapping**:
- GET `/api/canvas/:id` → `{ canvas: Canvas }`
- POST `/api/canvas` → `{ canvas: Canvas }`
- PATCH `/api/canvas/:id` → `Canvas`

**Validation**: Zod schema in `backend/src/routes/canvas.ts`

### 2. Layer

**Location**: `backend/src/types/index.ts`

```typescript
export type Layer = {
  id: string;
  canvasId: string;
  name: string;
  zIndex: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
};
```

**RPC Type Mapping**:
- GET `/api/canvas/:canvasId/layers` → `{ layers: Layer[] }`
- POST `/api/canvas/:canvasId/layers` → `{ layer: Layer }`
- PUT `/api/canvas/:canvasId/layers/:id` → `{ layer: Layer }`
- DELETE `/api/canvas/:canvasId/layers/:id` → `{ success: boolean }`

**Constraints**:
- Maximum 10 layers per canvas
- `zIndex` auto-assigned on creation

### 3. TileCoordinate

**Location**: `backend/src/types/index.ts`

```typescript
export type TileCoordinate = {
  canvasId: string;
  z: number;
  x: number;
  y: number;
  updatedAt: string;
};
```

**RPC Type Mapping**:
- GET `/api/canvas/:id/tiles` → `{ tiles: TileCoordinate[] }`
- POST `/api/canvas/:id/tiles` → `{ saved: TileCoordinate[] }` (FormData)
- GET `/api/tiles/:canvasId/:z/:x/:y.webp` → Binary (WebP image)

**Note**: Tile image POST uses FormData (hybrid RPC/fetch approach)

### 4. Request/Response Types

#### Canvas Operations

```typescript
export type CreateCanvasRequest = {
  centerLat: number;
  centerLng: number;
  zoom: number;
};

export type UpdateCanvasRequest = Partial<{
  centerLat: number;
  centerLng: number;
  zoom: number;
  shareLat: number;
  shareLng: number;
  shareZoom: number;
}>;

export type GetCanvasResponse = {
  canvas: Canvas;
};
```

#### Layer Operations

```typescript
export type CreateLayerRequest = {
  name: string;
};

export type UpdateLayerRequest = {
  name?: string;
  visible?: boolean;
  zIndex?: number;
};

export type GetLayersResponse = {
  layers: Layer[];
};
```

#### Tile Operations

```typescript
export type SaveTilesResponse = {
  saved: TileCoordinate[];
};
```

## RPC Client Type Flow

### Type Inference Chain

1. **Backend defines routes**:
   ```typescript
   const canvasRoutes = new Hono()
     .post('/', zValidator('json', CreateCanvasSchema), (c) => {
       return c.json({ canvas: newCanvas }, 201);
     });
   ```

2. **AppType captures route signatures**:
   ```typescript
   export type AppType = typeof app;
   // Type includes: /api/canvas POST → { canvas: Canvas }
   ```

3. **Frontend client infers types**:
   ```typescript
   const client = hc<AppType>('/');

   // Autocomplete shows: client.api.canvas.$post
   const res = await client.api.canvas.$post({
     json: { /* CreateCanvasRequest */ }
   });

   // Type: { canvas: Canvas }
   const data = await res.json();
   ```

### Parameter Type Mapping

| Route Pattern | RPC Client Syntax | Type Source |
|---------------|-------------------|-------------|
| `/:id` | `[':id'].$get({ param: { id } })` | Path param |
| `?query=value` | `.$get({ query: { query } })` | Query param |
| `POST { json }` | `.$post({ json })` | Request body (Zod) |
| `POST FormData` | `$url()` + manual fetch | Hybrid approach |

### Response Type Mapping

| Backend Return | RPC Client Type | Parsing |
|----------------|-----------------|---------|
| `c.json({ canvas })` | `{ canvas: Canvas }` | `await res.json()` |
| `c.json({ layers }, 200)` | `{ layers: Layer[] }` | `await res.json()` |
| `c.json({ error }, 404)` | `{ error: string }` | `await res.json()` |
| `c.body(webp, 200)` | `Blob` | `await res.blob()` |

## Migration Impact Analysis

### No Schema Changes Required

✅ **Database schema**: Unchanged
✅ **API contracts**: Unchanged
✅ **Response formats**: Unchanged
✅ **Request formats**: Unchanged

### Type System Changes

| Aspect | Before | After |
|--------|--------|-------|
| Type definition | Duplicated (frontend + backend) | Single source (backend) |
| Type sync | Manual (copy-paste) | Automatic (TypeScript imports) |
| Type safety | Runtime only | Compile-time + runtime |
| Error detection | At runtime (fetch response) | At build time (TypeScript) |

### Frontend Code Changes

**Only client layer changes**:
- `frontend/src/services/api.ts` → Replace fetch with RPC
- `frontend/src/hooks/useCanvas.ts` → Import types from backend
- `frontend/src/hooks/useLayers.ts` → Import types from backend
- `frontend/src/hooks/useAutoSave.ts` → Use RPC client

**No changes needed**:
- React components (unchanged)
- Business logic (unchanged)
- UI/UX (unchanged)
- Test assertions (unchanged - just mock client)

## Type Safety Validation

### Compile-Time Checks

**Example**: Changing backend response type

```typescript
// Backend: Change Canvas type
export type Canvas = {
  id: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  newField: string; // NEW FIELD
  // ...
};

// Frontend: TypeScript immediately shows error
const { canvas } = await client.api.canvas.$post({ json: data });
console.log(canvas.newField); // ✅ Autocomplete works
console.log(canvas.oldField); // ❌ TypeScript error: Property doesn't exist
```

### Runtime Validation

Backend uses Zod for runtime validation:

```typescript
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const CreateCanvasSchema = z.object({
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  zoom: z.number().int().min(1).max(19),
});

canvasRoutes.post('/', zValidator('json', CreateCanvasSchema), (c) => {
  // Request is validated before reaching this handler
  const validated = c.req.valid('json'); // Type: CreateCanvasRequest
  // ...
});
```

**RPC maintains this**: Validation still happens on backend, RPC just adds compile-time checking.

## Type Compatibility Matrix

### Compatible Patterns

✅ JSON request/response
✅ Path parameters (`:id`)
✅ Query parameters (`?z=15`)
✅ Multiple HTTP methods (`$get`, `$post`, `$patch`, `$delete`)
✅ Status codes (typed in response)
✅ Error responses (typed with unions)

### Requires Workaround

⚠️ FormData uploads → Use `$url()` + manual fetch
⚠️ Binary responses (images) → Use `$url()` + manual fetch with caching
⚠️ Streaming responses → Not applicable (out of scope)

## Next Steps

See `contracts/rpc-api.md` for detailed endpoint-by-endpoint RPC mapping.
