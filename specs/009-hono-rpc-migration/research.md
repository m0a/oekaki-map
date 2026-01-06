# Hono RPC Migration Research

**Date**: 2026-01-06
**Project**: oekaki-map
**Context**: Migration from manual fetch API calls to Hono RPC for type-safe client-server communication

---

## 1. Hono RPC Client Setup: Using `hc()` with TypeScript

### Overview

Hono RPC provides end-to-end type safety between server and client by using TypeScript type inference. The `hc` function from `hono/client` creates a type-safe client where you pass `AppType` as a generic parameter and specify the server URL as an argument.

### How It Works

**Server Side** - Export the app type:
```typescript
// backend/src/index.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono<{ Bindings: Env }>();

// Define routes with validators
const canvasRoutes = app.post(
  '/canvas',
  zValidator('json', z.object({
    centerLat: z.number().min(-90).max(90),
    centerLng: z.number().min(-180).max(180),
    zoom: z.number().int().min(1).max(19),
  })),
  (c) => {
    return c.json({ canvas: { id: 'abc123', ... } }, 201);
  }
);

// Mount routes
app.route('/api/canvas', canvasRoutes);

// Export the type - this is critical for RPC
export type AppType = typeof app;

export default app;
```

**Client Side** - Import the type and create client:
```typescript
// frontend/src/services/api-client.ts
import { hc } from 'hono/client';
import type { AppType } from '../../../backend/src/index';

// Create type-safe client
const client = hc<AppType>('/'); // Base URL (same origin in production)

// Usage with full type safety and autocomplete
const res = await client.api.canvas.$post({
  json: {
    centerLat: 35.6812,
    centerLng: 139.7671,
    zoom: 15,
  },
});

if (res.ok) {
  const data = await res.json(); // Type: { canvas: Canvas }
  console.log(data.canvas.id);
}
```

### Key Features

1. **Automatic Type Inference**: The client infers both input types (from validators) and output types (from `c.json()` calls)
2. **Method Chaining**: Use `$get()`, `$post()`, `$patch()`, `$delete()` for HTTP methods
3. **IDE Autocomplete**: Full IntelliSense support for endpoints, parameters, and response types
4. **Compile-Time Safety**: TypeScript catches API mismatches at build time, not runtime

### RPC Method Patterns

```typescript
// GET request
const res = await client.api.canvas[':id'].$get({
  param: { id: 'canvas123' },
});

// POST with JSON body
const res = await client.api.canvas.$post({
  json: { centerLat: 35.6812, centerLng: 139.7671, zoom: 15 },
});

// GET with query parameters
const res = await client.api.canvas[':canvasId'].tiles.$get({
  param: { canvasId: 'abc123' },
  query: { z: '15', minX: '100', maxX: '110', minY: '200', maxY: '210' },
});

// PATCH request
const res = await client.api.canvas[':id'].$patch({
  param: { id: 'canvas123' },
  json: { shareLat: 35.6812, shareLng: 139.7671, shareZoom: 15 },
});

// DELETE request
const res = await client.api.canvas[':canvasId'].layers[':id'].$delete({
  param: { canvasId: 'abc123', id: 'layer456' },
});
```

### TypeScript Configuration Requirements

For RPC types to work properly in a monorepo, both client and server `tsconfig.json` must have:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Version Compatibility

**CRITICAL**: Use the same Hono version on both server and client. Version mismatches can cause type inference issues.

```json
// backend/package.json & frontend/package.json
{
  "dependencies": {
    "hono": "^4.6.0"  // Must match exactly
  }
}
```

### Performance Optimization

For large apps, use `hcWithType` instead of `hc` to pre-calculate types and improve IDE performance:

```typescript
import { hcWithType } from 'hono/client';
import type { AppType } from '../../../backend/src/index';

const client = hcWithType<AppType>()('/');
```

---

## 2. FormData Support: File Uploads with Hono RPC

### Current Limitation (Critical Finding)

**RPC mode does NOT natively support file uploading with FormData** as of January 2026. This is a known limitation documented in GitHub discussions and issues.

### Issues Encountered

1. **Issue #3513** (October 2024): Files not going through properly with Hono RPC
2. **Discussion #2298**: Confirms RPC mode lacks FormData support, "may be difficult to support"
3. **Issue #3141**: FormData upload issues from React Native to Hono

