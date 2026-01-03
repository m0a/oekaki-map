# Feature Specification: 地図お絵かき共有サービス (Map Drawing Share)

**Feature Branch**: `001-map-drawing-share`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "地図に対してお絵かきのように書き込めるWEBサービスです。アカウントの作成は不要でurlさえ共有すれば書き込んだお絵かきは共有できる"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 地図上にお絵かきする (Priority: P1)

ユーザーは地図上に自由にお絵かき（線、図形、テキストなど）を描くことができる。描いた内容は即座に保存され、URLとして共有可能になる。アカウント作成やログインは一切不要で、サイトにアクセスしたらすぐに描き始められる。

**Why this priority**: これがサービスの核となる機能。お絵かきができなければ、共有する意味がない。MVP として最も重要。

**Independent Test**: サイトにアクセスして地図上に線を描き、その描画が表示されることを確認する。

**Acceptance Scenarios**:

1. **Given** ユーザーがサイトにアクセスした状態, **When** 地図上でタッチ/マウスドラッグする, **Then** 描画された線が地図上に表示される
2. **Given** ユーザーが何も描いていない状態, **When** 描画ツールを選択してストロークを描く, **Then** 選択した色・太さで線が描かれる
3. **Given** ユーザーが描画中, **When** 描画を完了する（指を離す/マウスアップ）, **Then** 描画内容が自動的に保存され、共有用URLが生成される

---

### User Story 2 - URLで共有する (Priority: P2)

ユーザーは描いたお絵かきを他の人と共有できる。URLをコピーして送るだけで、相手は同じ地図とお絵かきを見ることができる。

**Why this priority**: 共有機能がないと個人的なメモ帳に過ぎない。共有によってこのサービスの価値が生まれる。

**Independent Test**: 描画後にURLをコピーし、別のブラウザ/デバイスでそのURLを開いて、同じ描画内容が表示されることを確認する。

**Acceptance Scenarios**:

1. **Given** ユーザーが地図上にお絵かきを描いた状態, **When** 共有ボタンをタップする, **Then** 共有用URLがクリップボードにコピーされる
2. **Given** 共有URLを受け取った人, **When** そのURLにアクセスする, **Then** 元のユーザーが描いたお絵かきと同じ地図位置が表示される
3. **Given** 共有URLにアクセスした人, **When** 新たにお絵かきを追加する, **Then** 追加した内容も保存され、同じURLで全員に共有される

---

### User Story 3 - 描画を編集・消去する (Priority: P3)

ユーザーは描いたお絵かきを消しゴムで消したり、元に戻したりできる。間違えても修正可能。

**Why this priority**: 描画だけでも最低限のサービスは成立するが、編集機能があることで実用性が大幅に向上する。

**Independent Test**: 描画後に消しゴムツールで一部を消去し、消去が反映されることを確認する。

**Acceptance Scenarios**:

1. **Given** ユーザーが描画を完了した状態, **When** 消しゴムツールを選択して描画部分をなぞる, **Then** なぞった部分の描画が消える
2. **Given** ユーザーが描画を行った直後, **When** 元に戻すボタンをタップする, **Then** 直前の描画操作が取り消される
3. **Given** ユーザーが元に戻す操作をした後, **When** やり直しボタンをタップする, **Then** 取り消した操作が復元される

---

### User Story 4 - 地図を操作する (Priority: P4)

ユーザーは地図をズーム、パン（移動）して、描きたい場所に移動できる。描画モードと地図操作モードを切り替えられる。

**Why this priority**: 地図の任意の場所にお絵かきするために必要。ただし、固定位置でも最低限のMVPは成立する。

**Independent Test**: 地図をピンチズームして拡大し、ドラッグして別の場所に移動できることを確認する。

**Acceptance Scenarios**:

