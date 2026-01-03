import { describe, it, expect } from 'vitest';
import {
  generateOGPHtml,
  generateTopPageOGPHtml,
  generateCanvasOGPMetadata,
} from '../src/templates/ogp-html';

describe('generateOGPHtml', () => {
  const metadata = {
    title: '渋谷区周辺のお絵かきマップ',
    description: '地図に絵を描いて共有しよう',
    imageUrl: 'https://example.com/api/ogp/image/abc123.png',
    pageUrl: 'https://example.com/c/abc123',
    imageWidth: 1200,
    imageHeight: 630,
    siteName: 'お絵かきマップ',
  };

  it('should generate HTML with OGP meta tags', () => {
    const html = generateOGPHtml(metadata);

    expect(html).toContain('<meta property="og:title" content="渋谷区周辺のお絵かきマップ"');
    expect(html).toContain('<meta property="og:description" content="地図に絵を描いて共有しよう"');
    expect(html).toContain('<meta property="og:image" content="https://example.com/api/ogp/image/abc123.png"');
    expect(html).toContain('<meta property="og:url" content="https://example.com/c/abc123"');
    expect(html).toContain('<meta property="og:type" content="website"');
    expect(html).toContain('<meta property="og:site_name" content="お絵かきマップ"');
    expect(html).toContain('<meta property="og:image:width" content="1200"');
    expect(html).toContain('<meta property="og:image:height" content="630"');
  });

  it('should generate HTML with Twitter Card meta tags', () => {
    const html = generateOGPHtml(metadata);

    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(html).toContain('<meta name="twitter:title" content="渋谷区周辺のお絵かきマップ"');
    expect(html).toContain('<meta name="twitter:description" content="地図に絵を描いて共有しよう"');
    expect(html).toContain('<meta name="twitter:image" content="https://example.com/api/ogp/image/abc123.png"');
  });

  it('should escape HTML special characters', () => {
    const htmlInjectionMetadata = {
      ...metadata,
      title: '<script>alert("XSS")</script>',
      description: 'Test & "quotes"',
    };
    const html = generateOGPHtml(htmlInjectionMetadata);

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });

  it('should include og:locale and og:image:alt', () => {
    const html = generateOGPHtml(metadata);

    expect(html).toContain('<meta property="og:locale" content="ja_JP"');
    expect(html).toContain('<meta property="og:image:alt"');
  });
});

describe('generateTopPageOGPHtml', () => {
  it('should generate HTML for top page with static metadata', () => {
    const html = generateTopPageOGPHtml('https://example.com');

    expect(html).toContain('<meta property="og:title" content="お絵かきマップ - 地図に絵を描いて共有"');
    expect(html).toContain('<meta property="og:image" content="https://example.com/ogp-default.png"');
    expect(html).toContain('<meta property="og:url" content="https://example.com"');
  });
});

describe('generateCanvasOGPMetadata', () => {
  it('should generate metadata with place name', () => {
    const metadata = generateCanvasOGPMetadata(
      'abc123',
      '渋谷区',
      'ogp/abc123.png',
      'https://example.com'
    );

    expect(metadata.title).toBe('渋谷区周辺のお絵かきマップ');
    expect(metadata.imageUrl).toBe('https://example.com/api/ogp/image/abc123.png');
    expect(metadata.pageUrl).toBe('https://example.com/c/abc123');
  });

  it('should generate metadata without place name', () => {
    const metadata = generateCanvasOGPMetadata(
      'abc123',
      null,
      null,
      'https://example.com'
    );

    expect(metadata.title).toBe('お絵かきマップ');
    expect(metadata.imageUrl).toBe('https://example.com/ogp-default.png');
  });
});