### Workaround Strategy: Hybrid Approach

For endpoints that require FormData (tile uploads, OGP image uploads), use **manual fetch with RPC-generated URLs**:

```typescript
import { hc } from 'hono/client';
import type { AppType } from '../../../backend/src/index';

const client = hc<AppType>('/');

// Use $url() to get type-safe URL, then manual fetch
async function uploadTiles(
  canvasId: string,
  tiles: Array<{ z: number; x: number; y: number; blob: Blob }>
) {
  // Get type-safe URL from RPC client
  const url = client.api.canvas[':canvasId'].tiles.$url({
    param: { canvasId },
  });

  // Build FormData manually
  const formData = new FormData();
  tiles.forEach((tile, index) => {
    formData.append(`tile_${index}_z`, String(tile.z));
    formData.append(`tile_${index}_x`, String(tile.x));
    formData.append(`tile_${index}_y`, String(tile.y));
    formData.append(`tile_${index}_image`, tile.blob);
  });
  formData.append('count', String(tiles.length));

  // Manual fetch - DO NOT set Content-Type header
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    // Browser sets Content-Type with boundary automatically
  });

  if (!res.ok) throw new Error('Failed to upload tiles');

  return res.json();
}
```

### Critical: Content-Type Header Handling

**NEVER manually set Content-Type header with FormData**. Common mistakes:

```typescript
// ❌ WRONG - Will fail because boundary is missing
await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'multipart/form-data' }, // Missing boundary!
  body: formData,
});

// ✅ CORRECT - Browser adds boundary automatically
await fetch(url, {
  method: 'POST',
  body: formData, // No Content-Type header needed
});
```

### Server-Side: FormData Parsing Still Works

While the RPC **client** doesn't support FormData, the Hono **server** handles it normally:

```typescript
// backend/src/routes/tiles.ts
tilesRoutes.post('/:canvasId/tiles', async (c) => {
  // Parse FormData on server side - works fine
  const formData = await c.req.formData();
  const count = parseInt(formData.get('count') as string, 10);

  for (let i = 0; i < count; i++) {
    const image = formData.get(`tile_${i}_image`) as File;
    const data = await image.arrayBuffer();
    // Process image...
  }

  return c.json({ saved: tiles });
});
```

### Migration Strategy for FormData Endpoints

For oekaki-map, we have 2 FormData endpoints:

1. **POST /api/canvas/:canvasId/tiles** - Tile image upload
2. **POST /api/ogp/:canvasId** - OGP preview image upload

**Recommended approach**:
- Use RPC client's `$url()` for type-safe URL generation
- Use manual `fetch()` for actual FormData upload
- Keep server-side code unchanged (FormData parsing works fine)
- Create wrapper functions to abstract the hybrid approach

```typescript
// Hybrid wrapper example
export const api = {
  tiles: {
    // RPC for GET (JSON responses)
    getForArea: (canvasId: string, params: GetTilesQuery) =>
      client.api.canvas[':canvasId'].tiles.$get({
        param: { canvasId },
        query: params,
      }),

    // Manual fetch for POST (FormData)
    save: async (canvasId: string, tiles: TileData[]) => {
      const url = client.api.canvas[':canvasId'].tiles.$url({
        param: { canvasId },
      });
      const formData = buildTilesFormData(tiles);
      return fetch(url, { method: 'POST', body: formData });
    },
  },
};
```

---

## 3. Error Handling: Best Practices for Hono RPC

### Two Types of Errors

1. **Controlled Errors**: HTTP responses you control (404, 400, 500)
2. **Uncontrolled Errors**: Network errors, timeouts, unexpected failures

### Backend: Centralized Error Handler

Use `app.onError()` for consistent error responses:

```typescript
// backend/src/index.ts
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

app.onError((err, c) => {
  console.error('=== Caught Error ===');

  // Handle Hono's HTTPException
  if (err instanceof HTTPException) {
    return c.text(err.message, err.status);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => e.message).join(', ');
    return c.text(messages, 400);
  }

  // Fallback for unknown errors
  console.error(err);
  return c.text('Internal server error', 500);
});
```

### Frontend: Type-Safe Error Wrapper

Create a wrapper function for consistent error handling:

