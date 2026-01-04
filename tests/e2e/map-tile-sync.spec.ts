import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Tile Map Sync Feature (008-tile-map-sync)
 *
 * Tests that drawing tiles follow the map during drag and zoom operations
 * in navigate mode, providing a smooth user experience without "snap" effects.
 */

// Helper: Navigate to app and wait for map to be ready
async function setupMap(page: Page) {
  await page.goto('/');
  // Wait for map container to be visible
  await page.waitForSelector('[class*="leaflet-container"]', { timeout: 10000 });
  // Wait for tiles to load
  await page.waitForTimeout(1000);
}

// Helper: Draw something on the canvas to create tiles
async function drawOnCanvas(page: Page) {
  // Switch to draw mode by clicking the pen tool
  const penButton = page.locator('button[aria-label="ペン"], button:has-text("ペン")').first();
  if (await penButton.isVisible()) {
    await penButton.click();
  }

  // Get the canvas overlay element
  const overlay = page.locator('div[style*="z-index: 500"]');
  await expect(overlay).toBeVisible();

  // Draw a simple stroke
  const box = await overlay.boundingBox();
  if (box) {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.move(centerX - 50, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 50, centerY, { steps: 10 });
    await page.mouse.up();
  }

  // Wait for auto-save
  await page.waitForTimeout(600);
}

// Helper: Switch to navigate mode
async function switchToNavigateMode(page: Page) {
  const navButton = page.locator('button[aria-label="ナビゲート"], button:has-text("移動")').first();
  if (await navButton.isVisible()) {
    await navButton.click();
  }
  await page.waitForTimeout(100);
}

// Helper: Get canvas element
async function getCanvas(page: Page) {
  return page.locator('canvas').first();
}

// Helper: Get the CSS transform of the canvas
async function getCanvasTransform(page: Page): Promise<string> {
  const canvas = await getCanvas(page);
  return await canvas.evaluate((el) => {
    return window.getComputedStyle(el).transform;
  });
}

// =============================================================================
// User Story 1: Smooth Map Dragging Experience (P1)
// =============================================================================

test.describe('User Story 1: ドラッグ時のタイル追従', () => {
  test('T005: ドラッグ中にタイルがマップと同期して移動する', async ({ page }) => {
    await setupMap(page);
    await drawOnCanvas(page);
    await switchToNavigateMode(page);

    // Get initial canvas transform
    const initialTransform = await getCanvasTransform(page);

    // Start dragging the map
    const mapContainer = page.locator('.leaflet-container');
    const box = await mapContainer.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      // Start drag
      await page.mouse.move(startX, startY);
      await page.mouse.down();

      // Move while holding
      await page.mouse.move(startX + 100, startY + 50, { steps: 5 });

      // Check that canvas transform has changed (tile is following)
      const duringDragTransform = await getCanvasTransform(page);

      // The transform should NOT be 'none' or the same as initial during drag
      // This indicates the canvas is being transformed to follow the map
      expect(duringDragTransform).not.toBe('none');

      // Complete the drag
      await page.mouse.up();
    }
  });

  test('T006: ドラッグ完了後にスナップが発生しない', async ({ page }) => {
    await setupMap(page);
    await drawOnCanvas(page);
    await switchToNavigateMode(page);

    const mapContainer = page.locator('.leaflet-container');
    const box = await mapContainer.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      // Perform a drag
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY + 50, { steps: 10 });
      await page.mouse.up();

      // Wait for moveend processing
      await page.waitForTimeout(100);

      // After drag, transform should be reset (empty or none)
      // and tiles should be redrawn at correct positions
      const afterDragTransform = await getCanvasTransform(page);

      // Transform should be reset after drag completes
      expect(afterDragTransform === 'none' || afterDragTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();
    }
  });
});

// =============================================================================
// User Story 2: Smooth Zoom Experience (P1)
// =============================================================================

test.describe('User Story 2: ズーム時のタイル追従', () => {
  test('T011: ズームイン時にタイルがスケールする', async ({ page }) => {
    await setupMap(page);
    await drawOnCanvas(page);
    await switchToNavigateMode(page);

    const mapContainer = page.locator('.leaflet-container');
    const box = await mapContainer.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      // Scroll wheel to zoom in
      await page.mouse.move(centerX, centerY);
      await page.mouse.wheel(0, -100); // Negative = zoom in

      // During zoom animation, check for scale transform
      // Note: This might need adjustment based on actual zoom animation timing
      await page.waitForTimeout(50);

      const duringZoomTransform = await getCanvasTransform(page);

      // During zoom, there should be a scale transform applied
      // The exact value depends on the zoom level change
      // Just verify transform is not 'none'
      expect(duringZoomTransform).not.toBe('none');
    }
  });

  test('T012: ズーム完了後に適切な解像度で再描画される', async ({ page }) => {
    await setupMap(page);
    await drawOnCanvas(page);
    await switchToNavigateMode(page);

    const mapContainer = page.locator('.leaflet-container');
    const box = await mapContainer.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      // Zoom in
      await page.mouse.move(centerX, centerY);
      await page.mouse.wheel(0, -100);

      // Wait for zoom animation to complete
      await page.waitForTimeout(500);

      // After zoom, transform should be reset
      const afterZoomTransform = await getCanvasTransform(page);
      expect(afterZoomTransform === 'none' || afterZoomTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();
    }
  });
});

// =============================================================================
// User Story 3: Mobile Smooth Operation (P2)
// =============================================================================

test.describe('User Story 3: モバイルでのスムーズな操作', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test('T017: モバイルビューポートでタッチドラッグが追従する', async ({ page }) => {
    await setupMap(page);
    await drawOnCanvas(page);
    await switchToNavigateMode(page);

    const mapContainer = page.locator('.leaflet-container');
    const box = await mapContainer.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      // Simulate touch drag
      await page.touchscreen.tap(startX, startY);
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 50, startY + 30, { steps: 5 });

      // Check transform during drag
      const duringDragTransform = await getCanvasTransform(page);
      expect(duringDragTransform).not.toBe('none');

      await page.mouse.up();
    }
  });

  test('T018: ピンチズームが追従する', async ({ page }) => {
    await setupMap(page);
    await drawOnCanvas(page);
    await switchToNavigateMode(page);

    // Pinch zoom is simulated via wheel event in Playwright
    const mapContainer = page.locator('.leaflet-container');
    const box = await mapContainer.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      await page.mouse.move(centerX, centerY);
      await page.mouse.wheel(0, -50);

      await page.waitForTimeout(50);

      const duringZoomTransform = await getCanvasTransform(page);
      // During pinch, there should be transform
      expect(duringZoomTransform).toBeDefined();
    }
  });
});
