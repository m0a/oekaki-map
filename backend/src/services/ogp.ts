import type { Env, Canvas, OGPMetadata } from '../types/index';
import { OGP_IMAGE_WIDTH, OGP_IMAGE_HEIGHT } from '../types/index';

export class OGPService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getCanvasOGPData(
    canvasId: string
  ): Promise<Pick<Canvas, 'id' | 'shareLat' | 'shareLng' | 'shareZoom' | 'centerLat' | 'centerLng' | 'zoom' | 'ogpImageKey' | 'ogpPlaceName' | 'ogpGeneratedAt'> | null> {
    const result = await this.db
      .prepare(
        `SELECT id, share_lat, share_lng, share_zoom, center_lat, center_lng, zoom,
                ogp_image_key, ogp_place_name, ogp_generated_at
         FROM canvas WHERE id = ?`
      )
      .bind(canvasId)
      .first<{
        id: string;
        share_lat: number | null;
        share_lng: number | null;
        share_zoom: number | null;
        center_lat: number;
        center_lng: number;
        zoom: number;
        ogp_image_key: string | null;
        ogp_place_name: string | null;
        ogp_generated_at: string | null;
      }>();

    if (!result) return null;

    return {
      id: result.id,
      shareLat: result.share_lat,
      shareLng: result.share_lng,
      shareZoom: result.share_zoom,
      centerLat: result.center_lat,
      centerLng: result.center_lng,
      zoom: result.zoom,
      ogpImageKey: result.ogp_image_key,
      ogpPlaceName: result.ogp_place_name,
      ogpGeneratedAt: result.ogp_generated_at,
    };
  }

  async updateOGPData(
    canvasId: string,
    ogpImageKey: string,
    placeName: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE canvas
         SET ogp_image_key = ?, ogp_place_name = ?, ogp_generated_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(ogpImageKey, placeName, now, now, canvasId)
      .run();
  }

  generateMetadata(
    canvasId: string,
    placeName: string | null,
    ogpImageKey: string | null,
    baseUrl: string
  ): OGPMetadata {
    let title = 'お絵かきマップ';
    if (placeName) {
      // 「周辺」で終わっている場合は重複を避ける
      title = placeName.endsWith('周辺')
        ? `${placeName}のお絵かきマップ`
        : `${placeName}周辺のお絵かきマップ`;
    }

    const imageUrl = ogpImageKey
      ? `${baseUrl}/api/ogp/image/${canvasId}.png`
      : `${baseUrl}/ogp-default.png`;

    return {
      title,
      description: '地図に絵を描いて共有しよう',
      imageUrl,
      pageUrl: `${baseUrl}/c/${canvasId}`,
      imageWidth: OGP_IMAGE_WIDTH,
      imageHeight: OGP_IMAGE_HEIGHT,
      siteName: 'お絵かきマップ',
    };
  }
}

export function createOGPService(env: Env): OGPService {
  return new OGPService(env.DB);
}
