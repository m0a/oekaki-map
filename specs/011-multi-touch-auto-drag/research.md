# Research: マルチタッチ自動ドラッグモード切替

**Date**: 2026-01-18
**Feature**: 011-multi-touch-auto-drag

## 調査項目

1. Pointer Events APIでのマルチタッチ追跡方法
2. タッチ数変化の検出パターン
3. 描画モードと地図操作モードの切り替えベストプラクティス
4. Leafletへのイベント透過方法
5. iOS Safariの既知の問題

---

## 1. マルチタッチ追跡 (pointerId)

### Decision: Map/Setでアクティブポインターをキャッシュ

**Rationale**: 各タッチ指に一意の`pointerId`が割り当てられ、ジェスチャー全体（pointerdown〜pointerup）を通じて保持される。Mapを使うとO(1)でルックアップ可能。

**Pattern**:
```typescript
const pointerCache = useRef<Map<number, PointerEvent>>(new Map());

// pointerdown: キャッシュに追加
pointerCache.current.set(ev.pointerId, ev);

// pointermove: キャッシュを更新
pointerCache.current.set(ev.pointerId, ev);

// pointerup/cancel: キャッシュから削除
pointerCache.current.delete(ev.pointerId);

// 現在のポインター数
const pointerCount = pointerCache.current.size;
```

**Alternatives Considered**:
- Array: ルックアップがO(n)になるため非採用
- WeakMap: pointerIdがnumberであるため使用不可

---

## 2. タッチ数変化の検出

### Decision: ポインターイベントハンドラー内でキャッシュサイズをチェック

**Rationale**: pointerdown/pointerup時にキャッシュサイズの変化を監視し、1→2+または2+→0の遷移を検出。

**Pattern**:
```typescript
function handlePointerDown(ev: PointerEvent) {
  pointerCache.current.set(ev.pointerId, ev);
  const count = pointerCache.current.size;

  if (count === 1) {
    // シングルタッチ開始 → 描画モード
    startDrawing();
  } else if (count === 2) {
    // 2本目追加 → 地図操作モードへ切り替え
    cancelCurrentStroke();
    enableMapGestures();
  }
}

function handlePointerUp(ev: PointerEvent) {
  if (pointerCache.current.size === 1) {
    // 最後の指が離れる前にストローク確定
    endStroke();
  }
  pointerCache.current.delete(ev.pointerId);

  if (pointerCache.current.size === 0) {
    // 全ての指が離れた → 描画モード準備状態へ
    disableMapGestures();
  }
}
```

**Edge Case - 同時タッチ（100ms以内）**:
仕様では100ms以内の同時タッチはマルチタッチとして扱うとあるが、Pointer Events APIは各指を個別のpointerdownイベントとして発火するため、実質的に最初の`pointerCache.size >= 2`チェックで自然に対応可能。追加のdebounceは不要。

---

## 3. モード切り替えのベストプラクティス

### Decision: CSS `pointer-events` プロパティによる切り替え

**Rationale**: マルチタッチ検出時にCanvasの`pointer-events: none`を設定することで、イベントが下層のLeafletマップに透過する。シンプルで確実な方法。

**Pattern**:
```typescript
// 状態
const [isMultiTouch, setIsMultiTouch] = useState(false);

// Canvas style
const pointerEvents = isMultiTouch ? 'none' : 'auto';

return <canvas style={{ pointerEvents }} />;
```

**Alternatives Considered**:
- `stopPropagation()`の選択的呼び出し: イベントバブリングの複雑さ増加
- Leaflet Handler直接制御（`map.dragging.enable()`）: 併用可能だが`pointer-events`で十分

---

## 4. Leafletへのイベント透過

### Decision: `pointer-events: none` + Leaflet Handler無効化の併用

**Rationale**:
- 描画モード時: Canvas `pointer-events: auto`、Leaflet dragging/touchZoom無効
- マルチタッチ時: Canvas `pointer-events: none`、Leaflet dragging/touchZoom有効

**Pattern**:
```typescript
// 現在のDrawingCanvas.tsxの実装
const pointerEvents = mode === 'navigate' ? 'none' : 'auto';

// 拡張: マルチタッチ検出時も'none'に
const pointerEvents = (mode === 'navigate' || isMultiTouch) ? 'none' : 'auto';
```

Leaflet側は`MapWithDrawing.tsx`で既に制御済み（描画モード時に`dragging.disable()`等）。

---

## 5. iOS Safari既知の問題

### Decision: `touch-action: none`の代わりに`preventDefault()`を使用

**Rationale**: iOS Safariは`touch-action: none`を完全にはサポートしない。描画モード時は`touchstart`/`touchmove`で`preventDefault()`を呼ぶ必要がある。

**Pattern**:
```typescript
// 現在の実装で既に touchAction: 'none' を設定
// iOS Safari対応のため、追加で以下が必要:

const handleTouchStart = useCallback((e: TouchEvent) => {
  if (!isMultiTouch && mode !== 'navigate') {
    e.preventDefault();
  }
}, [isMultiTouch, mode]);

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchStart, { passive: false });

  return () => {
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchStart);
  };
}, [handleTouchStart]);
```

**その他のiOS Safari注意点**:
- `pointerType`が`'mouse'`と誤検出される場合がある → `pointerType`での分岐は避ける
- iPadOS 14+のScribble機能との競合 → `preventDefault()`で対応済み

---

## 実装方針まとめ

1. **新規hook `useMultiTouch`を作成**
   - `Map<number, PointerEvent>`でアクティブポインターを追跡
   - `isMultiTouch: boolean`状態をエクスポート
   - pointerdown/pointerup/pointercancelのハンドラーを提供

2. **DrawingCanvas.tsxを修正**
   - `useMultiTouch`フックを使用
   - `pointerEvents`スタイルを`isMultiTouch`で条件分岐
   - 描画中に2本目のタッチが来たら現在のストロークを確定（`handlePointerUp`相当を呼ぶ）

3. **iOS Safari対応**
   - touchstart/touchmoveに`preventDefault()`追加（`passive: false`必須）

4. **テスト**
   - useMultiTouchフックのユニットテスト
   - PointerEventのモック（pointerId指定）

---

## 参考リンク

- [MDN: Multi-touch interaction - Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Multi-touch_interaction)
- [MDN: Pinch zoom gestures](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures)
- [MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- [Safari touch-action limitations (GitHub issue)](https://github.com/jquery/PEP/issues/350)