```typescript
// frontend/src/services/rpc-wrapper.ts
import type { ClientResponse } from 'hono/client';

export type RpcResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export async function callRpc<T>(
  rpc: Promise<ClientResponse<T>>
): Promise<RpcResult<T>> {
  try {
    const response = await rpc;

    // Check HTTP status
    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: errorText };
    }

    // Parse JSON response
    const data = await response.json();
    return { data: data as T, error: null };
  } catch (error) {
    // Network error or parsing error
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### Usage Pattern

```typescript
// Clean error handling with destructuring
const { data, error } = await callRpc(
  client.api.canvas[':id'].$get({ param: { id: canvasId } })
);

if (error) {
  console.error('Failed to load canvas:', error);
  toast.error(error);
  return;
}

// data is correctly typed here
console.log(data.canvas.id);
```

### Type-Safe Status Codes

If you explicitly specify status codes in `c.json()`, they're added to the client type:

```typescript
// Backend
app.post('/canvas', (c) => {
  return c.json({ canvas: newCanvas }, 201); // Status code is part of type
});

// Frontend - status is typed
const res = await client.api.canvas.$post({ json: data });
if (res.status === 201) { // TypeScript knows about 201
  const { canvas } = await res.json();
}
```

### Enhanced Error Types with Discriminated Unions

For more granular error handling, use discriminated union types:

```typescript
// backend/src/types/errors.ts
export type ApiError =
  | { error: 'NOT_FOUND'; message: string }
  | { error: 'VALIDATION_ERROR'; message: string; fields: string[] }
  | { error: 'LIMIT_EXCEEDED'; message: string; limit: number }
  | { error: 'INTERNAL_ERROR'; message: string };

// Backend route
canvasRoutes.get('/:id', async (c) => {
  const canvas = await service.get(id);
  if (!canvas) {
    return c.json<ApiError>(
      { error: 'NOT_FOUND', message: 'Canvas not found' },
      404
    );
  }
  return c.json({ canvas });
});

// Frontend with type narrowing
const res = await client.api.canvas[':id'].$get({ param: { id } });
if (!res.ok) {
  const error = await res.json(); // Type: ApiError
  if (error.error === 'NOT_FOUND') {
    // TypeScript knows this is NOT_FOUND variant
    navigate('/404');
  }
}
```

### Error Boundary Integration (React)

```typescript
// frontend/src/hooks/useCanvasData.ts
import { useQuery } from '@tanstack/react-query';

export function useCanvasData(canvasId: string) {
  return useQuery({
    queryKey: ['canvas', canvasId],
    queryFn: async () => {
      const { data, error } = await callRpc(
        client.api.canvas[':id'].$get({ param: { id: canvasId } })
      );
      if (error) throw new Error(error);
      return data;
    },
  });
}
```

---

## 4. Development Workflow: Hot Reload and Type Sync

### Vite Dev Server Proxy Configuration

For development, proxy API requests from frontend dev server to backend:

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787', // Wrangler dev server
        changeOrigin: true,
        // No rewrite needed - preserve /api prefix
      },
    },
  },
});
```

### Monorepo Structure

For proper type sharing, use pnpm workspaces:

```
oekaki-map/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Exports AppType
│   │   └── types/index.ts    # Shared types
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   └── services/
│   │       └── api-client.ts  # Imports AppType
│   ├── package.json
│   └── tsconfig.json
├── package.json               # Workspace root
└── pnpm-workspace.yaml
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'backend'
  - 'frontend'
```

### TypeScript Project References

Enable type sharing without build step:

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "strict": true
  }
}
```

```json
// frontend/tsconfig.json
{
  "compilerOptions": {
    "strict": true
  },
  "references": [
    { "path": "../backend" }
  ]
}
```

### Hot Reload Development Flow

1. **Start backend dev server**:
   ```bash
   cd backend && pnpm dev
   # Wrangler dev runs on http://localhost:8787
   ```

2. **Start frontend dev server**:
   ```bash
   cd frontend && pnpm dev
   # Vite runs on http://localhost:5173
   # Proxies /api/* to http://localhost:8787
   ```

3. **Type sync happens automatically**:
   - Change backend route → TypeScript picks up new AppType
   - Frontend IDE shows type errors immediately
   - No manual build or codegen step needed

### Type Sync Timing

**Expected**: < 1 minute from backend change to frontend type availability

1. Save backend file (0s)
2. TypeScript Language Server recompiles (1-5s)
3. Frontend IDE refreshes types (1-5s)
4. Total: ~2-10 seconds in practice

### Watch Mode Optimization

For faster type updates, use TypeScript's watch mode in backend:

```json
// backend/package.json
{
  "scripts": {
    "dev": "wrangler dev",
    "dev:types": "tsc --watch --noEmit",
    "dev:all": "concurrently \"pnpm dev\" \"pnpm dev:types\""
  }
}
```

### IDE Configuration

For optimal experience in VS Code:

```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

