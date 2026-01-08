/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CleanupService, LockAcquisitionError } from '../src/services/cleanup';

/**
 * Mock D1 Database for testing
 */
function createMockD1(): D1Database {
  const queries = new Map<string, any>();

  return {
    prepare: (_sql: string) => ({
      bind: (..._params: any[]) => ({
        all: async () => queries.get(_sql) || { results: [] },
        run: async () => ({ success: true }),
        first: async () => queries.get(_sql)?.[0] || null,
      }),
    }),
    exec: async (_sql: string) => ({ count: 1, duration: 0 }),
    dump: async () => new ArrayBuffer(0),
    batch: async (statements: any[]) => statements.map(() => ({ success: true })),
  } as any;
}

/**
 * Mock R2 Bucket for testing
 */
function createMockR2(): R2Bucket {
  const storage = new Map<string, ArrayBuffer>();

  return {
    delete: async (key: string) => storage.delete(key),
    list: async (options?: R2ListOptions) => ({
      objects: Array.from(storage.keys())
        .filter(k => !options?.prefix || k.startsWith(options.prefix))
        .map(key => ({
          key,
          size: storage.get(key)!.byteLength,
          uploaded: new Date(),
          httpEtag: 'mock-etag',
          etag: 'mock-etag',
          httpMetadata: {},
          customMetadata: {},
          checksums: {},
          storageClass: 'STANDARD' as const,
        })),
      truncated: false,
      delimitedPrefixes: [],
    }),
    head: async (key: string) => {
      const data = storage.get(key);
      if (!data) return null;
      return {
        key,
        size: data.byteLength,
        uploaded: new Date(),
        httpEtag: 'mock-etag',
        etag: 'mock-etag',
        httpMetadata: {},
        customMetadata: {},
        checksums: {},
        storageClass: 'STANDARD' as const,
      };
    },
    get: async (key: string) => {
      const data = storage.get(key);
      if (!data) return null;
      return {
        body: new ReadableStream(),
        bodyUsed: false,
        arrayBuffer: async () => data,
        text: async () => new TextDecoder().decode(data),
        json: async () => JSON.parse(new TextDecoder().decode(data)),
        blob: async () => new Blob([data]),
      } as R2ObjectBody;
    },
    put: async (key: string, value: ArrayBuffer | ReadableStream) => {
      if (value instanceof ArrayBuffer) {
        storage.set(key, value);
      }
      return {
        key,
        size: value instanceof ArrayBuffer ? value.byteLength : 0,
        etag: 'mock-etag',
        httpEtag: 'mock-etag',
        uploaded: new Date(),
        httpMetadata: {},
        customMetadata: {},
        checksums: {},
        storageClass: 'STANDARD' as const,
      };
    },
  } as any;
}

/**
 * Test suite for CleanupService
 */
