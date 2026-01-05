import type { OGPMetadata } from '../types/index';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateOGPHtml(
  metadata: OGPMetadata,
  spaScriptPath: string = '/assets/index.js'
): string {
  const escaped = {
    title: escapeHtml(metadata.title),
    description: escapeHtml(metadata.description),
    imageUrl: escapeHtml(metadata.imageUrl),
    pageUrl: escapeHtml(metadata.pageUrl),
    siteName: escapeHtml(metadata.siteName),
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escaped.title}</title>

  <!-- Open Graph (LINE, Facebook, Slack等) -->
  <meta property="og:title" content="${escaped.title}" />
  <meta property="og:description" content="${escaped.description}" />
  <meta property="og:image" content="${escaped.imageUrl}" />
  <meta property="og:url" content="${escaped.pageUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escaped.siteName}" />
  <meta property="og:image:width" content="${metadata.imageWidth}" />
  <meta property="og:image:height" content="${metadata.imageHeight}" />
  <meta property="og:locale" content="ja_JP" />
  <meta property="og:image:alt" content="${escaped.title}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escaped.title}" />
  <meta name="twitter:description" content="${escaped.description}" />
  <meta name="twitter:image" content="${escaped.imageUrl}" />
  <meta name="twitter:image:alt" content="${escaped.title}" />

  <meta name="theme-color" content="#ffffff" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${spaScriptPath}"></script>
</body>
</html>`;
}

export function generateTopPageOGPHtml(
  baseUrl: string,
  spaScriptPath: string = '/assets/index.js'
): string {
  const metadata: OGPMetadata = {
    title: 'お絵かきマップ - 地図に絵を描いて共有',
    description: '地図上に自由に絵を描いて、友達やSNSで共有できるWebアプリ。LINE、X（Twitter）、Facebookで美しいプレビュー付きで共有しよう。',
    imageUrl: `${baseUrl}/ogp-default.png`,
    pageUrl: baseUrl,
    imageWidth: 1200,
    imageHeight: 630,
    siteName: 'お絵かきマップ',
  };

  return generateOGPHtml(metadata, spaScriptPath);
}

export function generateCanvasOGPMetadata(
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
    imageWidth: 1200,
    imageHeight: 630,
    siteName: 'お絵かきマップ',
  };
}
