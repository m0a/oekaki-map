# Research: レイヤー構造機能

**Date**: 2026-01-03
**Feature**: 003-layer-structure

## 1. レイヤーレンダリング戦略

### Decision: 単一Canvas + 合成描画

各レイヤーのストロークデータをメモリに保持し、描画時に下から順に合成して単一のCanvasに描画する。

### Rationale

- 既存のMapWithDrawingコンポーネントの構造を最小限の変更で拡張可能
- Leafletのオーバーレイは単一のCanvas要素を想定している
- 描画順序（重ね順）の制御が容易
- メモリ効率が良い（Canvas要素を複数持つよりストロークデータ保持の方が軽量）

### Alternatives Considered

1. **複数Canvas要素（レイヤーごとにCanvas）**
   - 却下理由: Leafletのオーバーレイ構造との統合が複雑、z-indexの管理が煩雑

2. **OffscreenCanvas使用**
   - 却下理由: ブラウザ互換性の問題（特にSafari）、現時点ではオーバーエンジニアリング

## 2. レイヤーデータモデル

### Decision: 既存のStrokeDataにlayerId追加 + 新規Layerテーブル

```typescript
interface Layer {
  id: string;           // nanoid生成
  canvasId: string;     // 所属するCanvas
  name: string;         // ユーザー定義の名前
  order: number;        // 重ね順（0が最背面）
  visible: boolean;     // 表示/非表示
  createdAt: string;
  updatedAt: string;
}

interface StrokeData {
  // 既存フィールド...
  layerId: string;      // 追加: 所属レイヤー
}
```

### Rationale

- 既存のStrokeData構造を拡張するだけで、Undo/Redo履歴との整合性を維持
- Layerエンティティを分離することで、レイヤーメタデータ（名前、順序）を永続化可能
- `order`フィールドで重ね順を明示的に管理

### Alternatives Considered

1. **レイヤーごとにストローク配列を持つ構造**
   - 却下理由: Undo/Redo履歴が全レイヤー共通なため、ストロークにlayerIdを持たせる方が整合性が取りやすい

## 3. DrawingTileとレイヤーの関係

### Decision: DrawingTileにlayerId追加

```sql
ALTER TABLE drawing_tile ADD COLUMN layer_id TEXT REFERENCES layer(id);
```

各タイルがどのレイヤーに属するかを記録。レイヤーを跨いだタイル保存は既存の仕組みを活用。

### Rationale

- タイル取得時にレイヤーでフィルタリング可能
- 表示/非表示時に該当レイヤーのタイルのみロード/スキップ可能
- 既存のR2ストレージ構造を変更せずに済む（r2_keyはそのまま）

### Alternatives Considered

1. **レイヤーごとに別々のR2バケットパス**
   - 却下理由: オーバーエンジニアリング、単一バケット内でlayer_idでの識別で十分

## 4. 既存データの後方互換性

### Decision: layer_id = NULLを「レイヤー1」として動的解釈

既存のDrawingTileレコードは`layer_id`がNULL。これをフロントエンドで「デフォルトレイヤー」として解釈。

### Rationale

- データマイグレーション不要（Clarificationで決定済み）
- 既存のキャンバスは自動的に1レイヤー構成として動作
- 新規レイヤー追加時のみlayer_idを明示的に設定

### Implementation

```typescript
// フロントエンドでの解釈
const effectiveLayerId = tile.layerId ?? DEFAULT_LAYER_ID;
```

## 5. ドラッグ&ドロップライブラリ

### Decision: @dnd-kit/core

レイヤー順序変更のドラッグ&ドロップにはdnd-kitを使用。

### Rationale

- React専用で設計されており、hooks APIで使いやすい
- アクセシビリティ対応（キーボード操作、スクリーンリーダー）
- タッチデバイス対応（モバイルファースト要件に適合）
- バンドルサイズが小さい（~8KB gzipped）
- 活発にメンテナンスされている

### Alternatives Considered

1. **react-beautiful-dnd**
   - 却下理由: メンテナンス終了、React 18との互換性問題

2. **自前実装（HTML5 Drag and Drop API）**
   - 却下理由: タッチデバイス対応、アクセシビリティ対応に工数がかかる

## 6. レイヤーパネルUI設計

### Decision: 右サイドパネル（320px）+ トグルボタン

```
+-----------------------------------+--------+
|                                   | Layers |
|           Map Canvas              |--------|
|                                   | Layer3 |
|                                   | Layer2 |
|                                   | Layer1 |
+-----------------------------------+--------+
```

### Rationale

- Clarificationで決定済み
- モバイルでは全幅に展開、デスクトップでは右サイドに固定
- 描画領域を最大限確保しつつ、レイヤー操作にアクセス可能

### Mobile Layout

```
モバイル（パネル非表示時）:
+-------------------+
|      Toolbar      |
|-------------------|
|                   |
|    Map Canvas     |
|                   |
|-------------------|
|   [レイヤー] btn   |
+-------------------+

モバイル（パネル表示時）:
+-------------------+
|  Layers [x]       |
|-------------------|
| Layer3  [👁️] [🗑️]  |
| Layer2  [👁️] [🗑️]  |
| Layer1  [👁️] [🗑️]  |
|-------------------|
| [+ 新規レイヤー]   |
+-------------------+
```

## 7. レイヤー操作とUndo/Redo履歴

### Decision: 描画操作のみUndo対象、レイヤー操作は対象外

### Rationale

- Clarificationで決定済み
- 既存のuseUndoRedo hookの構造を維持
- レイヤー削除は確認ダイアログで保護（誤操作防止）
- 実装の複雑さを抑える

### Implementation Notes

- StrokeDataにlayerIdを追加するだけで、既存のUndo/Redo機能はそのまま動作
- Undo時にストロークのlayerIdを参照して適切なレイヤーに再描画

## 8. APIエンドポイント設計

### Decision: RESTful CRUD for layers

```
POST   /api/canvas/:canvasId/layers          # レイヤー作成
GET    /api/canvas/:canvasId/layers          # レイヤー一覧取得
PATCH  /api/canvas/:canvasId/layers/:id      # レイヤー更新（名前、順序、表示状態）
DELETE /api/canvas/:canvasId/layers/:id      # レイヤー削除
```

### Rationale

- 既存のcanvas APIのネスト構造に合わせる
- Hono RPCでの型安全なクライアント生成
- 順序変更は単一レイヤーのorder更新で対応（バルク更新も検討可能）

## 9. パフォーマンス考慮

### Decision: 遅延ロードなし、全レイヤー即時ロード

キャンバス読み込み時に全レイヤー情報とタイルをロード。

### Rationale

- 最大10レイヤーという制限があるため、パフォーマンス問題は発生しにくい
- 表示/非表示切り替えは即座に反映する必要がある（SC-002: 1秒以内）
- 遅延ロードの複雑さを避ける（YAGNI原則）

### Alternatives Considered

1. **非表示レイヤーのタイルを遅延ロード**
   - 却下理由: 表示切り替え時のUXが悪化、10レイヤー制限内では過剰最適化
