# Quickstart: Compact Toolbar Design

**Feature**: 005-compact-toolbar
**Date**: 2026-01-03

## Prerequisites

- Node.js 20+
- pnpm または npm

## Setup

```bash
# リポジトリのルートから
cd frontend
npm install
```

## Development

```bash
# 開発サーバー起動
npm run dev

# テスト実行（ウォッチモード）
npm run test

# 型チェック
npm run type-check
```

## Testing This Feature

### 1. Unit Tests

```bash
# Toolbarコンポーネントのテスト
npm run test -- Toolbar

# 特定のテストファイルを実行
npm run test -- src/components/Toolbar/Toolbar.test.tsx
```

### 2. Visual Testing

1. `npm run dev` でローカルサーバーを起動
2. ブラウザで `http://localhost:5173` を開く
3. 以下を確認：
   - すべてのボタンがアイコン表示になっている
   - 色ボタンをタップするとカラーパレットがポップアップ
   - 太さボタンをタップすると太さ選択がポップアップ
   - ポップアップ外をタップするとポップアップが閉じる
   - モバイルビューでツールバーが1行に収まる

### 3. Mobile Testing

Chrome DevToolsのデバイスモードで以下のデバイスをテスト：
- iPhone SE (375px)
- iPhone 12 Pro (390px)
- Pixel 5 (393px)
- Galaxy S8+ (360px)

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/components/Toolbar/Toolbar.tsx` | メインツールバー（リファクタリング対象） |
| `frontend/src/components/Toolbar/Toolbar.test.tsx` | テストファイル |
| `frontend/src/components/Toolbar/IconButton.tsx` | 新規：アイコンボタン |
| `frontend/src/components/Toolbar/ColorPopup.tsx` | 新規：カラーパレットポップアップ |
| `frontend/src/components/Toolbar/ThicknessPopup.tsx` | 新規：太さ選択ポップアップ |
| `frontend/src/components/Toolbar/icons/` | 新規：SVGアイコンコンポーネント |
| `frontend/src/types/index.ts` | PopupType追加 |

## TDD Workflow

Constitution準拠のため、以下の順序で実装：

1. **Red**: テストを書く（失敗する）
2. **Green**: テストを通す最小限のコードを書く
3. **Refactor**: コードを整理する

### Example: IconButton Component

```typescript
// 1. テストを先に書く（Red）
describe('IconButton', () => {
  it('renders icon with correct aria-label', () => {
    render(<IconButton icon={<PencilIcon />} label="Draw" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Draw' })).toBeInTheDocument();
  });

  it('shows tooltip on hover', () => {
    render(<IconButton icon={<PencilIcon />} label="Draw" tooltip="描画" onClick={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('title', '描画');
  });

  it('applies active styles when isActive is true', () => {
    render(<IconButton icon={<PencilIcon />} label="Draw" isActive onClick={() => {}} />);
    // スタイルの検証
  });
});

// 2. テストを通すコードを書く（Green）
// 3. リファクタリング（Refactor）
```

## Troubleshooting

### ポップアップが閉じない
- useEffect内のclickイベントリスナーが正しく設定されているか確認
- event.stopPropagation()の使用場所を確認

### アイコンが表示されない
- SVGのviewBox属性が正しいか確認
- fill/strokeの設定を確認

### タッチ操作が動作しない
- touchstart/touchendイベントが設定されているか確認
- passive: trueオプションの使用を検討
