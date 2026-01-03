import { Hono } from 'hono';
import type { Env, OGPUploadResponse } from '../types/index';
import { OGP_MAX_IMAGE_SIZE_BYTES, OGP_MAX_PLACE_NAME_LENGTH } from '../types/index';
import { createOGPService } from '../services/ogp';
import { createOGPStorageService } from '../services/ogp-storage';

// OGP routes
const ogpRoutes = new Hono<{ Bindings: Env }>();

// POST /ogp/:canvasId - Upload OGP preview image
ogpRoutes.post('/:canvasId', async (c) => {
  const canvasId = c.req.param('canvasId');

  if (canvasId.length !== 21) {
    return c.json(
      { error: 'INVALID_ID', message: 'Invalid canvas ID format' },
      400
    );
  }

  const ogpService = createOGPService(c.env);
  const storageService = createOGPStorageService(c.env);

  // Check if canvas exists
  const canvas = await ogpService.getCanvasOGPData(canvasId);
  if (!canvas) {
    return c.json({ error: 'NOT_FOUND', message: 'Canvas not found' }, 404);
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json(
      { error: 'INVALID_REQUEST', message: 'Invalid form data' },
      400
    );
  }

  const imageFile = formData.get('image') as File | null;
  const placeName = formData.get('placeName');

  // Validate image
  if (!imageFile || typeof imageFile === 'string') {
    return c.json(
      { error: 'MISSING_IMAGE', message: 'Image file is required' },
      400
    );
  }

  // Check file size
  if (imageFile.size > OGP_MAX_IMAGE_SIZE_BYTES) {
    return c.json(
      {
        error: 'IMAGE_TOO_LARGE',
        message: `Image must be less than ${OGP_MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`,
      },
      413
    );
  }

  // Check content type
  if (!imageFile.type.startsWith('image/')) {
    return c.json(
      { error: 'INVALID_IMAGE_TYPE', message: 'File must be an image' },
      400
    );
  }

  // Validate placeName
  if (typeof placeName !== 'string') {
    return c.json(
      { error: 'MISSING_PLACE_NAME', message: 'Place name is required' },
      400
    );
  }

  if (placeName.length > OGP_MAX_PLACE_NAME_LENGTH) {
    return c.json(
      {
        error: 'PLACE_NAME_TOO_LONG',
        message: `Place name must be less than ${OGP_MAX_PLACE_NAME_LENGTH} characters`,
      },
      400
    );
  }

  try {
    // Upload image to R2
    const imageBuffer = await imageFile.arrayBuffer();
    const ogpImageKey = await storageService.uploadImage(canvasId, imageBuffer);

    // Update canvas OGP data
    await ogpService.updateOGPData(canvasId, ogpImageKey, placeName);

    // Get base URL from request
    const url = new URL(c.req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const response: OGPUploadResponse = {
      success: true,
      imageUrl: `${baseUrl}/api/ogp/image/${canvasId}.png`,
      placeName,
      generatedAt: new Date().toISOString(),
    };

    return c.json(response);
  } catch (error) {
    console.error('Failed to upload OGP image:', error);
    return c.json(
      { error: 'UPLOAD_FAILED', message: 'Failed to upload OGP image' },
      500
    );
  }
});

// GET /ogp/:canvasId - Get OGP metadata
ogpRoutes.get('/:canvasId', async (c) => {
  const canvasId = c.req.param('canvasId');

  if (canvasId.length !== 21) {
    return c.json(
      { error: 'INVALID_ID', message: 'Invalid canvas ID format' },
      400
    );
  }

  const ogpService = createOGPService(c.env);
  const canvas = await ogpService.getCanvasOGPData(canvasId);

  if (!canvas) {
    return c.json({ error: 'NOT_FOUND', message: 'Canvas not found' }, 404);
  }

  // Get base URL from request
  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const metadata = ogpService.generateMetadata(
    canvasId,
    canvas.ogpPlaceName,
    canvas.ogpImageKey,
    baseUrl
  );

  return c.json(metadata);
});

// GET /ogp/image/:canvasId.png - Serve OGP image from R2
ogpRoutes.get('/image/:filename', async (c) => {
  const filename = c.req.param('filename');

  // Extract canvasId from filename (e.g., "abc123.png" -> "abc123")
  const match = filename?.match(/^(.+)\.png$/);
  if (!match || !match[1]) {
    return c.json(
      { error: 'INVALID_FILENAME', message: 'Invalid filename format' },
      400
    );
  }

  const canvasId = match[1];

  if (canvasId.length !== 21) {
    return c.json(
      { error: 'INVALID_ID', message: 'Invalid canvas ID format' },
      400
    );
  }

  const storageService = createOGPStorageService(c.env);
  const image = await storageService.getImage(canvasId);

  if (!image) {
    return c.json({ error: 'NOT_FOUND', message: 'OGP image not found' }, 404);
  }

  return new Response(image.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

export { ogpRoutes };
