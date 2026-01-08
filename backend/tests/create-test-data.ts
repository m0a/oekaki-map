/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/**
 * Test Data Generator for Manual Cleanup Validation
 *
 * This script creates backdated canvases for testing the cleanup feature.
 * Run this script to populate your local D1 database with test data.
 *
 * Usage:
 *   npx tsx tests/create-test-data.ts
 *
 * Prerequisites:
 *   - Local D1 database must be initialized
 *   - Run migrations: wrangler d1 migrations apply DB --local
 */

// Cloudflare D1 types
type D1Database = any;

/**
 * Generate a simple UUID v4
 */
function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface TestCanvas {
  id: string;
  center_lat: number;
  center_lng: number;
  zoom: number;
  tile_count: number;
  created_at: string;
  updated_at: string;
  share_lat: number | null;
  share_lng: number | null;
  share_zoom: number | null;
  ogp_image_key: string | null;
}

/**
 * Create test canvases with various conditions
 */
async function createTestData(db: D1Database) {
  const now = new Date();
  const thirtyOneDaysAgo = new Date(now);
  thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

  const twentyNineDaysAgo = new Date(now);
  twentyNineDaysAgo.setDate(twentyNineDaysAgo.getDate() - 29);

  const testCanvases: TestCanvas[] = [
    // SHOULD BE DELETED: Empty canvas, old (31 days)
    {
      id: randomUUID(),
      center_lat: 35.6812,
      center_lng: 139.7671,
      zoom: 12,
      tile_count: 0,
      created_at: thirtyOneDaysAgo.toISOString(),
      updated_at: thirtyOneDaysAgo.toISOString(),
      share_lat: null,
      share_lng: null,
      share_zoom: null,
      ogp_image_key: null,
    },

    // SHOULD BE DELETED: Unshared canvas with tiles, old (31 days)
    {
      id: randomUUID(),
      center_lat: 35.6812,
      center_lng: 139.7671,
      zoom: 12,
      tile_count: 5,
      created_at: thirtyOneDaysAgo.toISOString(),
      updated_at: thirtyOneDaysAgo.toISOString(),
      share_lat: null,
      share_lng: null,
      share_zoom: null,
      ogp_image_key: null,
    },

    // SHOULD BE DELETED: Empty and unshared, old (31 days)
    {
      id: randomUUID(),
      center_lat: 35.6812,
      center_lng: 139.7671,
      zoom: 12,
      tile_count: 0,
      created_at: thirtyOneDaysAgo.toISOString(),
      updated_at: thirtyOneDaysAgo.toISOString(),
      share_lat: null,
      share_lng: null,
      share_zoom: null,
      ogp_image_key: null,
    },

    // SHOULD NOT BE DELETED: Empty but recent (29 days)
    {
      id: randomUUID(),
      center_lat: 35.6812,
      center_lng: 139.7671,
      zoom: 12,
      tile_count: 0,
      created_at: twentyNineDaysAgo.toISOString(),
      updated_at: twentyNineDaysAgo.toISOString(),
      share_lat: null,
      share_lng: null,
      share_zoom: null,
      ogp_image_key: null,
    },

    // SHOULD NOT BE DELETED: Old but shared with tiles
    {
      id: randomUUID(),
      center_lat: 35.6812,
      center_lng: 139.7671,
      zoom: 12,
      tile_count: 10,
      created_at: thirtyOneDaysAgo.toISOString(),
      updated_at: thirtyOneDaysAgo.toISOString(),
      share_lat: 35.6812,
      share_lng: 139.7671,
      share_zoom: 12,
      ogp_image_key: `ogp/${randomUUID()}.png`,
    },

    // SHOULD NOT BE DELETED: Old, empty but shared
    {
      id: randomUUID(),
      center_lat: 35.6812,
      center_lng: 139.7671,
      zoom: 12,
      tile_count: 0,
      created_at: thirtyOneDaysAgo.toISOString(),
      updated_at: thirtyOneDaysAgo.toISOString(),
      share_lat: 35.6812,
      share_lng: 139.7671,
      share_zoom: 12,
      ogp_image_key: `ogp/${randomUUID()}.png`,
    },
  ];

  console.log('Creating test canvases...');

  for (const canvas of testCanvases) {
    await db
      .prepare(
        `INSERT INTO canvas (
          id, center_lat, center_lng, zoom, tile_count,
          created_at, updated_at, share_lat, share_lng, share_zoom, ogp_image_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        canvas.id,
        canvas.center_lat,
        canvas.center_lng,
        canvas.zoom,
        canvas.tile_count,
        canvas.created_at,
        canvas.updated_at,
        canvas.share_lat,
        canvas.share_lng,
        canvas.share_zoom,
        canvas.ogp_image_key
      )
      .run();
  }

  console.log(`✅ Created ${testCanvases.length} test canvases`);
  console.log('\nTest Data Summary:');
  console.log('  - 3 canvases SHOULD BE DELETED (empty/unshared, >30 days old)');
  console.log('  - 3 canvases SHOULD NOT BE DELETED (recent or shared)');
  console.log('\nTo verify cleanup:');
  console.log('  1. Run cleanup: curl http://localhost:8787/__scheduled?cron=0+2+*+*+*');
  console.log('  2. Check deletion_record table for results');
  console.log('  3. Verify 3 canvases were deleted');
}

/**
 * Query and display current canvases
 */
async function displayCanvases(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id, tile_count, created_at, share_lat, share_zoom
       FROM canvas
       ORDER BY created_at DESC`
    )
    .all();

  console.log('\nCurrent Canvases:');
  console.log('─'.repeat(100));
  console.log(
    'ID'.padEnd(38) +
      'Tiles'.padEnd(8) +
      'Created'.padEnd(28) +
      'Shared'.padEnd(8) +
      'Status'
  );
  console.log('─'.repeat(100));

  for (const row of result.results) {
    const canvas = row as any;
    const createdAt = new Date(canvas.created_at);
    const age = Math.floor(
      (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isShared = canvas.share_lat !== null;
    const isEmpty = canvas.tile_count === 0;

    let status = '';
    if (age > 30 && (isEmpty || !isShared)) {
      status = '🔴 SHOULD DELETE';
    } else {
      status = '🟢 KEEP';
    }

    console.log(
      canvas.id.padEnd(38) +
        String(canvas.tile_count).padEnd(8) +
        `${createdAt.toISOString().substring(0, 19)} (${age}d)`.padEnd(28) +
        (isShared ? 'Yes' : 'No').padEnd(8) +
        status
    );
  }

  console.log('─'.repeat(100));
  console.log(`Total: ${result.results.length} canvases\n`);
}

/**
 * Main execution
 *
 * Note: This is a template. In a real implementation, you would:
 * 1. Use wrangler to get a D1 database connection
 * 2. Or use the D1 REST API
 * 3. Or integrate with the actual Cloudflare Workers environment
 */
async function main() {
  console.log('⚠️  Test Data Generator Template');
  console.log('\nThis is a template script. To use it:');
  console.log('1. Initialize local D1: wrangler d1 execute DB --local --file=<SQL>');
  console.log('2. Or use D1 REST API to insert test data');
  console.log('3. Or manually insert via wrangler d1 execute DB --local\n');

  console.log('Example SQL for manual insertion:');
  console.log('─'.repeat(80));

  const thirtyOneDaysAgo = new Date();
  thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
  const id = randomUUID();

  console.log(`
-- Should be deleted (empty, old)
INSERT INTO canvas (
  id, center_lat, center_lng, zoom, tile_count,
  created_at, updated_at, share_lat, share_lng, share_zoom, ogp_image_key
) VALUES (
  '${id}',
  35.6812, 139.7671, 12, 0,
  '${thirtyOneDaysAgo.toISOString()}',
  '${thirtyOneDaysAgo.toISOString()}',
  NULL, NULL, NULL, NULL
);
  `);

  console.log('─'.repeat(80));
}

// Export functions for use in other scripts
export { createTestData, displayCanvases, main };

// Uncomment to run directly:
// main().catch(console.error);
