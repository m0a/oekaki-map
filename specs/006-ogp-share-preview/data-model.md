# Data Model: OGP Share Preview

**Feature Branch**: `006-ogp-share-preview`
**Date**: 2026-01-04

## Entity Changes

### Canvas (既存テーブル拡張)

OGPプレビュー画像の参照を追加。

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `ogp_image_key` | TEXT | NULLABLE | R2のOGP画像キー (e.g., `ogp/abc123.png`) |
| `ogp_place_name` | TEXT | NULLABLE, max 100 chars | 逆ジオコーディングで取得した地名 (e.g., `渋谷区`) |
| `ogp_generated_at` | TEXT | NULLABLE | OGP画像生成日時 (ISO 8601) |

**Migration SQL**:
```sql
ALTER TABLE canvas ADD COLUMN ogp_image_key TEXT;
ALTER TABLE canvas ADD COLUMN ogp_place_name TEXT CHECK (ogp_place_name IS NULL OR length(ogp_place_name) <= 100);
ALTER TABLE canvas ADD COLUMN ogp_generated_at TEXT;
```

### OGP Metadata (ランタイムのみ、非永続)

動的に生成されるメタデータ。DBには保存しない。

```typescript
interface OGPMetadata {
  title: string        // e.g., "渋谷区周辺のお絵かきマップ"
  description: string  // e.g., "地図に絵を描いて共有しよう"
  imageUrl: string     // e.g., "https://example.com/ogp/abc123.png"
  pageUrl: string      // e.g., "https://example.com/c/abc123"
  imageWidth: number   // 1200
  imageHeight: number  // 630
}
```

## R2 Storage Structure

### OGP Images

| Key Pattern | Content Type | Cache Control |
|-------------|--------------|---------------|
| `ogp/{canvasId}.png` | image/png | public, max-age=86400 |

**Example**:
```
ogp/abc123.png  → 1200x630 PNG preview image
```

## State Transitions

### Canvas OGP State

```
[No OGP Data]
    ↓ (共有ボタンクリック)
[Generating]
    ↓ (画像アップロード成功)
[OGP Ready]
    ↓ (再共有)
[Regenerating] → [OGP Ready]
```

| State | ogp_image_key | ogp_generated_at | Description |
|-------|---------------|------------------|-------------|
| No OGP Data | NULL | NULL | 初期状態、共有未実行 |
| OGP Ready | 設定済み | 設定済み | OGP画像生成完了 |

## Validation Rules

### ogp_place_name
- NULL許容（Nominatim失敗時のフォールバック）
- 最大100文字
- 日本語・英語混在可

### ogp_image_key
- NULL許容（未共有時）
- R2キー形式: `ogp/{canvasId}.png`

## Relationships

```
canvas (1) ←→ (0..1) ogp_image (R2)
                      ↑
                  ogp_image_key で参照
```

## Indexes (既存で十分)

OGP関連フィールドへの追加インデックスは不要。
- `ogp_image_key` はキャンバスID取得後にのみ参照
- 検索やフィルタには使用しない
