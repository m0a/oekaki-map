# Research: Compact Toolbar Design

**Feature**: 005-compact-toolbar
**Date**: 2026-01-03

## Research Tasks

### 1. SVGアイコン実装パターン

**Question**: ReactでSVGアイコンを実装する最適な方法は？

**Decision**: インラインSVGコンポーネントとして実装

**Rationale**:
- アイコンライブラリ（Lucide, Heroicons等）を導入すると依存関係が増える
- 必要なアイコンは6個のみ（鉛筆、消しゴム、手のひら、レイヤー、Undo、Redo）
- インラインSVGは色やサイズをpropsで簡単にカスタマイズ可能
- バンドルサイズの最小化（外部ライブラリ不要）

**Alternatives considered**:
| Option | Pros | Cons |
|--------|------|------|
| Lucide React | 豊富なアイコン、一貫したスタイル | 追加依存関係、使わないアイコンも含む |
| SVG sprite | 1回のHTTP要求 | 設定が複雑、Viteでの設定が必要 |
| **Inline SVG components** | 依存関係なし、完全なカスタマイズ | 手動でSVG作成が必要 |

### 2. ポップアップUIパターン

**Question**: モバイルファーストのポップアップ/ドロップダウン実装パターンは？

**Decision**: 絶対位置指定 + 外部クリック検知のカスタム実装

**Rationale**:
- Radix UIやHeadless UIは過剰な依存関係
- ポップアップは2種類のみ（色、太さ）で機能がシンプル
- useRefとclickイベントで外部クリック検知可能
- 位置計算はボタンの上方向に固定で十分

**Implementation Pattern**:
```typescript
// PopupType管理
type PopupType = 'none' | 'color' | 'thickness';
const [openPopup, setOpenPopup] = useState<PopupType>('none');

// 外部クリック検知
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (!popupRef.current?.contains(e.target as Node)) {
      setOpenPopup('none');
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

**Alternatives considered**:
| Option | Pros | Cons |
|--------|------|------|
| Radix UI Popover | アクセシビリティ完備、位置自動調整 | 重い依存関係 |
| Headless UI | React用に最適化 | Tailwind前提の設計 |
| **Custom implementation** | 軽量、完全制御 | 手動でa11y対応が必要 |

### 3. ツールチップ実装

**Question**: モバイル（長押し）とデスクトップ（ホバー）の両対応ツールチップは？

**Decision**: title属性 + カスタム長押し検知

**Rationale**:
- デスクトップはブラウザ標準のtitle属性で十分
- モバイルはtouchstart/touchendで長押し検知
- 複雑なツールチップライブラリは不要

**Implementation Pattern**:
```typescript
// 長押し検知フック
function useLongPress(callback: () => void, delay = 500) {
  const timeoutRef = useRef<number>();

  const start = () => {
    timeoutRef.current = window.setTimeout(callback, delay);
  };

  const clear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
  };
}
```

**Alternatives considered**:
| Option | Pros | Cons |
|--------|------|------|
| react-tooltip | 機能豊富、カスタマイズ可能 | 追加依存関係 |
| Floating UI | 位置計算が正確 | 過剰な機能 |
| **title + custom long press** | 軽量、十分な機能 | 長押し時のカスタムUI必要 |

### 4. アイコンデザイン選定

**Question**: 各ツールを表す最適なアイコン形状は？

**Decision**: 標準的なグラフィックツールアイコン

**Icon Specifications**:
| Tool | Icon | SVG viewBox | Notes |
|------|------|-------------|-------|
| Draw | 鉛筆 | 0 0 24 24 | 45度傾き、先端が描画位置を示す |
| Erase | 消しゴム | 0 0 24 24 | 長方形、斜めに配置 |
| Move | 手のひら | 0 0 24 24 | 開いた手、5本指 |
| Layers | 重なった四角形 | 0 0 24 24 | 3枚の重なったレイヤー |
| Undo | 左向き矢印 | 0 0 24 24 | 反時計回りの矢印 |
| Redo | 右向き矢印 | 0 0 24 24 | 時計回りの矢印 |

**Rationale**:
- Photoshop、Procreate、Canva等で共通のアイコンパターン
- ユーザーが直感的に理解可能
- シンプルなパスで高速レンダリング

### 5. ボタンサイズとタッチターゲット

**Question**: モバイルでのタッチしやすいボタンサイズは？

**Decision**: 44x44px（アイコン20x20px + パディング）

**Rationale**:
- Apple Human Interface Guidelines: 最小44pt
- Android Material Design: 最小48dp（44pxで許容範囲）
- 現在のボタンサイズ（32-36px）より大きく、かつツールバー全体がコンパクトに

**Layout Calculation**:
```
現在のボタン数（最大表示時）:
- カラー: 8個 → 1個 (ポップアップ化)
- 太さ: 3個 → 1個 (ポップアップ化)
- Undo/Redo: 2個 → 2個
- モード: 4個 → 4個
- 共有: 1個 → 1個
- 現在位置: 1個 → 1個

合計: 19個 → 10個
幅: 10 * 44px + 9 * 4px(gap) = 476px → 320px画面でも余裕
```

## Summary

本機能はフロントエンドのみの変更で、以下の技術選定を採用：

1. **SVGアイコン**: インラインコンポーネント（依存関係なし）
2. **ポップアップ**: カスタム実装（useRef + clickイベント）
3. **ツールチップ**: title属性 + 長押し検知フック
4. **ボタンサイズ**: 44x44px（タッチ最適化）

すべての選択がConstitution（Simplicity & YAGNI、Mobile-First）に準拠。
