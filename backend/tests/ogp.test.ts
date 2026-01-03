import { describe, it, expect } from 'vitest';
import { OGPService } from '../src/services/ogp';

describe('OGPService.generateMetadata', () => {
  const mockDb = {} as D1Database;
  const service = new OGPService(mockDb);
  const baseUrl = 'https://example.com';

  it('should generate metadata with place name', () => {
    const metadata = service.generateMetadata(
      'abc123',
      '渋谷区',
      'ogp/abc123.png',
      baseUrl
    );

    expect(metadata.title).toBe('渋谷区周辺のお絵かきマップ');
    expect(metadata.description).toBe('地図に絵を描いて共有しよう');
    expect(metadata.imageUrl).toBe('https://example.com/api/ogp/image/abc123.png');
    expect(metadata.pageUrl).toBe('https://example.com/c/abc123');
    expect(metadata.imageWidth).toBe(1200);
    expect(metadata.imageHeight).toBe(630);
    expect(metadata.siteName).toBe('お絵かきマップ');
  });

  it('should generate metadata without place name', () => {
    const metadata = service.generateMetadata('abc123', null, null, baseUrl);

    expect(metadata.title).toBe('お絵かきマップ');
    expect(metadata.imageUrl).toBe('https://example.com/ogp-default.png');
  });

  it('should use default image when ogpImageKey is null', () => {
    const metadata = service.generateMetadata(
      'abc123',
      '渋谷区',
      null,
      baseUrl
    );

    expect(metadata.imageUrl).toBe('https://example.com/ogp-default.png');
  });

  it('should generate correct page URL', () => {
    const metadata = service.generateMetadata(
      'xyz789',
      null,
      null,
      'https://oekaki-map.com'
    );

    expect(metadata.pageUrl).toBe('https://oekaki-map.com/c/xyz789');
  });
});
