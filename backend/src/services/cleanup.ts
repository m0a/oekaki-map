import type { Env, CleanupResult, CleanupStats } from '../types/index';

/**
 * LockAcquisitionError - Thrown when cleanup lock cannot be acquired
 */
export class LockAcquisitionError extends Error {
  constructor(
    message: string,
    public locked_by: string,
    public locked_at: string
  ) {
    super(message);
    this.name = 'LockAcquisitionError';
  }
}

/**
 * CleanupService - Automated cleanup of unused canvas data and orphaned records
 *
 * This service is invoked by Cloudflare Workers Cron Triggers to:
 * - Delete unused canvases (empty OR unshared AND >30 days old)
 * - Delete orphaned tiles and OGP images
 * - Record cleanup statistics for monitoring
 */
export class CleanupService {
  /**
   * Execute full cleanup process: canvas cleanup, orphan cleanup, and statistics recording.
   *
   * This is the primary entry point called by the cron trigger handler.
   *
   * @param env - Cloudflare Workers environment bindings (DB, TILES bucket)
   * @returns CleanupResult with execution statistics and errors
   *
   * @throws {LockAcquisitionError} If cleanup is already running
   * @throws {DatabaseError} If critical database operations fail
   */
  async executeCleanup(env: Env): Promise<CleanupResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let canvases_processed = 0;
    let deletion_record_id: string | null = null;

    try {
      // Step 1: Acquire lock
      await this.acquireLock(env.DB);

      // Step 2: Capture before stats
      const total_tiles_before = await this.getTotalTileCount(env.DB);

      // Step 3: Cleanup unused canvases
      const canvasStats = await this.cleanupUnusedCanvases(env.DB, env.TILES);
      canvases_processed = canvasStats.canvases_deleted;

      // Step 4: Cleanup orphaned data
      const orphanStats = await this.cleanupOrphanedData(env.DB, env.TILES);

      // Step 5: Capture after stats
      const total_tiles_after = await this.getTotalTileCount(env.DB);

      // Step 6: Aggregate stats
      const stats: CleanupStats = {
        canvases_deleted: canvasStats.canvases_deleted,
        tiles_deleted: canvasStats.tiles_deleted,
        layers_deleted: canvasStats.layers_deleted,
        ogp_images_deleted: canvasStats.ogp_images_deleted,
        orphaned_tiles_deleted: orphanStats.orphaned_tiles,
        orphaned_ogp_deleted: orphanStats.orphaned_ogp,
        storage_reclaimed_bytes: canvasStats.storage_reclaimed_bytes,
        total_tiles_before,
        total_tiles_after,
      };

      // Step 7: Record cleanup execution
      const duration_ms = Date.now() - startTime;
      deletion_record_id = await this.recordCleanupExecution(
        env.DB,
        stats,
        duration_ms,
        errors
      );

      return {
        success: true,
        deletion_record_id,
        canvases_processed,
        errors,
      };
    } catch (error) {
      // Re-throw LockAcquisitionError for caller to handle
      if (error instanceof LockAcquisitionError) {
        throw error;
      }

      // Other errors are considered failures
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);