describe('CleanupService', () => {
  let service: CleanupService;
  let mockDb: D1Database;
  let mockBucket: R2Bucket;

  beforeEach(() => {
    // Setup mocks
    mockDb = createMockD1();
    mockBucket = createMockR2();
    service = new CleanupService();
  });

  describe('executeCleanup', () => {
    // T037: Acquire and release lock successfully
    it('should acquire and release lock successfully', async () => {
      // Arrange: Mock environment
      const mockEnv = {
        DB: mockDb,
        TILES: mockBucket,
      } as any;

      let lockAcquired = false;
      let lockReleased = false;

      vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM cleanup_lock')) {
          // No existing lock
          return {
            first: vi.fn().mockResolvedValue(null),
          } as any;
        } else if (sql.includes('INSERT INTO cleanup_lock')) {
          lockAcquired = true;
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        } else if (sql.includes('DELETE FROM cleanup_lock')) {
          lockReleased = true;
          return {
            run: vi.fn().mockResolvedValue({ success: true }),
          } as any;
        } else if (sql.includes('SELECT COUNT(*) as count FROM drawing_tile')) {
          // getTotalTileCount
          return {
            first: vi.fn().mockResolvedValue({ count: 100 }),
          } as any;
        } else if (sql.includes('SELECT id, tile_count, ogp_image_key FROM canvas')) {
          // cleanupUnusedCanvases - no canvases to delete
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        } else if (sql.includes('SELECT dt.id, dt.r2_key FROM drawing_tile dt')) {
          // cleanupOrphanedData - no orphaned tiles
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        } else if (sql.includes('SELECT ogp_image_key FROM canvas')) {
          // cleanupOrphanedData - OGP keys
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        } else if (sql.includes('INSERT INTO deletion_record')) {
          // recordCleanupExecution
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
        // Default: return mock with all methods
        return {
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any;
      });

      // Mock R2 list
      vi.spyOn(mockBucket, 'list').mockResolvedValue({
        objects: [],
        truncated: false,
        delimitedPrefixes: [],
      } as any);

      // Act
      const result = await service.executeCleanup(mockEnv);

      // Assert: Lock should be acquired and released
      expect(lockAcquired).toBe(true);
      expect(lockReleased).toBe(true);
      expect(result.success).toBe(true);
    });

    // T038: Throw LockAcquisitionError if already locked
    it('should throw LockAcquisitionError if already locked', async () => {
      // Arrange: Mock environment
      const mockEnv = {
        DB: mockDb,
        TILES: mockBucket,
      } as any;

      const existingLock = {
        id: 1,
        locked_at: new Date().toISOString(),
        locked_by: 'another-worker',
      };

      vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM cleanup_lock')) {
          // Return existing lock
          return {
            first: vi.fn().mockResolvedValue(existingLock),
          } as any;
        }
        return {
          run: vi.fn().mockResolvedValue({ success: true }),
        } as any;
      });

      // Act & Assert: Should throw LockAcquisitionError
      await expect(service.executeCleanup(mockEnv)).rejects.toThrow(LockAcquisitionError);
    });

    // T039: Force release stale lock (older than 30 minutes)
    it('should force release stale lock', async () => {
      // Arrange: Mock environment
      const mockEnv = {
        DB: mockDb,
        TILES: mockBucket,
      } as any;

      // Create stale lock (31 minutes old)
      const staleTime = new Date();
      staleTime.setMinutes(staleTime.getMinutes() - 31);
      const staleLock = {
        id: 1,
        locked_at: staleTime.toISOString(),
        locked_by: 'stale-worker',
      };

      let staleCheckCount = 0;
      let staleLockDeleted = false;
      let newLockAcquired = false;

      vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM cleanup_lock')) {
          staleCheckCount++;
          if (staleCheckCount === 1) {
            // First check: return stale lock
            return {
              first: vi.fn().mockResolvedValue(staleLock),
            } as any;
          } else {
            // After deletion: no lock
            return {
              first: vi.fn().mockResolvedValue(null),
            } as any;
          }
        } else if (sql.includes('DELETE FROM cleanup_lock')) {
          staleLockDeleted = true;
          return {
            run: vi.fn().mockResolvedValue({ success: true }),
          } as any;
        } else if (sql.includes('INSERT INTO cleanup_lock')) {
          newLockAcquired = true;
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        } else if (sql.includes('SELECT COUNT(*) as count FROM drawing_tile')) {
          return {
            first: vi.fn().mockResolvedValue({ count: 50 }),
          } as any;
        } else if (sql.includes('SELECT id, tile_count, ogp_image_key FROM canvas')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        } else if (sql.includes('SELECT dt.id, dt.r2_key FROM drawing_tile dt')) {
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        } else if (sql.includes('SELECT ogp_image_key FROM canvas')) {
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        } else if (sql.includes('INSERT INTO deletion_record')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
        // Default: return mock with all methods
        return {
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any;
      });

      vi.spyOn(mockBucket, 'list').mockResolvedValue({
        objects: [],
        truncated: false,
        delimitedPrefixes: [],
      } as any);

      // Act
      const result = await service.executeCleanup(mockEnv);

      // Assert: Stale lock should be deleted and new lock acquired
      expect(staleLockDeleted).toBe(true);
      expect(newLockAcquired).toBe(true);
      expect(result.success).toBe(true);
    });

    // T040: Full cleanup end-to-end integration test
    it('should perform full cleanup end-to-end', async () => {
      // Arrange: Mock environment with test data
      const mockEnv = {
        DB: mockDb,
        TILES: mockBucket,
      } as any;

      // Create old canvas that should be deleted
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      const oldCanvas = {
        id: 'old-canvas',
        tile_count: 0,
        created_at: oldDate.toISOString(),
        share_lat: null,
        share_lng: null,
        share_zoom: null,
        ogp_image_key: null,
      };

      let deletionRecordCreated = false;
      let canvasQueryCount = 0;

      vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM cleanup_lock')) {
          // No existing lock
          return {
            first: vi.fn().mockResolvedValue(null),
          } as any;
        } else if (sql.includes('INSERT INTO cleanup_lock')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        } else if (sql.includes('DELETE FROM cleanup_lock')) {
          return {
            run: vi.fn().mockResolvedValue({ success: true }),
          } as any;
        } else if (sql.includes('SELECT COUNT(*) as count FROM drawing_tile')) {
          return {
            first: vi.fn().mockResolvedValue({ count: 10 }),
          } as any;
        } else if (sql.includes('WHERE (tile_count = 0')) {
          // cleanupUnusedCanvases query - First batch returns old canvas, second batch returns empty
          canvasQueryCount++;
          if (canvasQueryCount === 1) {
            return {
              bind: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue({ results: [oldCanvas] }),
              }),
            } as any;
          } else {
            return {
              bind: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue({ results: [] }),
              }),
            } as any;
          }
        } else if (sql.includes('SELECT id, r2_key FROM drawing_tile WHERE canvas_id')) {
          // No tiles for this canvas
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        } else if (sql.includes('SELECT ogp_image_key FROM canvas WHERE id')) {
          // No OGP for this canvas
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ ogp_image_key: null }),
            }),
          } as any;
        } else if (sql.includes('DELETE FROM canvas WHERE id')) {
          // Delete canvas
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        } else if (sql.includes('SELECT dt.id, dt.r2_key FROM drawing_tile dt')) {
          // No orphaned tiles
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        } else if (sql.includes('SELECT ogp_image_key FROM canvas')) {
          // No OGP keys
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        } else if (sql.includes('INSERT INTO deletion_record')) {
          deletionRecordCreated = true;
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
        // Default: return mock with all methods
        return {
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any;
      });

      vi.spyOn(mockBucket, 'list').mockResolvedValue({
        objects: [],
        truncated: false,
        delimitedPrefixes: [],
      } as any);

      // Act
      const result = await service.executeCleanup(mockEnv);

      // Assert: Full cleanup should succeed
      expect(result.success).toBe(true);
      expect(result.canvases_processed).toBeGreaterThan(0);
      expect(deletionRecordCreated).toBe(true);
      expect(result.deletion_record_id).toBeTruthy();
    });
  });

  describe('cleanupUnusedCanvases', () => {
    // T008: Empty canvases older than 30 days
    it('should identify empty canvases older than 30 days', async () => {
      // Arrange: Mock canvas with tile_count=0, created_at=31 days ago
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      const mockCanvas = {
        id: 'canvas-empty-old',
        tile_count: 0,
        created_at: oldDate.toISOString(),
        share_lat: null,
        share_lng: null,
        share_zoom: null,
      };

      // Mock DB query to return this canvas and handle deleteCanvasData queries
      let queryCount = 0;
      vi.spyOn(mockDb, 'prepare').mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          // First query: get canvases for cleanup
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [mockCanvas] }),
            }),
          } as any;
        } else if (queryCount === 2) {
          // Second query: get tiles for canvas (empty canvas has no tiles)
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        } else if (queryCount === 3) {
          // Third query: get canvas OGP key
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ ogp_image_key: null }),
            }),
          } as any;
        } else if (queryCount === 4) {
          // Fourth query: delete canvas
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        } else if (queryCount === 5) {
          // Fifth query: second batch (should return empty to exit loop)
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        }
        // Default: empty results
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any;
      });

      // Act: Run cleanup
      const stats = await service.cleanupUnusedCanvases(mockDb, mockBucket, 100);

      // Assert: Canvas should be marked for deletion
      expect(stats.canvases_deleted).toBe(1);
    });

    // T009: Unshared canvases older than 30 days
    it('should identify unshared canvases older than 30 days', async () => {
      // Arrange: Mock canvas with share_lat/lng/zoom=NULL, created_at=31 days ago
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      const mockCanvas = {
        id: 'canvas-unshared-old',
        tile_count: 5,
        created_at: oldDate.toISOString(),
        share_lat: null,
        share_lng: null,
        share_zoom: null,
      };

      let queryCount = 0;
      vi.spyOn(mockDb, 'prepare').mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [mockCanvas] }),
            }),
          } as any;
        } else if (queryCount === 2) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        } else if (queryCount === 3) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ ogp_image_key: null }),
            }),
          } as any;
        } else if (queryCount === 4) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        } else {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        }
      });

      // Act
      const stats = await service.cleanupUnusedCanvases(mockDb, mockBucket, 100);

      // Assert
      expect(stats.canvases_deleted).toBe(1);
    });

    // T010: Young canvases should NOT be deleted
    it('should NOT delete canvases younger than 30 days', async () => {
      // Arrange: Canvas is too young to be deleted (29 days old)
      // Mock should return empty results

      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      } as any);

      // Act
      const stats = await service.cleanupUnusedCanvases(mockDb, mockBucket, 100);

      // Assert: Should NOT delete
      expect(stats.canvases_deleted).toBe(0);
    });

    // T011: Canvases with tiles AND shared should NOT be deleted
    it('should NOT delete canvases with tiles AND shared', async () => {
      // Arrange: Canvas has tiles AND is shared (doesn't meet deletion criteria)
      // Mock should return empty results

      vi.spyOn(mockDb, 'prepare').mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      } as any);

      // Act
      const stats = await service.cleanupUnusedCanvases(mockDb, mockBucket, 100);

      // Assert: Should NOT delete
      expect(stats.canvases_deleted).toBe(0);
    });

    // T012: Delete all associated data (tiles, OGP, layers)
    it('should delete all associated data (tiles, layers, OGP)', async () => {
      // Arrange: Canvas with tiles, layers, and OGP
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      const mockCanvas = {
        id: 'canvas-with-data',
        tile_count: 0,
        created_at: oldDate.toISOString(),
        share_lat: null,
        share_lng: null,
        share_zoom: null,
        ogp_image_key: 'ogp/canvas-with-data.png',
      };

      // Mock tiles for this canvas
      const mockTiles = [
        { id: 'tile1', canvas_id: 'canvas-with-data', r2_key: 'canvas-with-data/10/512/256.webp' },
        { id: 'tile2', canvas_id: 'canvas-with-data', r2_key: 'canvas-with-data/10/513/256.webp' },
      ];

      let queryCount = 0;
      vi.spyOn(mockDb, 'prepare').mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          // First query: get canvases
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [mockCanvas] }),
            }),
          } as any;
        } else if (queryCount === 2) {
          // Second query: get tiles for canvas
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: mockTiles }),
            }),
          } as any;
        } else if (queryCount === 3) {
          // Third query: delete tiles
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        } else if (queryCount === 4) {
          // Fourth query: get canvas OGP key
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ ogp_image_key: mockCanvas.ogp_image_key }),
            }),
          } as any;
        } else if (queryCount === 5) {
          // Fifth query: delete canvas
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        } else {
          // Subsequent queries: second batch (empty)
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        }
      });

      // Mock R2 head to return size
      vi.spyOn(mockBucket, 'head').mockResolvedValue({
        size: 50000,
      } as any);

      // Act
      const stats = await service.cleanupUnusedCanvases(mockDb, mockBucket, 100);

      // Assert: Verify deletion order and counts
      expect(stats.canvases_deleted).toBe(1);
      expect(stats.tiles_deleted).toBe(2);
      expect(stats.ogp_images_deleted).toBe(1);
      expect(stats.storage_reclaimed_bytes).toBeGreaterThan(0);
    });

    // T013: Process in batches of 100
    it('should process in batches of 100 canvases', async () => {
      // Arrange: 250 qualifying canvases
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      const mockCanvases = Array.from({ length: 250 }, (_, i) => ({
        id: `canvas-${i}`,
        tile_count: 0,
        created_at: oldDate.toISOString(),
        share_lat: null,
        share_lng: null,
        share_zoom: null,
      }));

      let queryCount = 0;
      let canvasesProcessed = 0;
      vi.spyOn(mockDb, 'prepare').mockImplementation(() => {
        queryCount++;

        // Pattern: canvas query, tiles query, ogp query, delete canvas, repeat
        const queryType = (queryCount - 1) % 4;

        if (queryType === 0) {
          // Canvas query
          if (canvasesProcessed < mockCanvases.length) {
            const canvas = mockCanvases[canvasesProcessed];
            return {
              bind: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue({ results: [canvas] }),
              }),
            } as any;
          } else {
            // No more canvases
            return {
              bind: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue({ results: [] }),
              }),
            } as any;
          }
        } else if (queryType === 1) {
          // Tiles query (empty for this test)
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        } else if (queryType === 2) {
          // OGP query
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ ogp_image_key: null }),
            }),
          } as any;
        } else {
          // Delete canvas
          canvasesProcessed++;
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
      });

      // Act
      const stats = await service.cleanupUnusedCanvases(mockDb, mockBucket, 100);

      // Assert: All 250 should be processed
      expect(stats.canvases_deleted).toBe(250);
    });

    // T014: Stop at 1000 canvas safety limit
    it('should stop at 1000 canvas safety limit', async () => {
      // Arrange: 1500 qualifying canvases
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      const mockCanvases = Array.from({ length: 1500 }, (_, i) => ({
        id: `canvas-${i}`,
        tile_count: 0,
        created_at: oldDate.toISOString(),
        share_lat: null,
        share_lng: null,
        share_zoom: null,
      }));

      let queryCount = 0;
      let canvasesProcessed = 0;
      vi.spyOn(mockDb, 'prepare').mockImplementation(() => {
        queryCount++;

        // Pattern: canvas query, tiles query, ogp query, delete canvas, repeat
        const queryType = (queryCount - 1) % 4;

        if (queryType === 0) {
          // Canvas query - always return one canvas until we hit the limit
          if (canvasesProcessed < mockCanvases.length) {
            const canvas = mockCanvases[canvasesProcessed];
            return {
              bind: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue({ results: [canvas] }),
              }),
            } as any;
          } else {
            return {
              bind: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue({ results: [] }),
              }),
            } as any;
          }
        } else if (queryType === 1) {
          // Tiles query
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          } as any;
        } else if (queryType === 2) {
          // OGP query
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ ogp_image_key: null }),
            }),
          } as any;
        } else {
          // Delete canvas
          canvasesProcessed++;
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        }
      });

      // Act
      const stats = await service.cleanupUnusedCanvases(mockDb, mockBucket, 100);

      // Assert: Only 1000 should be processed (safety limit)
      expect(stats.canvases_deleted).toBe(1000);
    });
  });

  describe('cleanupOrphanedData', () => {
    // T021: Orphaned tiles (canvas_id doesn't exist)
    it('should identify orphaned tiles', async () => {
      // Arrange: Mock orphaned tile (canvas_id doesn't exist in canvas table)
      const orphanedTile = {
        id: 'tile-orphaned',
        canvas_id: 'non-existent-canvas',
        r2_key: 'orphaned/10/512/256.webp',
      };

      let queryCount = 0;
      vi.spyOn(mockDb, 'prepare').mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          // First query: LEFT JOIN to find orphaned tiles (no bind, direct all())
          return {
            all: vi.fn().mockResolvedValue({ results: [orphanedTile] }),
          } as any;
        } else if (queryCount === 2) {
          // Second query: delete orphaned tiles from DB (uses bind)
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({ success: true }),
            }),
          } as any;
        } else if (queryCount === 3) {
          // Third query: get all canvases with OGP keys (no bind, direct all())
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        }
        return {
          all: vi.fn().mockResolvedValue({ results: [] }),
        } as any;
      });

      // Mock R2 head to return size
      vi.spyOn(mockBucket, 'head').mockResolvedValue({
        size: 30000,
      } as any);

      // Mock R2 list for OGP images (empty)
      vi.spyOn(mockBucket, 'list').mockResolvedValue({
        objects: [],
        truncated: false,
        delimitedPrefixes: [],
      } as any);

      // Act
      const result = await service.cleanupOrphanedData(mockDb, mockBucket);

      // Assert: Orphaned tile should be deleted
      expect(result.orphaned_tiles).toBe(1);
    });

    // T022: Orphaned OGP images (no matching canvas.ogp_image_key)
    it('should identify orphaned OGP images', async () => {
      // Arrange: Mock OGP image in R2 without matching canvas record
      const orphanedOgpKey = 'ogp/orphaned-canvas.png';

      // Mock DB queries
      let queryCount = 0;
      vi.spyOn(mockDb, 'prepare').mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          // First query: orphaned tiles (none) - no bind, direct all()
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        } else if (queryCount === 2) {
          // Second query: get all canvases with OGP keys - no bind, direct all()
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { ogp_image_key: 'ogp/valid-canvas.png' },
              ],
            }),
          } as any;
        }
        return {
          all: vi.fn().mockResolvedValue({ results: [] }),
        } as any;
      });

      // Mock R2 list to return orphaned OGP image
      vi.spyOn(mockBucket, 'list').mockResolvedValue({
        objects: [
          {
            key: orphanedOgpKey,
            size: 100000,
            uploaded: new Date(),
            httpEtag: 'etag1',
            etag: 'etag1',
            httpMetadata: {},
            customMetadata: {},
            checksums: {},
            storageClass: 'STANDARD' as const,
          },
          {
            key: 'ogp/valid-canvas.png',
            size: 100000,
            uploaded: new Date(),
            httpEtag: 'etag2',
            etag: 'etag2',
            httpMetadata: {},
            customMetadata: {},
            checksums: {},
            storageClass: 'STANDARD' as const,
          },
        ],
        truncated: false,
        delimitedPrefixes: [],
      } as any);

      // Act
      const result = await service.cleanupOrphanedData(mockDb, mockBucket);

      // Assert: Orphaned OGP image should be deleted
      expect(result.orphaned_ogp).toBe(1);
    });

    // T023: Valid data references should NOT be deleted
    it('should NOT delete valid data references', async () => {
      // Arrange: Mock valid tile with existing canvas_id
      const validCanvas = {
        id: 'valid-canvas',
        ogp_image_key: 'ogp/valid-canvas.png',
      };

      // Mock DB queries to return no orphaned tiles
      let queryCount = 0;
      vi.spyOn(mockDb, 'prepare').mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          // First query: orphaned tiles (none) - no bind, direct all()
          return {
            all: vi.fn().mockResolvedValue({ results: [] }),
          } as any;
        } else if (queryCount === 2) {
          // Second query: get all canvases with OGP keys - no bind, direct all()
          return {
            all: vi.fn().mockResolvedValue({
              results: [validCanvas],
            }),
          } as any;
        }
        return {
          all: vi.fn().mockResolvedValue({ results: [] }),
        } as any;
      });

      // Mock R2 list to return only valid OGP
      vi.spyOn(mockBucket, 'list').mockResolvedValue({
        objects: [
          {
            key: 'ogp/valid-canvas.png',
            size: 100000,
            uploaded: new Date(),
            httpEtag: 'etag',
            etag: 'etag',
            httpMetadata: {},
            customMetadata: {},
            checksums: {},
            storageClass: 'STANDARD' as const,
          },
        ],
        truncated: false,
        delimitedPrefixes: [],
      } as any);

      // Act
      const result = await service.cleanupOrphanedData(mockDb, mockBucket);

      // Assert: No deletions should occur
      expect(result.orphaned_tiles).toBe(0);
      expect(result.orphaned_ogp).toBe(0);
    });
  });

  describe('recordCleanupExecution', () => {
    // T028: Create deletion record with accurate statistics
    it('should create deletion record with accurate statistics', async () => {
      // Arrange: Mock stats from cleanup
      const stats = {
        canvases_deleted: 5,
        tiles_deleted: 20,
        layers_deleted: 3,
        ogp_images_deleted: 2,
        orphaned_tiles_deleted: 1,
        orphaned_ogp_deleted: 1,
        storage_reclaimed_bytes: 500000,
        total_tiles_before: 100,
        total_tiles_after: 79, // 100 - 20 - 1
      };
      const duration_ms = 1500;
      const errors: string[] = [];

      let insertedRecord: any = null;
      vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO deletion_record')) {
          return {
            bind: vi.fn().mockImplementation((...values: any[]) => {
              // Capture inserted values from bind()
              insertedRecord = {
                id: values[0],
                executed_at: values[1],
                canvases_deleted: values[2],
                tiles_deleted: values[3],
                layers_deleted: values[4],
                ogp_images_deleted: values[5],
                total_tiles_before: values[6],
                total_tiles_after: values[7],
                storage_reclaimed_bytes: values[8],
                orphaned_tiles_deleted: values[9],
                orphaned_ogp_deleted: values[10],
                errors_encountered: values[11],
                duration_ms: values[12],
              };
              return {
                run: vi.fn().mockResolvedValue({ success: true }),
              };
            }),
          } as any;
        }
        return {
          run: vi.fn().mockResolvedValue({ success: true }),
        } as any;
      });

      // Act
      const recordId = await service.recordCleanupExecution(mockDb, stats, duration_ms, errors);

      // Assert: Verify record was created with correct values
      expect(recordId).toBeTruthy();
      expect(insertedRecord).toBeTruthy();
      expect(insertedRecord.canvases_deleted).toBe(5);
      expect(insertedRecord.tiles_deleted).toBe(20);
      expect(insertedRecord.layers_deleted).toBe(3);
      expect(insertedRecord.ogp_images_deleted).toBe(2);
      expect(insertedRecord.orphaned_tiles_deleted).toBe(1);
      expect(insertedRecord.orphaned_ogp_deleted).toBe(1);
      expect(insertedRecord.storage_reclaimed_bytes).toBe(500000);
      expect(insertedRecord.total_tiles_before).toBe(100);
      expect(insertedRecord.total_tiles_after).toBe(79);
      expect(insertedRecord.duration_ms).toBe(1500);
    });

    // T029: Calculate total_tiles_before and total_tiles_after correctly
    it('should calculate total_tiles_before and total_tiles_after correctly', async () => {
      // Arrange
      const stats = {
        canvases_deleted: 2,
        tiles_deleted: 10,
        layers_deleted: 1,
        ogp_images_deleted: 1,
        orphaned_tiles_deleted: 3,
        orphaned_ogp_deleted: 0,
        storage_reclaimed_bytes: 200000,
        total_tiles_before: 50,
        total_tiles_after: 37, // 50 - 10 - 3 = 37
      };

      let insertedRecord: any = null;
      vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO deletion_record')) {
          return {
            bind: vi.fn().mockImplementation((...values: any[]) => {
              insertedRecord = {
                total_tiles_before: values[6],
                total_tiles_after: values[7],
                tiles_deleted: values[3],
                orphaned_tiles_deleted: values[9],
              };
              return {
                run: vi.fn().mockResolvedValue({ success: true }),
              };
            }),
          } as any;
        }
        return { run: vi.fn().mockResolvedValue({ success: true }) } as any;
      });

      // Act
      await service.recordCleanupExecution(mockDb, stats, 1000, []);

      // Assert: Verify math is correct
      expect(insertedRecord.total_tiles_before).toBe(50);
      expect(insertedRecord.total_tiles_after).toBe(37);
      expect(insertedRecord.total_tiles_before - insertedRecord.tiles_deleted - insertedRecord.orphaned_tiles_deleted).toBe(insertedRecord.total_tiles_after);
    });

    // T030: Create deletion record with zero counts when no deletions
    it('should create deletion record with zero counts when no deletions', async () => {
      // Arrange: No deletions occurred
      const stats = {
        canvases_deleted: 0,
        tiles_deleted: 0,
        layers_deleted: 0,
        ogp_images_deleted: 0,
        orphaned_tiles_deleted: 0,
        orphaned_ogp_deleted: 0,
        storage_reclaimed_bytes: 0,
        total_tiles_before: 100,
        total_tiles_after: 100,
      };

      let insertedRecord: any = null;
      vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO deletion_record')) {
          return {
            bind: vi.fn().mockImplementation((...values: any[]) => {
              insertedRecord = {
                canvases_deleted: values[2],
                tiles_deleted: values[3],
                storage_reclaimed_bytes: values[8],
              };
              return {
                run: vi.fn().mockResolvedValue({ success: true }),
              };
            }),
          } as any;
        }
        return { run: vi.fn().mockResolvedValue({ success: true }) } as any;
      });

      // Act
      await service.recordCleanupExecution(mockDb, stats, 500, []);

      // Assert: All counts should be zero
      expect(insertedRecord.canvases_deleted).toBe(0);
      expect(insertedRecord.tiles_deleted).toBe(0);
      expect(insertedRecord.storage_reclaimed_bytes).toBe(0);
    });

    // T031: Persist errors_encountered as JSON array
    it('should persist errors_encountered as JSON array', async () => {
      // Arrange: Cleanup with errors
      const stats = {
        canvases_deleted: 3,
        tiles_deleted: 10,
        layers_deleted: 2,
        ogp_images_deleted: 1,
        orphaned_tiles_deleted: 0,
        orphaned_ogp_deleted: 0,
        storage_reclaimed_bytes: 150000,
        total_tiles_before: 50,
        total_tiles_after: 40,
      };
      const errors = [
        'Failed to delete R2 object tiles/canvas1/10/512/256.webp',
        'Failed to delete R2 object ogp/canvas2.png',
      ];

      let insertedRecord: any = null;
      vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO deletion_record')) {
          return {
            bind: vi.fn().mockImplementation((...values: any[]) => {
              insertedRecord = {
                errors_encountered: values[11],
              };
              return {
                run: vi.fn().mockResolvedValue({ success: true }),
              };
            }),
          } as any;
        }
        return { run: vi.fn().mockResolvedValue({ success: true }) } as any;
      });

      // Act
      await service.recordCleanupExecution(mockDb, stats, 2000, errors);

      // Assert: Errors should be persisted as JSON
      expect(insertedRecord.errors_encountered).toBeTruthy();
      const parsedErrors = JSON.parse(insertedRecord.errors_encountered);
      expect(parsedErrors).toHaveLength(2);
      expect(parsedErrors[0]).toBe('Failed to delete R2 object tiles/canvas1/10/512/256.webp');
      expect(parsedErrors[1]).toBe('Failed to delete R2 object ogp/canvas2.png');
    });
  });
});