---

## 5. Migration Strategy: Backward Compatibility and Gradual Rollout

### Phased Migration Approach

**Phase 1: Setup RPC Infrastructure (Non-Breaking)**
- Add `export type AppType = typeof app` to backend
- Install `hono` in frontend (already installed)
- Create RPC client wrapper alongside existing `api.ts`
- Add type sync via project references
- No changes to existing code

**Phase 2: Migrate JSON Endpoints (Low Risk)**
- Migrate simple GET/POST/PATCH endpoints that use JSON
- Start with read-only endpoints (GET canvas, GET layers)
- Keep FormData endpoints using manual fetch
- Run both old and new clients in parallel for validation

**Phase 3: Implement Hybrid FormData Pattern (Medium Risk)**
- Refactor FormData endpoints to use `$url()` + manual fetch
- Maintain existing server-side implementation
- Update client wrappers to use hybrid approach

**Phase 4: Complete Migration (Low Risk)**
- Remove old `api.ts` client functions
- Update all components to use new RPC client
- Clean up dead code

### Backward Compatibility Strategy

**Key Principle**: Server API remains unchanged, only client changes

```typescript
// OLD: Manual fetch (frontend/src/services/api.ts)
export const api = {
  canvas: {
    async get(id: string) {
      const res = await fetch(`/api/canvas/${id}`);
      if (!res.ok) throw new Error('Failed to get canvas');
      return res.json();
    },
  },
};

// NEW: RPC client (frontend/src/services/rpc-client.ts)
import { hc } from 'hono/client';
import type { AppType } from '../../../backend/src/index';

const client = hc<AppType>('/');

export const rpcApi = {
  canvas: {
    async get(id: string) {
      const { data, error } = await callRpc(
        client.api.canvas[':id'].$get({ param: { id } })
      );
      if (error) throw new Error(error);
      return data;
    },
  },
};

// TRANSITION: Keep both, gradually switch imports
// import { api } from './api'; // Old
import { rpcApi as api } from './rpc-client'; // New
```

### Coexistence Pattern

Both clients can run simultaneously during migration:

```typescript
// Component during migration
import { api as oldApi } from '@/services/api';
import { rpcApi } from '@/services/rpc-client';

function CanvasEditor() {
  // Use old API for FormData (still works)
  const saveTiles = async (tiles: TileData[]) => {
    await oldApi.tiles.save(canvasId, tiles);
  };

  // Use RPC for JSON endpoints (better types)
  const loadCanvas = async () => {
    const { data, error } = await callRpc(
      rpcApi.canvas.get(canvasId)
    );
    if (error) throw error;
    return data;
  };
}
```

### Validation Strategy

Run both clients in parallel during migration to validate consistency:

```typescript
// Validation mode (temporary)
async function getCanvasWithValidation(id: string) {
  const [oldResult, newResult] = await Promise.all([
    oldApi.canvas.get(id),
    rpcApi.canvas.get(id),
  ]);

  // Log discrepancies in development
  if (JSON.stringify(oldResult) !== JSON.stringify(newResult)) {
    console.warn('API mismatch:', { old: oldResult, new: newResult });
  }

  return newResult; // Use RPC result
}
```

### Rollback Plan

If issues arise, rollback is simple:

1. **Client-only change**: Just revert frontend PR
2. **No database migrations**: No schema changes
3. **No API changes**: Server endpoints unchanged
4. **No version conflicts**: Both clients use same endpoints

### Testing Strategy

1. **Unit Tests**: Mock RPC client responses
   ```typescript
   vi.mock('hono/client', () => ({
     hc: () => mockClient,
   }));
   ```

