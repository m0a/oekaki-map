# Research: タイルマップ追従

**Feature**: 008-tile-map-sync
**Date**: 2026-01-04

## 概要

マップのドラッグ移動・拡大縮小時に描画タイルがリアルタイムで追従する実装方法を調査。

## 現状の問題

**ファイル**: `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`

- HTML5 Canvasオーバーレイ（z-index: 400）がビューポートに固定
- タイル再描画は`moveend`イベントのみで実行（L353, L580-600）
- 結果: ドラッグ中はタイルが動かず、完了後に「スナップ」する

## 調査した選択肢

### 選択肢1: Leaflet Paneシステム

**概要**: カスタムペインを作成し、Canvasをペイン内に配置

**仕組み**:
- Leafletはパン時にCSS transform (`translate3d`)を各ペインに適用
- `overlayPane`や`tilePane`内の要素は自動追従

**問題点**:
- カスタムオーバーレイで`translate3d`の位置ずれが報告されている
- `viewreset`時の手動再配置が必要
- 既存のCanvas描画ロジックとの統合が複雑

**結論**: ❌ 複雑すぎる

---

### 選択肢2: CSS Transform同期

**概要**: `move`イベントで`tilePane`のtransformをコピー

**実装パターン**:
```typescript
map.on('move', () => {
  const tilePane = map.getPane('tilePane');
  canvas.style.transform = tilePane.style.transform;
});

map.on('moveend', () => {
  canvas.style.transform = ''; // リセット
  redrawAll(); // 正確な再描画
});
```

**利点**:
- 実装が最小限（既存コードに数行追加）
- CSS transformはGPUアクセラレーション対応（60fps達成可能）
- 既存のタイルキャッシュ・描画ロジックをそのまま活用

**欠点**:
- `moveend`後の再描画は依然必要
- transformリセット時に一瞬ちらつく可能性（要テスト）

**結論**: ✅ **採用** - 最小限の変更で目標達成

---

### 選択肢3: L.GridLayer

**概要**: Leafletのタイルレイヤーシステムを使用

**実装パターン**:
```typescript
class DrawingTileLayer extends L.GridLayer {
  createTile(coords, done) {
    const tile = document.createElement('canvas');
    // タイル画像を読み込んで描画
    return tile;
  }
}
```

**利点**:
- Leaflet標準の最適なタイル管理
- 自動キャッシュ・プルーニング
- スムーズなズームアニメーション

**欠点**:
- 大幅なリファクタリングが必要（1-2日）
- 描画モードとナビゲートモードでレイヤー切り替えが必要
- 消しゴムモードのタイル間合成が複雑

**結論**: ❌ 過剰な変更

---

### 選択肢4: イベントベース再描画

**概要**: `move`イベントでCanvas全体を再描画

**問題**:
- 100タイルの再描画に10-15ms
- 16.67msのフレーム予算を超過
- パフォーマンス低下が報告されている

**結論**: ❌ パフォーマンス不足

---

## 決定事項

### Decision 1: CSS Transform同期アプローチを採用

**選択**: 選択肢2（CSS Transform同期）

**理由**:
1. 最小限の変更で60fps達成可能
2. 既存アーキテクチャを維持
3. リスクが低い（問題発生時に戻しやすい）

**却下した代替案**:
- L.GridLayer: 過剰なリファクタリング（YAGNI原則違反）
- イベント再描画: パフォーマンス不足
- Paneシステム: 統合が複雑

---

### Decision 2: ズーム中の追従方法

**選択**: transformのscale併用

**実装**:
```typescript
map.on('zoom', () => {
  const scale = map.getZoomScale(map.getZoom());
  canvas.style.transform = `scale(${scale})`;
});
```

**理由**: CSS scaleはGPUアクセラレーション対応

---

### Decision 3: Canvas位置の基準点

**選択**: 現在のcanvasOriginRef方式を維持

**理由**:
- 既存の座標変換ロジック（`projectToPixel`）との整合性
- `moveend`後の正確な再描画を保証

---

## パフォーマンス考慮事項

| 操作 | 予想時間 | 60fps目標 |
|------|----------|-----------|
| CSS transform適用 | ~0.1ms | ✅ 達成 |
| transformリセット | ~0.1ms | ✅ 達成 |
| 100タイル再描画 | ~10-15ms | ⚠️ moveend時のみ |
| 慣性スクロール中 | transform継続 | ✅ 達成 |

---

## 実装優先順位

1. **P1**: `move`イベントでのtransform同期
2. **P1**: `zoom`イベントでのscale同期
3. **P1**: `moveend`/`zoomend`でのリセット・再描画
4. **P2**: 慣性スクロール対応確認
5. **P2**: モバイルタッチ操作テスト