1. **Given** ユーザーが地図を表示している状態, **When** ピンチイン/アウト操作をする, **Then** 地図がズームイン/アウトする
2. **Given** ユーザーが地図操作モードの状態, **When** 地図をドラッグする, **Then** 地図がパン（移動）する
3. **Given** ユーザーが描画モードの状態, **When** 地図をドラッグする, **Then** 線が描画される（地図は移動しない）

---

### Edge Cases

- 同時に複数人が同じURLで描画した場合、描画は後から来た内容で上書きされる（リアルタイム同期は初期スコープ外）
- キャンバスのタイル数が上限（1000枚）に達した場合、新しいタイルへの描画を制限する
- URLが存在しない（削除された/無効な）場合、新規キャンバスにリダイレクトしてエラーメッセージを表示
- オフライン時に描画した場合、オンライン復帰時に自動保存を試みる
- 地図タイルの読み込みに失敗した場合、再試行ボタンを表示

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display an interactive map without requiring user authentication
- **FR-002**: Users MUST be able to draw freehand lines on the map using touch or mouse input
- **FR-003**: System MUST automatically save drawing data when a stroke is completed
- **FR-004**: System MUST generate a unique shareable URL for each drawing canvas
- **FR-005**: Users MUST be able to copy the shareable URL with a single tap/click
- **FR-006**: System MUST load and display saved drawings when accessing a valid shareable URL
- **FR-007**: Users MUST be able to switch between drawing mode and map navigation mode
- **FR-008**: Users MUST be able to select drawing color from a predefined palette
- **FR-009**: Users MUST be able to select line thickness
- **FR-010**: Users MUST be able to erase drawn content using an eraser tool
- **FR-011**: Users MUST be able to undo the last drawing action
- **FR-012**: Users MUST be able to redo a previously undone action
- **FR-013**: System MUST support pinch-to-zoom and pan gestures for map navigation
- **FR-014**: System MUST persist drawings permanently (no automatic deletion)
- **FR-015**: System MUST work on mobile browsers (iOS Safari, Android Chrome) and desktop browsers
- **FR-016**: System MUST store drawing data as tile-based WebP images
- **FR-017**: System MUST only load drawing tiles that are visible in the current map view
- **FR-018**: System MUST display the map in grayscale to ensure drawings are clearly visible

### Key Entities

- **Canvas**: A shareable drawing surface tied to a unique URL. Contains map position (center, zoom level), creation timestamp, last modified timestamp, and references to drawing tiles.
- **Drawing Tile**: A small WebP image representing a portion of the drawing. Tiles are organized by map coordinates (x, y) and zoom level. Only tiles with actual drawings are stored (sparse storage).

## Assumptions

- Users have reliable internet connection for initial load and save operations
- Map tiles are provided by OpenStreetMap standard tile server
- Map library: Leaflet (lightweight, simple, good touch support)
- Map is displayed in grayscale using CSS filter to make drawings stand out
- Drawing data is stored as tile-based WebP images, aligned with map tile coordinates
- Each drawing tile is 256x256 pixels (matching standard map tile size)
- Only tiles containing actual drawings are stored (sparse storage for efficiency)
- Default map location is centered on Japan (since target users are Japanese speakers)
- Color palette includes at least 8 colors (black, red, blue, green, yellow, orange, purple, white)
- Line thickness options: thin (2px), medium (4px), thick (8px)
- Maximum tiles per canvas: 1000 tiles (to prevent abuse)
- Maximum file size per tile: 100KB WebP image

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can start drawing within 3 seconds of page load
- **SC-002**: Drawing feels responsive with no perceptible lag (stroke appears within 50ms of input)
- **SC-003**: Sharing a URL takes less than 2 taps/clicks
- **SC-004**: Shared URL loads the complete drawing within 5 seconds on 3G connection
- **SC-005**: 90% of users can complete their first drawing and share it without instructions
- **SC-006**: System supports 100 concurrent users drawing on different canvases
- **SC-007**: Drawing data persists correctly across page reloads and device switches
