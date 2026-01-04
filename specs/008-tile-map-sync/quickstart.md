# Quickstart: タイルマップ追従

**Feature**: 008-tile-map-sync
**Date**: 2026-01-04

## 概要

マップのドラッグ・ズーム時に描画タイルをリアルタイムで追従させる。CSS transform同期アプローチを採用。

## 前提条件

- Node.js 20+
- npm or pnpm

## セットアップ

```bash
# プロジェクトルートで
cd frontend
npm install
npm run dev
```

## 主要ファイル

| ファイル | 役割 |
|----------|------|
| `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx` | 主要改修対象 |
| `frontend/tests/components/MapWithDrawing.test.tsx` | ユニットテスト |
| `tests/e2e/map-tile-sync.spec.ts` | E2Eテスト |

## 実装アプローチ

### 1. Transform同期（move イベント）

```typescript
// MapWithDrawing.tsx に追加
map.on('move', () => {
  if (!canvasRef.current || drawingState.mode !== 'navigate') return;
  const tilePane = map.getPane('tilePane');
  if (tilePane) {
    canvasRef.current.style.transform = tilePane.style.transform;
  }
});
```

### 2. Zoom同期

```typescript
map.on('zoom', () => {
  if (!canvasRef.current || drawingState.mode !== 'navigate') return;
  const scale = map.getZoomScale(map.getZoom(), canvasZoomRef.current);
  canvasRef.current.style.transform = `scale(${scale})`;
});
```

### 3. リセット・再描画（moveend/zoomend）

```typescript
map.on('moveend', () => {
  if (!canvasRef.current) return;
  canvasRef.current.style.transform = '';
  // 既存のreloadTilesForCurrentView()が呼ばれる
});
```

## テスト方法

### 手動テスト

1. `npm run dev`でアプリ起動
2. 何か描画する
3. ナビゲートモードに切り替え
4. マップをドラッグ → タイルが追従することを確認
5. ピンチズーム → タイルがスケールすることを確認

### 自動テスト

```bash
# ユニットテスト
cd frontend && npm test

# E2Eテスト
npm run test:e2e
```

## 確認ポイント

- [ ] ドラッグ中にタイルがマップと同期して動く
- [ ] ズーム中にタイルがマップと同期してスケールする
- [ ] 操作完了後に「スナップ」が発生しない
- [ ] 描画モードは従来通り動作する
- [ ] モバイルのタッチ操作で正常に動作する
- [ ] 100枚以上のタイルでも60fpsを維持
