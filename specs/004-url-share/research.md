# Research: URL共有ボタン・現在位置取得ボタン

**Branch**: `004-url-share` | **Date**: 2026-01-03

## 1. Web Share API

### Decision
Web Share APIを使用してネイティブ共有シートを表示する。非対応ブラウザではClipboard APIにフォールバック。

### Rationale
- モバイルブラウザ（Safari、Chrome）で広くサポートされている
- ユーザーがインストール済みのアプリ（X、LINE等）に直接共有できる
- シンプルなAPIで実装が容易

### Best Practices
```typescript
// Web Share API対応チェック
const canShare = navigator.share !== undefined;

// 共有実行
async function share(url: string, title: string) {
  if (navigator.share) {
    await navigator.share({ url, title });
  } else {
    // フォールバック: クリップボードにコピー
    await navigator.clipboard.writeText(url);
  }
}
```

### Browser Support
- iOS Safari: 12.2+
- Android Chrome: 61+
- Desktop Chrome: 89+ (Windows/ChromeOS only)
- Desktop Safari: 非対応（クリップボードフォールバック）
- Firefox: 非対応（クリップボードフォールバック）

### Alternatives Considered
1. **各SNS専用のシェアURL**: 実装が複雑、メンテナンスコスト高
2. **独自モーダル**: UXが劣る、ネイティブ感がない

---

## 2. Geolocation API

### Decision
Geolocation APIを使用して現在位置を取得する。非対応または許可拒否時はエラーメッセージを表示。

### Rationale
- 全てのモダンブラウザでサポート
- 標準Web API、追加ライブラリ不要
- HTTPS環境で動作（Cloudflare WorkersはデフォルトでHTTPS）

### Best Practices
```typescript
interface GeolocationState {
  loading: boolean;
  error: string | null;
  position: { lat: number; lng: number } | null;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });
  });
}
```

### Error Handling
| Error Code | Message | User Action |
|------------|---------|-------------|
| PERMISSION_DENIED | 位置情報の許可が必要です | 設定から許可 |
| POSITION_UNAVAILABLE | 位置情報を取得できません | 再試行 |
| TIMEOUT | 位置情報の取得がタイムアウトしました | 再試行 |

### Alternatives Considered
1. **IPベース位置推定**: 精度が低い、ユーザー期待と異なる
2. **マニュアル入力**: UXが悪い

---

## 3. Clipboard API

### Decision
Web Share API非対応時のフォールバックとしてClipboard APIを使用。

### Rationale
- モダンブラウザで広くサポート
- 非同期API（navigator.clipboard.writeText）が安全で推奨
- ユーザーアクション（クリック）から呼び出す必要あり

### Best Practices
```typescript
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}
```

### Alternatives Considered
1. **document.execCommand('copy')**: 非推奨、将来削除予定
2. **Flash-based copy**: 完全に廃止

---

## 4. DB Schema Extension

### Decision
既存のcanvasテーブルに共有ビュー状態用のカラムを追加する。

### Rationale
- 既存のcenter_lat, center_lng, zoomとは別に「共有時の状態」を保存
- 新規テーブル作成より既存テーブル拡張がシンプル
- マイグレーションが容易

### Schema Change
```sql
-- canvasテーブルに追加するカラム
ALTER TABLE canvas ADD COLUMN share_lat REAL;
ALTER TABLE canvas ADD COLUMN share_lng REAL;
ALTER TABLE canvas ADD COLUMN share_zoom INTEGER;
```

### Alternatives Considered
1. **別テーブル（share_state）**: オーバーエンジニアリング、JOINが必要
2. **JSONカラム**: 型安全性が低い、クエリが複雑

---

## 5. UI/UX Patterns

### Decision
Toolbarに共有ボタンと現在位置ボタンを追加。アイコンベースのシンプルなデザイン。

### Rationale
- 既存のToolbarコンポーネントに統合
- モバイルファーストでタップしやすいサイズ（44x44px以上）
- 視覚的フィードバック（ローディング、成功、エラー）

### Button States
| Button | Default | Loading | Success | Error |
|--------|---------|---------|---------|-------|
| 共有 | 共有アイコン | - | トースト表示 | トースト表示 |
| 現在位置 | 位置アイコン | スピナー | 地図移動 | トースト表示 |

### Accessibility
- `aria-label`で操作内容を明示
- フォーカス可能でキーボード操作対応
- コントラスト比4.5:1以上

---

## Summary

全ての技術的調査が完了。NEEDS CLARIFICATIONなし。

| Topic | Decision |
|-------|----------|
| 共有API | Web Share API + Clipboard fallback |
| 位置取得 | Geolocation API |
| DB変更 | canvasテーブルにshare_*カラム追加 |
| UI配置 | Toolbar内にボタン追加 |
