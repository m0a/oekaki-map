# Feature Specification: OGP Share Preview

**Feature Branch**: `006-ogp-share-preview`
**Created**: 2026-01-04
**Status**: Draft
**Input**: User description: "lineやxに共有した場合の見た目を整える"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - LINE共有でプレビュー表示 (Priority: P1)

ユーザーが作成した地図お絵かきをLINEで友達に共有する際、リンクを送信するとLINEのトーク画面上に地図のプレビュー画像とタイトル・説明文が表示され、受け取った側が内容を把握してからリンクをタップできる。

**Why this priority**: LINEは日本国内で最も利用されているメッセージアプリであり、主要なターゲットユーザーへの共有体験を最適化することが最も重要。プレビューがないリンクは無視されやすく、共有の成功率に直接影響する。

**Independent Test**: LINE Developersのページキャッシュクリアツールを使い、共有URLを入力してプレビューが表示されることを確認できる。実際にLINEトークでURLを送信し、プレビュー表示を目視確認。

**Acceptance Scenarios**:

1. **Given** ユーザーが地図お絵かきを作成・共有しURL（/c/:canvasId）を取得している, **When** そのURLをLINEトークに貼り付けて送信する, **Then** トーク画面にプレビュー画像、タイトル（「お絵かきマップ」等）、説明文が表示される
2. **Given** 共有URLが正しく設定されている, **When** LINEユーザーがプレビューをタップする, **Then** ブラウザでお絵かきマップが開き、保存された共有位置で地図が表示される
3. **Given** プレビュー画像が生成されている, **When** LINEでプレビューを確認する, **Then** 画像は地図の共有位置周辺のお絵かきが含まれた内容になっている

---

### User Story 2 - X（Twitter）共有でカード表示 (Priority: P1)

ユーザーがX（旧Twitter）で地図お絵かきをポストする際、URLを含めて投稿するとTwitterカード（Summary Card with Large Image）として地図のプレビュー画像とタイトル・説明文が表示される。

**Why this priority**: Xは不特定多数への拡散に最も効果的なプラットフォーム。適切なTwitterカードがないと投稿がテキストリンクのみになり、エンゲージメントが大幅に低下する。LINEと同等に重要。

**Independent Test**: X社のCard Validatorツールを使い、共有URLを入力してカードプレビューが正しく表示されることを確認できる。

**Acceptance Scenarios**:

1. **Given** ユーザーが共有URLを取得している, **When** そのURLを含むポストをXに投稿する, **Then** 投稿にSummary Card with Large Imageが表示される
2. **Given** Twitterカード用メタタグが設定されている, **When** Xのクローラーがページを取得する, **Then** twitter:card, twitter:title, twitter:description, twitter:imageが正しく読み取られる
3. **Given** プレビュー画像が生成されている, **When** Xでカードを確認する, **Then** 画像のアスペクト比が適切（推奨2:1〜1.91:1）で、地図のお絵かきが鮮明に表示される

---

### User Story 3 - Facebook/その他SNS共有 (Priority: P2)

ユーザーがFacebookやその他のOGP対応サービスで地図お絵かきを共有する際、適切なプレビューが表示される。

**Why this priority**: FacebookやSlack等もOGP対応しているため、基本的なOGPタグ実装でこれらもカバーできる。追加コストなしで対応範囲が広がる。

**Independent Test**: Facebook Sharing Debuggerツールを使い、共有URLを入力してプレビューが正しく表示されることを確認できる。

**Acceptance Scenarios**:

1. **Given** OGPメタタグが正しく設定されている, **When** FacebookでURLを共有する, **Then** プレビュー画像、タイトル、説明文が表示される
2. **Given** OGPメタタグが正しく設定されている, **When** Slackにリンクを貼り付ける, **Then** リンクプレビューが展開される

---

### User Story 4 - 共有前のプレビュー確認 (Priority: P3)

ユーザーが共有ボタンをクリックした後、実際にSNSに共有する前に、どのようなプレビュー画像が使用されるか確認できる。

**Why this priority**: ユーザーが意図しない画像が共有されることを防ぎ、共有体験の満足度を向上させる。必須ではないが、ユーザー体験を改善する。

**Independent Test**: 共有ダイアログでプレビュー画像が表示されることを目視確認できる。

**Acceptance Scenarios**:

1. **Given** ユーザーが共有ボタンをクリックした, **When** 共有ダイアログが表示される, **Then** プレビュー画像のサムネイルが表示され、SNSでの見た目を確認できる