      return {
        success: false,
        deletion_record_id: null,
        canvases_processed,
        errors,
      };
    } finally {
      // Step 8: Always release lock (unless it was never acquired due to LockAcquisitionError)
      try {
        await this.releaseLock(env.DB);
      } catch (releaseError) {
        console.error('Failed to release lock:', releaseError);
      }
    }
  }

  /**
   * Identify and delete canvases meeting deletion criteria.
   *
   * Deletion criteria: (tile_count = 0 OR share_lat/lng/zoom all NULL) AND created >= 30 days ago
   *
   * @param db - D1 database binding
   * @param bucket - R2 bucket binding for tile/OGP deletion
   * @param batchSize - Number of canvases to process per batch (default: 100)
   * @returns Statistics about deleted canvases and associated data
   */
  async cleanupUnusedCanvases(
    db: D1Database,
    bucket: R2Bucket,
    batchSize: number = 100
  ): Promise<CleanupStats> {
    const SAFETY_LIMIT = 1000;
    const THIRTY_DAYS_AGO = new Date();
    THIRTY_DAYS_AGO.setDate(THIRTY_DAYS_AGO.getDate() - 30);
    const thirtyDaysAgoISO = THIRTY_DAYS_AGO.toISOString();

    const stats: CleanupStats = {
      canvases_deleted: 0,
      tiles_deleted: 0,
      layers_deleted: 0,
      ogp_images_deleted: 0,
      orphaned_tiles_deleted: 0,
      orphaned_ogp_deleted: 0,
      storage_reclaimed_bytes: 0,
      total_tiles_before: 0,
      total_tiles_after: 0,
    };

    const errors: string[] = [];
    let offset = 0;

    // Batch processing with safety limit
    while (stats.canvases_deleted < SAFETY_LIMIT) {
      // Query for canvases meeting deletion criteria
      const query = `
        SELECT id, tile_count, ogp_image_key
        FROM canvas
        WHERE (tile_count = 0 OR (share_lat IS NULL AND share_lng IS NULL AND share_zoom IS NULL))
          AND created_at <= ?
        LIMIT ? OFFSET ?
      `;

      const result = await db.prepare(query)
        .bind(thirtyDaysAgoISO, batchSize, offset)
        .all();

      const canvases = result.results as Array<{
        id: string;
        tile_count: number;
        ogp_image_key: string | null;
      }>;

      // Exit if no more canvases to process
      if (canvases.length === 0) {
        break;
      }

      // Process each canvas in the batch
      for (const canvas of canvases) {
        // Check safety limit before each deletion
        if (stats.canvases_deleted >= SAFETY_LIMIT) {
          break;
        }

        try {
          // Delete all associated data for this canvas
          const deletionResult = await this.deleteCanvasData(
            db,
            bucket,
            canvas.id
          );

          stats.tiles_deleted += deletionResult.tiles_deleted;
          stats.storage_reclaimed_bytes += deletionResult.storage_reclaimed;

          if (deletionResult.ogp_deleted) {
            stats.ogp_images_deleted += 1;
          }

          // Layers are deleted via CASCADE, so we count them here
          // (tile_count is approximate for layers, we use it as a proxy)
          stats.layers_deleted += canvas.tile_count > 0 ? 1 : 0;

          stats.canvases_deleted += 1;
        } catch (error) {
          const errorMsg = `Failed to delete canvas ${canvas.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(errorMsg);
          // Continue with next canvas
        }
      }

      offset += batchSize;
    }

    return stats;
  }

  /**
   * Identify and delete orphaned tiles and OGP images.
   *
   * Orphaned data: records that reference non-existent canvases
   *
   * @param db - D1 database binding
   * @param bucket - R2 bucket binding for orphaned data deletion
   * @returns Count of orphaned tiles and OGP images deleted
   */
  async cleanupOrphanedData(
    db: D1Database,
    bucket: R2Bucket
  ): Promise<{ orphaned_tiles: number; orphaned_ogp: number }> {
    let orphaned_tiles = 0;
    let orphaned_ogp = 0;

    // Phase 1: Cleanup orphaned tiles
    // Find tiles that reference non-existent canvases
    const orphanedTilesQuery = `
      SELECT dt.id, dt.r2_key
      FROM drawing_tile dt
      LEFT JOIN canvas c ON dt.canvas_id = c.id
      WHERE c.id IS NULL
    `;

    const tilesResult = await db.prepare(orphanedTilesQuery).all();
    const orphanedTiles = tilesResult.results as Array<{
      id: string;
      r2_key: string;
    }>;

    if (orphanedTiles.length > 0) {
      // Delete orphaned tile records from DB
      const tileIds = orphanedTiles.map((t) => t.id);
      await db
        .prepare(`DELETE FROM drawing_tile WHERE id IN (${tileIds.map(() => '?').join(',')})`)
        .bind(...tileIds)
        .run();

      // Delete orphaned tile images from R2 with retry
      for (const tile of orphanedTiles) {
        const deleted = await this.deleteWithRetry(bucket, tile.r2_key);
        if (deleted) {
          orphaned_tiles += 1;
        }
      }
    }

    // Phase 2: Cleanup orphaned OGP images
    // Get all valid OGP image keys from canvas table
    const validOgpQuery = `
      SELECT ogp_image_key
      FROM canvas
      WHERE ogp_image_key IS NOT NULL
    `;

    const ogpResult = await db.prepare(validOgpQuery).all();
    const validOgpKeys = new Set(
      (ogpResult.results as Array<{ ogp_image_key: string }>).map(
        (r) => r.ogp_image_key
      )
    );

    // List all OGP images in R2
    const ogpList = await bucket.list({ prefix: 'ogp/' });

    // Delete OGP images that don't have a matching canvas record
    for (const object of ogpList.objects) {
      if (!validOgpKeys.has(object.key)) {
        const deleted = await this.deleteWithRetry(bucket, object.key);
        if (deleted) {
          orphaned_ogp += 1;
        }
      }
    }

    return {
      orphaned_tiles,
      orphaned_ogp,
    };
  }

  /**
   * Record cleanup execution statistics to deletion_record table.
   *
   * @param db - D1 database binding
   * @param stats - Aggregated cleanup statistics
   * @param duration_ms - Execution duration in milliseconds
   * @param errors - Array of error messages encountered during cleanup
   * @returns ID of created deletion_record
   */
  async recordCleanupExecution(
    db: D1Database,
    stats: CleanupStats,
    duration_ms: number,
    errors: string[]
  ): Promise<string> {
    // Generate unique deletion record ID
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, '')
      .replace('T', '_');
    const recordId = `dr_${timestamp}`;

    // Serialize errors to JSON or NULL
    const errors_encountered =
      errors.length > 0 ? JSON.stringify(errors) : null;

    // Insert deletion record
    await db
      .prepare(
        `INSERT INTO deletion_record (
          id,
          executed_at,
          canvases_deleted,
          tiles_deleted,
          layers_deleted,
          ogp_images_deleted,
          total_tiles_before,
          total_tiles_after,
          storage_reclaimed_bytes,
          orphaned_tiles_deleted,
          orphaned_ogp_deleted,
          errors_encountered,
          duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        recordId,
        now.toISOString(),
        stats.canvases_deleted,
        stats.tiles_deleted,
        stats.layers_deleted,
        stats.ogp_images_deleted,
        stats.total_tiles_before,
        stats.total_tiles_after,
        stats.storage_reclaimed_bytes,
        stats.orphaned_tiles_deleted,
        stats.orphaned_ogp_deleted,
        errors_encountered,
        duration_ms
      )
      .run();

    return recordId;
  }

  // Private helper methods

  /**
   * Acquire cleanup lock to prevent concurrent execution
   */
  private async acquireLock(db: D1Database): Promise<void> {
    const STALE_LOCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

    // Check for existing lock
    const existingLock = await db
      .prepare('SELECT * FROM cleanup_lock WHERE id = 1')
      .first();

    if (existingLock) {
      const lock = existingLock as {
        id: number;
        locked_at: string;
        locked_by: string;
      };

      const lockedAt = new Date(lock.locked_at);
      const now = new Date();
      const lockAge = now.getTime() - lockedAt.getTime();

      // Check if lock is stale (older than 30 minutes)
      if (lockAge > STALE_LOCK_THRESHOLD_MS) {
        // Force release stale lock
        console.warn(
          `Force releasing stale lock (age: ${Math.floor(lockAge / 60000)} minutes)`
        );
        await db.prepare('DELETE FROM cleanup_lock WHERE id = 1').run();
      } else {
        // Lock is active, cannot acquire
        throw new LockAcquisitionError(
          `Cleanup already running (locked by ${lock.locked_by})`,
          lock.locked_by,
          lock.locked_at
        );
      }
    }

    // Acquire new lock
    const workerId = `worker-${Date.now()}`;
    await db
      .prepare(
        'INSERT INTO cleanup_lock (id, locked_at, locked_by) VALUES (?, ?, ?)'
      )
      .bind(1, new Date().toISOString(), workerId)
      .run();
  }

  /**
   * Release cleanup lock
   */
  private async releaseLock(db: D1Database): Promise<void> {
    await db.prepare('DELETE FROM cleanup_lock WHERE id = 1').run();
  }

  /**
   * Get total tile count from database
   */
  private async getTotalTileCount(db: D1Database): Promise<number> {
    const result = await db
      .prepare('SELECT COUNT(*) as count FROM drawing_tile')
      .first();

    return (result as { count: number })?.count ?? 0;
  }

  /**
   * Delete all data associated with a canvas
   */
  private async deleteCanvasData(
    db: D1Database,
    bucket: R2Bucket,
    canvasId: string
  ): Promise<{
    tiles_deleted: number;
    ogp_deleted: boolean;
    storage_reclaimed: number;
  }> {
    let tiles_deleted = 0;
    let ogp_deleted = false;
    let storage_reclaimed = 0;

    // Step 1: Get all tiles for this canvas
    const tilesResult = await db
      .prepare('SELECT id, r2_key FROM drawing_tile WHERE canvas_id = ?')
      .bind(canvasId)
      .all();

    const tiles = tilesResult.results as Array<{ id: string; r2_key: string }>;

    // Step 2: Delete tile records from D1
    if (tiles.length > 0) {
      await db
        .prepare('DELETE FROM drawing_tile WHERE canvas_id = ?')
        .bind(canvasId)
        .run();
    }

    // Step 3: Delete tile images from R2 with retry
    for (const tile of tiles) {
      // Calculate storage size before deletion
      const tileObject = await bucket.head(tile.r2_key);
      if (tileObject) {
        storage_reclaimed += tileObject.size;
      }

      // Delete with retry
      const deleted = await this.deleteWithRetry(bucket, tile.r2_key);
      if (deleted) {
        tiles_deleted += 1;
      }
    }

    // Step 4: Get canvas OGP image key
    const canvasResult = await db
      .prepare('SELECT ogp_image_key FROM canvas WHERE id = ?')
      .bind(canvasId)
      .first();

    const canvas = canvasResult as { ogp_image_key: string | null } | null;

    // Step 5: Delete OGP image from R2 if exists
    if (canvas?.ogp_image_key) {
      const ogpObject = await bucket.head(canvas.ogp_image_key);
      if (ogpObject) {
        storage_reclaimed += ogpObject.size;
      }

      const deleted = await this.deleteWithRetry(bucket, canvas.ogp_image_key);
      if (deleted) {
        ogp_deleted = true;
      }
    }

    // Step 6: Delete canvas record (layers CASCADE automatically)
    await db
      .prepare('DELETE FROM canvas WHERE id = ?')
      .bind(canvasId)
      .run();

    return {
      tiles_deleted,
      ogp_deleted,
      storage_reclaimed,
    };
  }

  /**
   * Delete R2 object with retry logic
   */
  private async deleteWithRetry(bucket: R2Bucket, key: string): Promise<boolean> {
    try {
      // First attempt
      await bucket.delete(key);
      return true;
    } catch {
      // Immediate retry on first failure
      try {
        await bucket.delete(key);
        return true;
      } catch (retryError) {
        // Log and fail gracefully
        console.error(`Failed to delete R2 object ${key}:`, retryError);
        return false;
      }
    }
  }
}