2. **Integration Tests**: Test against real Hono server
   ```typescript
   const testApp = new Hono();
   testApp.route('/api', apiRoutes);
   const client = hc<typeof testApp>('http://localhost:8787');
   ```

3. **E2E Tests**: Playwright tests unchanged (API URLs same)

### Version Deployment Strategy

For Cloudflare Workers deployment:

1. **Preview Environment**: Test RPC in PR preview deployments
2. **Main Preview**: Validate on main-preview.workers.dev
3. **Production Tag**: Deploy to production only after validation

No special version coordination needed - RPC is additive, not breaking.

---

## Implementation Checklist

### Backend Changes
- [ ] Export `AppType` from `backend/src/index.ts`
- [ ] Ensure all routes use Zod validators for type inference
- [ ] Add centralized error handler with `app.onError()`
- [ ] Verify TypeScript strict mode enabled

### Frontend Changes
- [ ] Add TypeScript project reference to backend
- [ ] Create RPC client wrapper with `hc<AppType>()`
- [ ] Implement `callRpc()` error handling wrapper
- [ ] Create hybrid FormData upload functions using `$url()`
- [ ] Migrate JSON endpoints to RPC client
- [ ] Update Vite proxy config for development

### Development Workflow
- [ ] Configure Vite proxy for `/api` → `http://localhost:8787`
- [ ] Test hot reload with backend type changes
- [ ] Validate IDE autocomplete works for all endpoints
- [ ] Set up parallel run scripts (`pnpm dev`)

### Testing & Validation
- [ ] Add unit tests for RPC wrapper functions
- [ ] Validate FormData uploads still work with hybrid approach
- [ ] Run E2E tests to ensure no regression
- [ ] Test in preview environment before production deploy

---

## Key Findings Summary

1. **FormData Not Supported**: RPC client doesn't support FormData natively - use `$url()` + manual fetch
2. **Type Sync is Instant**: With TypeScript project references, types update in seconds
3. **Zero Server Changes**: Migration is frontend-only, server API unchanged
4. **Gradual Migration Safe**: Old and new clients can coexist during transition
5. **Same Hono Version Critical**: Must use identical Hono version in backend and frontend

---

## Sources

- [RPC - Hono](https://hono.dev/docs/guides/rpc)
- [Hey, this is Hono's RPC - Yusuke Wada](https://blog.yusu.ke/hono-rpc/)
- [Hono RPC And TypeScript Project References](https://catalins.tech/hono-rpc-in-monorepos/)
- [Elegant Error Handling and End to End typesafety with Hono RPC - DEV Community](https://dev.to/mmvergara/elegant-error-handling-and-end-to-end-typesafety-with-hono-rpc-29m7)
- [Elegant Error Handling and End to End typesafety with Hono RPC | by Mark Matthew Vergara | Medium](https://medium.com/@mmvergara/elegant-error-handling-and-end-to-end-typesafety-with-hono-rpc-0861bbd5aa0e)
- [Using RPC with file uploads · honojs · Discussion #2298](https://github.com/orgs/honojs/discussions/2298)
- [File Upload - Hono](https://hono.dev/examples/file-upload)
- [Uploading a file using FormData from React Native to Hono · Issue #3141 · honojs/hono](https://github.com/honojs/hono/issues/3141)
- [File is going through properly with Hono RPC · Issue #3513 · honojs/hono](https://github.com/honojs/hono/issues/3513)
- [Full-stack Development with Vite and Hono | by A-yon | Dev Genius](https://blog.devgenius.io/full-stack-development-with-vite-and-hono-1b8c26f48956)
- [Hono, RPC and React](https://tuturu.io/blog/hono-rpc-react)
- [GitHub - sor4chi/hono-rpc-monorepo-pnpm-turbo](https://github.com/sor4chi/hono-rpc-monorepo-pnpm-turbo)
- [Cloudflare Workers - Hono](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Best Practices - Hono](https://hono.dev/docs/guides/best-practices)
- [RFC: Add type helpers for type-safe error handling in RPC Client · Issue #4270 · honojs/hono](https://github.com/honojs/hono/issues/4270)
- [Hono Stacks - Hono](https://hono.dev/docs/concepts/stacks)
