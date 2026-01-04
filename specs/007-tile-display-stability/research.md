# Phase 0 Research: タイル表示安定性の修正

**Feature**: 007-tile-display-stability | **Date**: 2026-01-04

## Questions to Investigate

1. **現在のタイル読み込みとストローク再描画の競合パターン**
2. **既存のキャッシュ機構と改善可能な点**
3. **他のプロジェクトでの同様の問題の解決パターン**

## Findings

### 1. 現在の描画アーキテクチャ分析

**ファイル**: `frontend/src/components/MapWithDrawing/MapWithDrawing.tsx`

#### タイル読み込みのuseEffect（3箇所）

1. **初期タイル読み込み**（lines 416-447）
   - `tiles`配列または`canvasId`変更時にトリガー
   - サーバーからタイル画像を取得し`loadTilesToCanvas()`で描画
   - Promise-basedの画像読み込み

2. **モード切替時のタイル再読み込み**（lines 527-538）
   - 描画モード → ナビゲートモードへの切替時
   - `reloadTilesForCurrentView()`を呼び出し
   - キャッシュバスター付き（`?t=${Date.now()}`）

3. **マップ移動時のタイル再読み込み**（lines 541-560）
   - ナビゲートモードでマップ移動終了時
   - 可視範囲のタイルを取得

#### ストローク再描画のuseEffect（lines 520-524）

```typescript
useEffect(() => {
  if (strokes !== undefined) {
    redrawStrokes(strokes, visibleLayerIds);
  }
}, [strokes, visibleLayerIds, redrawStrokes]);
```

#### レースコンディションの発生メカニズム

`redrawStrokes()`関数（lines 450-517）は以下の処理を実行：

```typescript
// Line 457: キャンバス全消去
ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

// その後、ストロークのみを再描画
for (const stroke of strokesToRedraw) {
  // ... ストローク描画処理
}
```

**問題**:
- タイル読み込みuseEffectとストロークuseEffectは独立して実行される
- 両方とも`strokes`配列の変更でトリガーされる可能性がある（Undo/Redo時）
- `clearRect()`がタイルを含む全描画を消去するため、実行順序によってはタイルが消失

### 2. 現在のキャッシュ機構

**メモリキャッシュ: なし**
- タイル画像は`Image`オブジェクトとして読み込まれるが、明示的なキャッシュ（Map/WeakMap等）は存在しない
- ガベージコレクションで消去される可能性

**ブラウザキャッシュ**
- `api.tiles.getImageUrl()`は標準URLを返却
- キャッシュバスター使用時は毎回サーバーから取得

### 3. 解決パターン

#### パターンA: Canvas分離アプローチ

```text
Container
├── TileCanvas (背景レイヤー、タイル専用)
└── StrokeCanvas (前景レイヤー、ストローク専用)
```

**メリット**:
- 完全な分離により競合排除
- タイル再描画が不要（ストローク変更時）

**デメリット**:
- 既存アーキテクチャの大幅変更が必要
- 合成処理（消しゴム等）の複雑化

#### パターンB: タイルキャッシュ + 描画順序保証

```typescript
// タイルをメモリにキャッシュ
const tileCache = new Map<string, ImageData>();

// 再描画時の順序保証
function redrawAll() {
  ctx.clearRect(...);
  // 1. タイルを先に描画（キャッシュから）
  renderCachedTiles();
  // 2. ストロークを後に描画
  renderStrokes();
}
```

**メリット**:
- 既存アーキテクチャを維持しつつ修正可能
- シンプルな実装

**デメリット**:
- メモリ使用量増加（タイルキャッシュ）

#### パターンC: RenderQueue（描画キュー）

```typescript
const renderQueue = {
  tiles: Map<string, HTMLImageElement>,
  strokes: StrokeData[],
  render() {
    ctx.clearRect(...);
    this.renderTiles();
    this.renderStrokes();
  }
};
```

**メリット**:
- 描画順序の完全な制御
- 状態管理の一元化

**デメリット**:
- 新しい抽象化レイヤーの追加

### 推奨アプローチ

**パターンB（タイルキャッシュ + 描画順序保証）を推奨**

理由:
1. **Simplicity & YAGNI原則に準拠**: 必要最小限の変更で問題を解決
2. **既存コードへの影響最小**: 新規のCanvas追加や大規模リファクタリング不要
3. **テスト容易性**: キャッシュと描画順序を個別にテスト可能

### 実装方針

1. **TileCacheの導入**
   - `Map<string, HTMLImageElement>`でタイル画像をキャッシュ
   - キーは`${canvasId}:${z}:${x}:${y}`形式

2. **redrawAll()関数の作成**
   - `clearRect()`後、必ずタイル→ストロークの順で描画
   - 既存の`redrawStrokes()`を拡張または置換

3. **useEffectの統合**
   - タイル読み込みとストローク再描画を単一の描画フローに統合
   - 競合を構造的に排除

## Research Confidence

| Topic | Confidence | Notes |
|-------|------------|-------|
| 問題の根本原因 | ✅ HIGH | コード分析で確認済み |
| 解決パターン | ✅ HIGH | 標準的なCanvas描画パターン |
| 既存コードへの影響 | ✅ HIGH | 変更箇所は限定的 |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| キャッシュのメモリ使用量 | LOW | タイルは256x256で小さい、最大100枚程度 |
| 消しゴム機能の動作 | MEDIUM | 合成順序を維持することでテストで確認 |
| パフォーマンス劣化 | LOW | キャッシュにより再読み込み削減、むしろ改善 |

## Next Steps

1. Phase 1: data-model.md（TileCache, RenderQueue型定義）
2. Phase 1: quickstart.md（実装手順）
3. `/speckit.tasks`でタスク生成
