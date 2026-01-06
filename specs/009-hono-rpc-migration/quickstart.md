# Quickstart: Hono RPC Migration Guide

**Date**: 2026-01-06
**Feature**: 009-hono-rpc-migration
**Audience**: Developers working on oekaki-map

## Overview

This guide provides step-by-step instructions for migrating from manual fetch API calls to Hono RPC. The migration can be done incrementally - you can migrate one API domain at a time while keeping the rest on the old client.

## Prerequisites

Before starting:
- ✅ Node.js 20+
- ✅ pnpm installed
- ✅ Backend and frontend running locally
- ✅ Familiarity with TypeScript and React

## Quick Start (5 Minutes)

### 1. Verify Setup

Check that both backend and frontend are using Hono 4.6.0:

```bash
# Backend
cd backend && grep "hono" package.json
# Should show: "hono": "^4.6.0"

# Frontend
cd ../frontend && grep "hono" package.json
# Should show: "hono": "^4.6.0"
```

### 2. Create RPC Client

Create `frontend/src/services/rpc.ts`:

```typescript
import { hc } from 'hono/client';
import type { AppType } from '../../../backend/src/index';

// Create type-safe RPC client
export const client = hc<AppType>('/');

// Helper for error handling
export type RpcResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export async function callRpc<T>(
  rpc: Promise<Response>
): Promise<RpcResult<T>> {
  try {
    const response = await rpc;

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: errorText };
    }

    const data = await response.json() as T;
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### 3. Test RPC Connection

Create a simple test to verify RPC works:

```typescript
// Test in browser console or create a test file
import { client, callRpc } from './services/rpc';

// Test GET request
const { data, error } = await callRpc(
  client.api.canvas[':id'].$get({ param: { id: 'test-canvas-id' } })
);

