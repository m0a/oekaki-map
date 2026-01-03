# Research: 地図お絵かき共有サービス

**Date**: 2026-01-02
**Status**: Complete

## Technology Decisions

### 1. Map Library: Leaflet

**Decision**: Leaflet 1.9.x

**Rationale**:
- Lightweight (~42KB gzipped)
- Excellent touch support for mobile
- Simple API, low learning curve
- Large ecosystem of plugins
- Works well with OpenStreetMap tiles
- CSS filter for grayscale is straightforward

**Alternatives Considered**:
| Library | Pros | Cons | Why Not |
|---------|------|------|---------|
| MapLibre GL JS | Vector tiles, 60fps | Heavier, complex setup | Overkill for this use case |
| OpenLayers | Feature-rich | Heavy, steep learning curve | Too complex for simple drawing |
| Google Maps | Popular | API key required, costs | Constitution requires OSM |

### 2. Drawing on Map: HTML5 Canvas Overlay

**Decision**: Separate Canvas element overlaid on Leaflet map

**Rationale**:
- Leaflet's map container has drawing events
- Canvas overlay captures pointer events in draw mode
- Map events pass through in navigation mode
- Tile-based export: capture canvas regions as WebP

**Implementation Pattern**:
```
┌─────────────────────────────┐
│     Toolbar (z-index: 3)    │
├─────────────────────────────┤
│  Drawing Canvas (z-index: 2)│  ← Pointer events in draw mode
├─────────────────────────────┤
│  Leaflet Map (z-index: 1)   │  ← Pointer events in nav mode
└─────────────────────────────┘
```

### 3. Tile Coordinate System

**Decision**: Use Leaflet's tile coordinate system (XYZ)

**Rationale**:
- Matches OSM tile numbering
- Easy to calculate tile bounds from lat/lng
- Natural alignment with map tiles
- Standard formula: `x = floor((lon + 180) / 360 * 2^zoom)`

**Tile Storage Key Format**:
```
{canvasId}/{z}/{x}/{y}.webp
```

### 4. Canvas ID Generation

**Decision**: nanoid (URL-safe, 21 characters)

**Rationale**:
- Collision-resistant without coordination
- URL-safe characters only
- Short enough for sharing
- No sequential IDs (prevents enumeration)

**Example URL**: `https://oekaki-map.example.com/c/V1StGXR8_Z5jdHi6B-myT`

### 5. WebP Conversion

**Decision**: Client-side Canvas.toBlob() with WebP format

**Rationale**:
- Modern browsers support WebP export
- Reduces server load
- Smaller file size than PNG (~30% smaller)
- Good quality at 0.8 compression

**Fallback**: PNG for browsers without WebP support (rare in 2026)

### 6. Undo/Redo Implementation

**Decision**: Command pattern with stroke history

**Rationale**:
- Each stroke is a command object
- Undo: pop from history, redraw remaining
- Redo: push back to history, redraw
- Limit history to 50 operations (memory constraint)

**Note**: Undo/Redo is local-only (not synced to server until save)

### 7. Mode Switching (Draw vs Navigate)

**Decision**: Toggle button with visual indicator

**Rationale**:
- Simple binary state
- Draw mode: canvas captures events, map is locked
- Navigate mode: events pass through to map
- Floating toggle button, always visible

**Mobile UX**: Two-finger gesture always navigates (industry standard)

### 8. Grayscale Map Implementation

**Decision**: CSS filter on Leaflet tile layer

**Rationale**:
- Single line of CSS
- No tile server dependency
- Adjustable opacity if needed

**CSS**:
```css
.leaflet-tile-pane {
  filter: grayscale(100%);
}
```

### 9. Auto-save Strategy

**Decision**: Debounced save on stroke complete (500ms delay)

**Rationale**:
- Save after user stops drawing
- Debounce prevents excessive API calls
- Visual indicator shows save status
- Retry on failure

**Save Flow**:
1. User completes stroke → add to local history
2. Start 500ms debounce timer
3. On timer: calculate affected tiles
4. Convert each tile to WebP blob
5. Upload tiles + update canvas metadata

### 10. Offline Support (Future Consideration)

**Decision**: Out of scope for MVP, but architecture supports it

**Future Implementation Path**:
- Service Worker for caching map tiles
- IndexedDB for local stroke history
- Sync queue for offline changes
- Constitution mentions PWA as SHOULD (not MUST)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large canvas slow to render | Medium | High | Limit visible tiles, lazy load |
| WebP not supported | Low | Low | PNG fallback |
| Concurrent edit conflicts | Medium | Medium | Last-write-wins (documented) |
| Mobile touch conflicts | Medium | Medium | Clear mode indicator, 2-finger nav |
| R2 storage costs | Low | Low | Max tile limits per canvas |

## Open Questions (Resolved)

1. ~~How to handle zoom levels for tiles?~~
   → Store at current zoom level, show only at matching zoom

2. ~~What happens to drawings when map zooms?~~
   → Drawings visible only at their creation zoom level (MVP simplicity)

3. ~~How to detect which tiles need saving?~~
   → Track dirty tiles during stroke, save only affected ones
