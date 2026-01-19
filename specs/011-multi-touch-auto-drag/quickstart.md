# Quickstart: マルチタッチ自動ドラッグモード切替

**Feature**: 011-multi-touch-auto-drag
**Date**: 2026-01-18

## 概要

この機能は、タッチデバイスでの描画体験を改善します。1本指タッチで描画、2本指以上で地図操作（パン/ズーム）に自動切り替えします。

## 前提条件

- Node.js 20+
- pnpm

## ローカル開発

```bash
# 依存関係インストール
cd frontend && pnpm install

# 開発サーバー起動
pnpm dev
```

## 変更対象ファイル

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `frontend/src/hooks/useMultiTouch.ts` | 新規作成 | マルチタッチ状態管理hook |
| `frontend/src/hooks/useMultiTouch.test.ts` | 新規作成 | hookのユニットテスト |
| `frontend/src/components/DrawingCanvas/DrawingCanvas.tsx` | 修正 | useMultiTouch統合 |

## 主要な型定義

```typescript
// useMultiTouch hookの戻り値
interface UseMultiTouchResult {
  /** 現在マルチタッチ中かどうか */
  isMultiTouch: boolean;
  /** アクティブなポインター数 */
  pointerCount: number;
  /** pointerdownハンドラー */
  handlePointerDown: (e: React.PointerEvent) => void;
  /** pointerupハンドラー */
  handlePointerUp: (e: React.PointerEvent) => void;
  /** pointercancelハンドラー */
  handlePointerCancel: (e: React.PointerEvent) => void;
}
```

## 使用例

```typescript
// DrawingCanvas.tsx での使用イメージ
import { useMultiTouch } from '../../hooks/useMultiTouch';

export function DrawingCanvas({ mode, ... }) {
  const {
    isMultiTouch,
    handlePointerDown: onMultiTouchPointerDown,
    handlePointerUp: onMultiTouchPointerUp,
    handlePointerCancel: onMultiTouchPointerCancel,
  } = useMultiTouch({
    onMultiTouchStart: () => {
      // 描画中ならストローク確定
      if (isDrawingRef.current) {
        handlePointerUp();
      }
    },
  });

  // pointerEventsをマルチタッチ時にnoneに
  const pointerEvents = (mode === 'navigate' || isMultiTouch) ? 'none' : 'auto';

  const handlePointerDown = (e: React.PointerEvent) => {
    onMultiTouchPointerDown(e);
    if (isMultiTouch) return;
    // 既存の描画ロジック...
  };

  return (
    <canvas
      style={{ pointerEvents, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => {
        onMultiTouchPointerUp(e);
        handlePointerUp();
      }}
      onPointerCancel={(e) => {
        onMultiTouchPointerCancel(e);
        handlePointerUp();
      }}
    />
  );
}
```

## テスト実行

```bash
# ユニットテスト実行
cd frontend && pnpm test

# 特定のテストファイルのみ
pnpm test src/hooks/useMultiTouch.test.ts
```

## 手動テスト項目

| # | シナリオ | 期待結果 |
|---|---------|---------|
| 1 | ペンモードで1本指描画 | 線が描画される |
| 2 | ペンモードで2本指ピンチ | 地図がズームする（描画されない） |
| 3 | 描画中に2本目の指を追加 | 描画が確定し、地図操作モードへ |
| 4 | 2本指操作後、全ての指を離す | 次の1本指タッチで描画可能 |
| 5 | 消しゴムモードで2本指ピンチ | 地図がズームする（消去されない） |

## iOS Safari テスト

iOS Safariでは`touch-action: none`が完全にサポートされないため、実機テストが必須です。

1. iPhone/iPadの実機で https://localhost:5173 にアクセス（要HTTPS）
2. 上記の手動テスト項目を全て実行
3. 特に「描画中に2本目の指を追加」のケースを重点的に確認