if (error) {
  console.error('RPC Error:', error);
} else {
  console.log('RPC Success:', data);
}
```

If you see type autocomplete working and the request succeeds, RPC is set up correctly!

## Migration Patterns

### Pattern 1: Simple GET Request

**Before**:
```typescript
async function getCanvas(id: string) {
  const res = await fetch(`/api/canvas/${id}`);
  if (!res.ok) throw new Error('Failed to get canvas');
  return res.json() as Promise<GetCanvasResponse>;
}
```

**After**:
```typescript
async function getCanvas(id: string) {
  const { data, error } = await callRpc(
    client.api.canvas[':id'].$get({ param: { id } })
  );
  if (error) throw new Error(error);
  return data; // Type: GetCanvasResponse (inferred!)
}
```

**Key Changes**:
1. Replace `fetch()` with `client.api.canvas[':id'].$get()`
2. Use `callRpc()` wrapper for consistent error handling
3. Remove `as Promise<GetCanvasResponse>` - type is inferred
4. Pass parameters via `{ param: { id } }`

### Pattern 2: POST with JSON Body

**Before**:
```typescript
async function createCanvas(data: CreateCanvasRequest) {
  const res = await fetch('/api/canvas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create canvas');
  return res.json() as Promise<{ canvas: Canvas }>;
}
```

**After**:
```typescript
async function createCanvas(data: CreateCanvasRequest) {
  const { data: result, error } = await callRpc(
    client.api.canvas.$post({ json: data })
  );
  if (error) throw new Error(error);
  return result; // Type: { canvas: Canvas }
}
```

**Key Changes**:
1. Replace `fetch()` with `client.api.canvas.$post()`
2. Pass JSON body via `{ json: data }`
3. No need for `JSON.stringify()` or Content-Type header
4. Type is automatically inferred from backend

### Pattern 3: PATCH with Partial Update

**Before**:
```typescript
async function updateCanvas(id: string, updates: Partial<Canvas>) {
  const res = await fetch(`/api/canvas/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update canvas');
  return res.json() as Promise<Canvas>;
}
```

**After**:
```typescript
async function updateCanvas(id: string, updates: UpdateCanvasRequest) {
  const { data, error } = await callRpc(
    client.api.canvas[':id'].$patch({
      param: { id },
      json: updates
    })
  );
  if (error) throw new Error(error);
  return data; // Type: Canvas
}
```

**Key Changes**:
1. Use `$patch()` method
2. Combine `param` and `json` in single object
3. TypeScript validates `updates` against `UpdateCanvasRequest`

### Pattern 4: FormData Upload (Hybrid)

**Before**:
```typescript
async function uploadTiles(canvasId: string, tiles: TileData[]) {
  const formData = new FormData();
  tiles.forEach((tile, i) => {
    formData.append(`tile_${i}_image`, tile.blob);
    // ...
  });

  const res = await fetch(`/api/canvas/${canvasId}/tiles`, {
    method: 'POST',
    body: formData
  });
  return res.json() as Promise<SaveTilesResponse>;
}
```

**After** (Hybrid approach):
```typescript
async function uploadTiles(canvasId: string, tiles: TileData[]) {
  // Get type-safe URL from RPC
  const url = client.api.canvas[':id'].tiles.$url({
    param: { id: canvasId }
  });

  // Build FormData same as before
  const formData = new FormData();
  tiles.forEach((tile, i) => {
    formData.append(`tile_${i}_image`, tile.blob);
    // ...
  });

  // Manual fetch with RPC-generated URL
  const res = await fetch(url, {
    method: 'POST',
    body: formData
  });
  return res.json() as Promise<SaveTilesResponse>;
}
```

**Key Changes**:
1. Use `$url()` to generate type-safe URL
2. Keep FormData building logic unchanged
3. Use manual `fetch()` for actual upload
4. Type assertion still needed for response (RPC limitation)

**Why Hybrid**: Hono RPC doesn't support FormData natively. Using `$url()` provides URL type safety while keeping proven FormData upload logic.

## Step-by-Step Migration

### Step 1: Migrate Canvas API (P1 - 30 min)

**File**: `frontend/src/hooks/useCanvas.ts`

1. Add RPC import at top:
   ```typescript
   import { client, callRpc } from '../services/rpc';
   ```

2. Replace `api.canvas.get()` with RPC:
   ```typescript
   // Before
   const canvas = await api.canvas.get(canvasId);

   // After
   const { data, error } = await callRpc(
     client.api.canvas[':id'].$get({ param: { id: canvasId } })
   );
   if (error) throw new Error(error);
   const canvas = data.canvas;
   ```

3. Replace `api.canvas.create()` with RPC:
   ```typescript
   // Before
   const { canvas } = await api.canvas.create(position);

   // After
   const { data, error } = await callRpc(
     client.api.canvas.$post({ json: position })
   );
   if (error) throw new Error(error);
   const canvas = data.canvas;
   ```

4. Replace `api.canvas.update()` with RPC:
   ```typescript
   // Before
   await api.canvas.update(canvasId, updates);

   // After
   const { error } = await callRpc(
     client.api.canvas[':id'].$patch({
       param: { id: canvasId },
       json: updates
     })
   );
   if (error) throw new Error(error);
   ```

5. Test in browser:
   - Open canvas page
   - Check that canvas loads correctly
   - Try moving map (should save position)
   - Verify no console errors

**Verification**:
- ✅ TypeScript compiles without errors
- ✅ IDE shows autocomplete for `client.api.canvas.*`
- ✅ Canvas operations work same as before
- ✅ Network tab shows same API calls

### Step 2: Migrate Layers API (P2 - 20 min)

**File**: `frontend/src/hooks/useLayers.ts`

Follow same pattern as Canvas:
- Import RPC client
- Replace `api.layers.*` with `client.api.canvas[':canvasId'].layers.*`
- Update all CRUD operations

### Step 3: Migrate Tiles API (P2 - 45 min)

**File**: `frontend/src/hooks/useCanvas.ts` (tile save logic)

Special case - use hybrid approach:

```typescript
// Tile GET (list) - full RPC
const { data, error } = await callRpc(
  client.api.canvas[':id'].tiles.$get({
    param: { id: canvasId },
    query: { z: String(z), minX: String(minX), /* ... */ }
  })
);

// Tile POST (upload) - hybrid
const url = client.api.canvas[':id'].tiles.$url({
  param: { id: canvasId }
});
const formData = buildFormData(tiles);
const res = await fetch(url, { method: 'POST', body: formData });
```

### Step 4: Migrate OGP API (P3 - 15 min)

**File**: `frontend/src/hooks/useShare.ts`

Similar to tiles - use hybrid for POST, full RPC for GET:

```typescript
// OGP GET - full RPC
const { data, error } = await callRpc(
  client.api.ogp[':canvasId'].$get({ param: { canvasId } })
);

// OGP POST (image upload) - hybrid
const url = client.api.ogp[':canvasId'].$url({ param: { canvasId } });
const formData = new FormData();
formData.append('image', image);
formData.append('placeName', placeName);
const res = await fetch(url, { method: 'POST', body: formData });
```

### Step 5: Migrate Logs API (P3 - 10 min)

**File**: `frontend/src/services/logger.ts`

Straightforward POST migrations:

```typescript
// Error logging
await client.api.logs.error.$post({
  json: { message, stack, context }
});

// Debug logging
await client.api.logs.debug.$post({
  json: { message }
});
```

### Step 6: Remove Old API Client (P3 - 5 min)

Once all hooks migrated:

1. Delete `frontend/src/services/api.ts`
2. Update imports in all files
3. Run full test suite
4. Deploy to preview environment

## Development Workflow

### Running Dev Servers

**Terminal 1 - Backend**:
```bash
cd backend
pnpm dev
# Runs on http://localhost:8787
```

**Terminal 2 - Frontend**:
```bash
cd frontend
pnpm dev
# Runs on http://localhost:5173
# Proxies /api/* to http://localhost:8787
```

### Type Sync Verification

1. Make a change in backend (e.g., add field to Canvas type):
   ```typescript
   // backend/src/types/index.ts
   export type Canvas = {
     // ... existing fields
     newField: string; // ADD THIS
   };
   ```

2. In frontend IDE, type `client.api.canvas.$post()` and check autocomplete
   - Should see `newField` in suggestions within ~5 seconds
   - If not, restart TypeScript language server in IDE

3. Try using new field:
   ```typescript
   const { data } = await callRpc(
     client.api.canvas.$post({ json: createData })
   );
   console.log(data.canvas.newField); // ✅ Autocomplete works!
   ```

### Debugging Tips

**Problem**: Type autocomplete not working

**Solutions**:
1. Check Hono version matches in both frontend/backend
2. Restart TypeScript language server (VS Code: Cmd+Shift+P → "Restart TS Server")
3. Verify `export type AppType = typeof app;` exists in backend
4. Check frontend can import: `import type { AppType } from '@backend/index'`

**Problem**: `$url()` returns wrong path

**Solutions**:
1. Check param names match route definition exactly
2. Verify you're using correct HTTP method (`$get`, `$post`, etc.)
3. Inspect generated URL in debugger

**Problem**: FormData upload fails

**Solutions**:
1. **DO NOT** set `Content-Type` header manually
2. Let browser set `multipart/form-data` with boundary
3. Verify FormData is built correctly (check with `formData.entries()`)

## Testing Strategy

### Unit Tests

Mock RPC client in tests:

```typescript
import { vi } from 'vitest';
import type { AppType } from '@backend/index';

const mockClient = {
  api: {
    canvas: {
      $get: vi.fn(),
      $post: vi.fn(),
    },
  },
};

vi.mock('hono/client', () => ({
  hc: () => mockClient,
}));

// In test
mockClient.api.canvas.$get.mockResolvedValue({
  ok: true,
  json: async () => ({ canvas: mockCanvas }),
});
```

### Integration Tests

Test against real backend:

```typescript
import { hc } from 'hono/client';
import type { AppType } from '@backend/index';

describe('Canvas RPC Integration', () => {
  const client = hc<AppType>('http://localhost:8787');

  it('creates canvas', async () => {
    const res = await client.api.canvas.$post({
      json: { centerLat: 35.6812, centerLng: 139.7671, zoom: 15 }
    });

    expect(res.ok).toBe(true);
    const { canvas } = await res.json();
    expect(canvas.id).toBeDefined();
  });
});
```

### E2E Tests

No changes needed - Playwright tests use UI, not API directly:

```typescript
// Existing E2E tests work unchanged
await page.goto('/');
await page.click('[data-testid="create-canvas"]');
// ... RPC is transparent to E2E tests
```

## Common Pitfalls

### ❌ DON'T: Mix RPC and manual fetch for same endpoint

```typescript
// BAD - inconsistent
const res1 = await client.api.canvas.$get({ param: { id } });
const res2 = await fetch(`/api/canvas/${id}`);
```

```typescript
// GOOD - pick one approach per endpoint
const res = await client.api.canvas.$get({ param: { id } });
```

### ❌ DON'T: Forget to check `res.ok`

```typescript
// BAD - assumes success
const res = await client.api.canvas.$get({ param: { id } });
const data = await res.json(); // May throw if 404!
```

```typescript
// GOOD - check status first
const res = await client.api.canvas.$get({ param: { id } });
if (!res.ok) throw new Error('Failed to get canvas');
const data = await res.json();
```

### ❌ DON'T: Set Content-Type for FormData

```typescript
// BAD - breaks multipart boundary
await fetch(url, {
  headers: { 'Content-Type': 'multipart/form-data' }, // MISSING BOUNDARY!
  body: formData
});
```

```typescript
// GOOD - let browser set it
await fetch(url, {
  body: formData // Browser adds Content-Type with boundary
});
```

### ✅ DO: Use error wrapper consistently

```typescript
// GOOD - centralized error handling
const { data, error } = await callRpc(
  client.api.canvas.$get({ param: { id } })
);
if (error) {
  console.error(error);
  toast.error('Failed to load canvas');
  return;
}
// data is typed here
```

## Success Criteria Checklist

After migration:

- [ ] All 20 endpoints migrated to RPC (or hybrid)
- [ ] No manual type assertions (`as`) in API calls
- [ ] IDE autocomplete works for all endpoints
- [ ] Backend type changes trigger frontend errors
- [ ] Code reduced by 30% (check `api.ts` LOC before/after)
- [ ] All existing features still work
- [ ] Preview environment validated
- [ ] Tests updated and passing

## Next Steps

After completing migration:

1. **Monitor Performance**: Compare response times (target: no degradation)
2. **Gather Feedback**: Ask team about developer experience
3. **Document Learnings**: Update this guide with any issues encountered
4. **Plan Next Features**: Use RPC for all new endpoints going forward

## Support

**Questions?** Check these resources:
- [research.md](./research.md) - Detailed RPC research
- [contracts/rpc-api.md](./contracts/rpc-api.md) - Full endpoint mapping
- [data-model.md](./data-model.md) - Type structure reference
- [Hono RPC Docs](https://hono.dev/docs/guides/rpc) - Official documentation

**Found an issue?** Create a GitHub issue or update this guide.
