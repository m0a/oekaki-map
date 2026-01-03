# Data Model: Compact Toolbar Design

**Feature**: 005-compact-toolbar
**Date**: 2026-01-03

## Overview

本機能はUIのみの変更であり、バックエンドやデータベースへの影響はありません。
以下は、フロントエンドの状態管理に使用する型定義です。

## New Types

### PopupType

ツールバー内のポップアップ表示状態を管理する型。

```typescript
// frontend/src/types/index.ts に追加
export type PopupType = 'none' | 'color' | 'thickness';
```

**States**:
| Value | Description |
|-------|-------------|
| `'none'` | ポップアップ非表示（デフォルト） |
| `'color'` | カラーパレットポップアップ表示中 |
| `'thickness'` | 線の太さポップアップ表示中 |

**Validation Rules**:
- 同時に表示できるポップアップは1つのみ
- ポップアップ外をタップすると `'none'` に戻る
- 選択完了時に `'none'` に戻る

## Component Props

### IconButtonProps

再利用可能なアイコンボタンコンポーネントのプロパティ。

```typescript
interface IconButtonProps {
  /** ボタンに表示するアイコン（ReactNode） */
  icon: React.ReactNode;
  /** ボタンが選択状態かどうか */
  isActive?: boolean;
  /** ボタンが無効状態かどうか */
  disabled?: boolean;
  /** クリック時のコールバック */
  onClick: () => void;
  /** アクセシビリティ用のラベル（aria-label） */
  label: string;
  /** ツールチップテキスト */
  tooltip?: string;
  /** ボタンサイズ（デフォルト: 44） */
  size?: number;
}
```

### ColorPopupProps

カラーパレットポップアップのプロパティ。

```typescript
interface ColorPopupProps {
  /** 利用可能な色のリスト */
  colors: readonly string[];
  /** 現在選択中の色 */
  selectedColor: string;
  /** 色選択時のコールバック */
  onColorSelect: (color: string) => void;
  /** ポップアップを閉じるコールバック */
  onClose: () => void;
}
```

### ThicknessPopupProps

線の太さポップアップのプロパティ。

```typescript
interface ThicknessPopupProps {
  /** 利用可能な太さのマップ */
  thicknesses: Record<string, number>;
  /** 現在選択中の太さ */
  selectedThickness: number;
  /** 太さ選択時のコールバック */
  onThicknessSelect: (thickness: number) => void;
  /** ポップアップを閉じるコールバック */
  onClose: () => void;
}
```

## State Management

### Toolbar Component State

```typescript
// Toolbar.tsx 内部状態
const [openPopup, setOpenPopup] = useState<PopupType>('none');
```

**State Transitions**:
```
User Action                    State Change
────────────────────────────────────────────
色ボタンをタップ          → openPopup: 'color'
太さボタンをタップ        → openPopup: 'thickness'
色を選択                  → openPopup: 'none', onColorChange(color)
太さを選択                → openPopup: 'none', onThicknessChange(thickness)
ポップアップ外をタップ    → openPopup: 'none'
別のポップアップを開く    → openPopup: (new popup type)
```

## Icon Components

### Icon Component Interface

すべてのアイコンコンポーネントは同一のインターフェースを持つ。

```typescript
interface IconProps {
  /** アイコンサイズ（width & height） */
  size?: number;
  /** アイコンの色 */
  color?: string;
  /** 追加のクラス名 */
  className?: string;
}
```

### Icon Components List

| Component | File | Description |
|-----------|------|-------------|
| `PencilIcon` | `icons/PencilIcon.tsx` | 描画モードアイコン |
| `EraserIcon` | `icons/EraserIcon.tsx` | 消去モードアイコン |
| `HandIcon` | `icons/HandIcon.tsx` | 移動モードアイコン |
| `LayersIcon` | `icons/LayersIcon.tsx` | レイヤーパネル切替アイコン |
| `UndoIcon` | `icons/UndoIcon.tsx` | 元に戻すアイコン |
| `RedoIcon` | `icons/RedoIcon.tsx` | やり直しアイコン |

## Existing Types (No Changes)

以下の既存型は変更なし：

- `DrawingState` - 描画状態（mode, color, thickness）
- `DEFAULT_COLORS` - 8色のカラーパレット
- `LINE_THICKNESSES` - 3段階の線の太さ

## API Contracts

**本機能ではAPIの変更はありません。**

UIコンポーネントの変更のみであり、バックエンドとの通信には影響しません。