---

### Edge Cases

- 何も描画されていないキャンバスを共有した場合 → デフォルトのプレビュー画像（アプリロゴや説明画像）が表示される
- 共有位置が設定されていない場合 → キャンバスの中心位置またはデフォルト位置でプレビュー画像を生成する
- 非常に広域（低ズームレベル）で共有した場合 → プレビュー画像は共有位置周辺のみをキャプチャし、認識可能なサイズで表示する
- プレビュー画像の生成に失敗した場合 → デフォルトのフォールバック画像を使用する
- 長時間経過後にキャッシュされたOGP情報が古い場合 → 各SNSのキャッシュ更新機構に依存（ユーザーへの明示的な対応は不要）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムは共有URL（/c/:canvasId）へのアクセス時に、適切なOGPメタタグを含むHTMLを返却しなければならない
- **FR-002**: システムはog:title, og:description, og:image, og:urlのメタタグを動的に生成しなければならない。キャンバスページでは位置情報から自動生成（例：「渋谷周辺のお絵かきマップ」）する
- **FR-003**: システムはtwitter:card（summary_large_image）, twitter:title, twitter:description, twitter:imageのメタタグを生成しなければならない
- **FR-004**: システムは共有ボタンクリック時に各キャンバスのプレビュー画像を生成・保存しなければならない
- **FR-005**: プレビュー画像はキャンバスの共有位置（share_lat, share_lng, share_zoom）を中心とした地図とお絵かきのスナップショットでなければならない
- **FR-006**: プレビュー画像のサイズはOGP推奨サイズ（1200x630ピクセル程度）に準拠しなければならない
- **FR-007**: 共有位置が設定されていない場合、システムはキャンバスの中心位置（center_lat, center_lng, zoom）を使用しなければならない
- **FR-008**: お絵かきが存在しないキャンバスの場合、システムはデフォルトのプレビュー画像を使用しなければならない
- **FR-009**: SNSクローラー（LINE, X, Facebook等）がURLにアクセスした際、JavaScriptの実行なしでメタタグを取得できなければならない
- **FR-010**: システムはog:image:width, og:image:heightを含め、画像サイズをメタタグで明示しなければならない
- **FR-011**: システムはトップページ（ルートURL）へのアクセス時にも、アプリ紹介用の固定OGPメタタグを返却しなければならない

### Key Entities

- **Canvas**: 地図お絵かきのコンテナ。既存のid, center_lat, center_lng, zoom, share_lat, share_lng, share_zoomに加え、プレビュー画像への参照を持つ
- **Preview Image**: キャンバスの視覚的スナップショット。画像URL、生成日時、サイズ情報を含む
- **OGP Metadata**: SNS共有時に使用されるメタデータセット。タイトル、説明文、画像URL、ページURLで構成

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 共有URLをLINEトークに投稿した際、100%の確率でプレビュー画像が表示される
- **SC-002**: 共有URLをXに投稿した際、Summary Card with Large Imageとして100%表示される
- **SC-003**: LINE Developers Page Pointer、X Card Validator、Facebook Sharing Debuggerでエラーなく検証をパスする
- **SC-004**: プレビュー画像にはお絵かきの内容が認識可能な状態で含まれる（手動の目視確認で判定）
- **SC-005**: OGPメタタグを含むHTMLの応答時間は1秒以内である

## Assumptions

- LINE、X、FacebookのOGP/Twitterカード仕様は標準的な実装で対応可能
- プレビュー画像は共有ボタンクリック時に生成し、静的にホスティング可能
- クローラーはJavaScriptを実行しないため、サーバーサイドでのメタタグ生成が必要
- 既存の共有位置（share_lat, share_lng, share_zoom）データを活用可能
- 逆ジオコーディングにはOpenStreetMap Nominatimを使用（利用規約に従い適切なUser-Agent設定、リクエスト頻度制限を遵守）

## Clarifications

### Session 2026-01-04

- Q: プレビュー画像の生成タイミングは？ → A: 共有ボタンクリック時に生成（共有時のみ生成、最新を保証）
- Q: OGPタイトル・説明文の内容は？ → A: 位置情報から自動生成（例：「渋谷周辺のお絵かきマップ」）
- Q: トップページのOGP対応は？ → A: 対応する（アプリ紹介用の固定OGPメタタグを設定）
- Q: 位置情報からの地名取得方法は？ → A: OpenStreetMap Nominatim（無料、利用規約遵守で利用）
