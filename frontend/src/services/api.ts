import type {
  Canvas,
  TileCoordinate,
  CreateCanvasRequest,
  GetCanvasResponse,
  SaveTilesResponse,
} from '../../../backend/src/types';

// API base URL - uses /api prefix (same origin)
const API_BASE_URL = '/api';

// API client wrapper with error handling
export const api = {
  // Health check
  async healthCheck(): Promise<{ status: string; service: string }> {
    const res = await fetch(`${API_BASE_URL}/`);
    if (!res.ok) throw new Error('API health check failed');
    return res.json();
  },

  // Canvas operations
  canvas: {
    // Create a new canvas
    async create(data: CreateCanvasRequest): Promise<{ canvas: Canvas }> {
      const res = await fetch(`${API_BASE_URL}/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create canvas');
      return res.json();
    },

    // Get canvas by ID
    async get(canvasId: string): Promise<GetCanvasResponse> {
      const res = await fetch(`${API_BASE_URL}/canvas/${canvasId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Canvas not found');
        throw new Error('Failed to get canvas');
      }
      return res.json();
    },

    // Update canvas metadata
    async update(
      canvasId: string,
      data: Partial<CreateCanvasRequest>
    ): Promise<Canvas> {
      const res = await fetch(`${API_BASE_URL}/canvas/${canvasId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update canvas');
      return res.json();
    },

    // Update share state (coordinates and zoom for URL sharing)
    async updateShareState(
      canvasId: string,
      data: { shareLat: number; shareLng: number; shareZoom: number }
    ): Promise<Canvas> {
      const res = await fetch(`${API_BASE_URL}/canvas/${canvasId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update share state');
      return res.json();
    },
  },

  // Tile operations
  tiles: {
    // Get tiles for visible area
    async getForArea(
      canvasId: string,
      z: number,
      minX: number,
      maxX: number,
      minY: number,
      maxY: number
    ): Promise<{ tiles: TileCoordinate[] }> {
      const params = new URLSearchParams({
        z: String(z),
        minX: String(minX),
        maxX: String(maxX),
        minY: String(minY),
        maxY: String(maxY),
      });
      const res = await fetch(
        `${API_BASE_URL}/canvas/${canvasId}/tiles?${params}`
      );
      if (!res.ok) throw new Error('Failed to get tiles');
      return res.json();
    },

    // Save tiles
    async save(
      canvasId: string,
      tiles: Array<{ z: number; x: number; y: number; blob: Blob }>
    ): Promise<SaveTilesResponse> {
      const formData = new FormData();
      tiles.forEach((tile, index) => {
        formData.append(`tile_${index}_z`, String(tile.z));
        formData.append(`tile_${index}_x`, String(tile.x));
        formData.append(`tile_${index}_y`, String(tile.y));
        formData.append(`tile_${index}_image`, tile.blob);
      });
      formData.append('count', String(tiles.length));

      const res = await fetch(`${API_BASE_URL}/canvas/${canvasId}/tiles`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to save tiles');
      return res.json();
    },

    // Get tile image URL with optional cache version
    getImageUrl(
      canvasId: string,
      z: number,
      x: number,
      y: number,
      updatedAt?: string
    ): string {
      const base = `${API_BASE_URL}/tiles/${canvasId}/${z}/${x}/${y}.webp`;
      return updatedAt ? `${base}?v=${updatedAt}` : base;
    },
  },

  // OGP operations
  ogp: {
    // Upload OGP preview image
    async upload(
      canvasId: string,
      image: Blob,
      placeName: string
    ): Promise<{
      success: boolean;
      imageUrl: string;
      placeName: string;
      generatedAt: string;
    }> {
      const formData = new FormData();
      formData.append('image', image, 'preview.png');
      formData.append('placeName', placeName);

      const res = await fetch(`${API_BASE_URL}/ogp/${canvasId}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 413) throw new Error('Image too large');
        if (res.status === 404) throw new Error('Canvas not found');
        throw new Error('Failed to upload OGP image');
      }

      return res.json();
    },

    // Get OGP metadata
    async getMetadata(canvasId: string): Promise<{
      title: string;
      description: string;
      imageUrl: string;
      pageUrl: string;
      imageWidth: number;
      imageHeight: number;
      siteName: string;
    }> {
      const res = await fetch(`${API_BASE_URL}/ogp/${canvasId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('OGP metadata not found');
        throw new Error('Failed to get OGP metadata');
      }
      return res.json();
    },
  },
};

export type { Canvas, TileCoordinate, CreateCanvasRequest };
