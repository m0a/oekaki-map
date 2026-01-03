# Research: OGP Share Preview

**Feature Branch**: `006-ogp-share-preview`
**Date**: 2026-01-04

## 1. Map Screenshot Capture

### Decision: leaflet-simple-map-screenshoter

**Rationale**: html2canvasよりも2-3倍高速で、Leaflet固有の問題（transform clipping、panning後のタイル位置ずれ）に対応済み。dom-to-imageをベースにしており、メモリ使用量も少ない。

**Alternatives considered**:
- **html2canvas**: パフォーマンスが遅い（21秒 vs 7秒）、Leafletのtransform問題でタイルがずれる
- **Puppeteer (server-side)**: 信頼性は高いがCloudflare Workersでは実行不可
- **Screen Capture API**: ユーザー許可が必要

**Implementation**:
```typescript
import { SimpleMapScreenshoter } from 'leaflet-simple-map-screenshoter'

const screenshoter = new SimpleMapScreenshoter({
  cropImageByInnerWH: true,
  mimeType: 'image/png',
  hideElementsWithSelectors: ['.leaflet-control-container']
}).addTo(map)

// Take screenshot
const imageDataUrl = await screenshoter.takeScreen('image')
```

**CORS対策**: タイル画像はCORS対応サーバーから配信されている必要がある。OSMタイルはCORS対応済み。

---

## 2. OGP Image Specifications

### Decision: 1200x630 PNG

**Rationale**: LINE、X（Twitter）、Facebookすべてで最適なサイズ。アスペクト比1.91:1が推奨。

| Platform | Recommended | Minimum | Aspect Ratio |
|----------|-------------|---------|--------------|
| Facebook | 1200x630 | 600x315 | 1.91:1 |
| X (Twitter) | 1200x628 | 300x157 | 1.91:1 |
| LINE | 1200x630 | 200x200 | 1.91:1 |

**File requirements**:
- Format: PNG（品質重視）またはJPG（サイズ重視）
- Max size: 150KB推奨、8MB上限（Facebook）

---

## 3. OGP Meta Tags

### Decision: OGP + Twitter Card両方を出力

**Required tags**:
```html
<!-- Open Graph (LINE, Facebook, Slack等) -->
<meta property="og:title" content="渋谷周辺のお絵かきマップ" />
<meta property="og:description" content="地図に絵を描いて共有しよう" />
<meta property="og:image" content="https://example.com/ogp/abc123.png" />
<meta property="og:url" content="https://example.com/c/abc123" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="お絵かきマップ" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="渋谷周辺のお絵かきマップ" />
<meta name="twitter:description" content="地図に絵を描いて共有しよう" />
<meta name="twitter:image" content="https://example.com/ogp/abc123.png" />
```

---

## 4. Crawler Detection

### Decision: User-Agentパターンマッチング

**Rationale**: シンプルで信頼性が高い。すべてのリクエストにOGPタグ付きHTMLを返却する方式も可能だが、SPAのパフォーマンスを考慮してクローラーのみ動的HTMLを返却。

**Crawler patterns**:
```typescript
const CRAWLER_PATTERNS = [
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'Slackbot',
  'Discordbot',
  'TelegramBot',
  'Line',
  'Googlebot',
  'bingbot',
  'Applebot',
]

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false
  return CRAWLER_PATTERNS.some(pattern =>
    userAgent.toLowerCase().includes(pattern.toLowerCase())
  )
}
```

**Alternative**: 常にOGPタグ付きHTMLを返却（シンプルだがHTMLサイズ増加）

---

## 5. Reverse Geocoding (Nominatim)

### Decision: OpenStreetMap Nominatim API

**Rationale**: 無料、APIキー不要、日本語対応。利用規約を遵守すれば問題なし。

**API Endpoint**:
```
GET https://nominatim.openstreetmap.org/reverse
  ?lat={latitude}
  &lon={longitude}
  &format=json
  &accept-language=ja
  &addressdetails=1
  &zoom=14
```

**Usage Policy**:
- Rate limit: 最大1リクエスト/秒
- User-Agent: 必須（アプリ識別子を含める）
- キャッシュ: 必須（同一クエリの繰り返しはブロック対象）

**Required Headers**:
```typescript
const headers = {
  'User-Agent': 'OekakiMap/1.0 (https://oekaki-map.example.com)'
}
```

**Response Example**:
```json
{
  "display_name": "渋谷区, 東京都, 日本",
  "address": {
    "city": "渋谷区",
    "state": "東京都",
    "country": "日本"
  }
}
```

**Place Name Extraction**:
```typescript
function extractPlaceName(address: NominatimAddress): string {
  const locality = address.city || address.town || address.village || address.suburb
  if (locality) {
    return `${locality}周辺`
  }
  return '地図'
}
```

**Fallback Strategy**:
- Nominatim失敗時: 座標文字列 `35.6762, 139.6503付近` を使用
- Rate limit時: バックオフ後リトライ

---

## 6. Image Storage

### Decision: Cloudflare R2 (既存インフラ活用)

**Rationale**: 既にタイル画像保存で使用中。OGPプレビュー画像も同じバケットに保存可能。

**Key format**:
```
ogp/{canvasId}.png
```

**Upload implementation**:
```typescript
await bucket.put(`ogp/${canvasId}.png`, imageData, {
  httpMetadata: {
    contentType: 'image/png',
    cacheControl: 'public, max-age=86400', // 24時間
  },
})
```

**Public URL**: R2バケットのカスタムドメインまたはWorkerプロキシ経由でアクセス可能にする必要あり。

---

## Summary of Decisions

| Topic | Decision | Key Reason |
|-------|----------|------------|
| Screenshot | leaflet-simple-map-screenshoter | 高速、Leaflet対応 |
| Image Size | 1200x630 PNG | 全SNS対応 |
| Meta Tags | OGP + Twitter Card両方 | 互換性最大化 |
| Crawler Detection | User-Agent pattern | シンプル、信頼性 |
| Geocoding | Nominatim API | 無料、日本語対応 |
| Storage | R2 | 既存インフラ活用 |
