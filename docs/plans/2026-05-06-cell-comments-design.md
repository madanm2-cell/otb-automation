# Cell-Level Comments Design

**Date:** 2026-05-06  
**Feature:** GSheets-style cell comments on the OTB grid

---

## Overview

Add Google Sheets-style comments to the OTB grid. Users can right-click any cell to add a comment anchored to that specific row × month × field. Cells with comments show a small triangle indicator in the top-right corner. Clicking the triangle opens a popover with the comment thread.

Also removes the redundant `brand` comment type (collapsed into `general`).

---

## Roles

Can add cell comments: **Admin, Planning, GD, Finance, CXO**  
Cannot add (read-only): **ReadOnly**

---

## Architecture

Three new pieces, all self-contained:

1. **Comment index map** — fetch all `metric` comments for the cycle on grid load. Build `Map<"rowId|month|field", OtbComment[]>` in the grid page, passed as a prop to `OtbGrid`.
2. **CSS triangle** — `cellClassRules` applies `.has-comment` class to AG Grid cells that have entries in the map. A CSS `::after` rule draws the amber triangle (no `cellRenderer` needed on all columns).
3. **Two new components** — `CellContextMenu` (right-click menu) and `CellCommentPopover` (anchored thread + compose), both rendered via React portal.

The existing `CommentsPanel` drawer is untouched. Metric comments posted via the cell popover also appear in the panel's full list.

---

## Data Flow

```
Grid page mounts
  → GET /api/cycles/:cycleId/comments (existing endpoint)
  → filter metric comments → build commentMap
  → pass commentMap + refreshComments() to OtbGrid

OtbGrid receives commentMap
  → cellClassRules applies 'has-comment' to matching cells
  → triangle appears via CSS ::after

User right-clicks a cell
  → onCellContextMenu fires
  → parse rowId (params.data.id), month (field prefix), field (field suffix)
  → if role can comment: show CellContextMenu at (clientX, clientY)

User clicks "Add comment"
  → CellContextMenu closes
  → CellCommentPopover opens at cell's getBoundingClientRect
  → shows existing thread for (rowId, month, field)
  → POST /api/cycles/:cycleId/comments → refreshComments() → triangle appears

User clicks existing triangle
  → same CellCommentPopover opens (read + reply)
```

No new API endpoints needed.

---

## Components

### `CellContextMenu` (new)
- `div` portal positioned at `(clientX, clientY)`
- Single item: "Add comment"
- Closes on outside `mousedown` or Escape
- Props: `x, y, onAddComment, onClose`

### `CellCommentPopover` (new)
- Portal positioned at target cell's `getBoundingClientRect` (top-right corner)
- Compact comment thread: author name, role tag, text, relative timestamp
- Compose box (TextArea + Post button) at bottom; hidden for ReadOnly role
- Closes on outside click or Escape
- Props: `cycleId, rowId, month, field, comments, onClose, onCommentAdded`

### `OtbGrid` changes
- New prop: `commentMap: Map<string, OtbComment[]>`
- `cellClassRules` on all column defs: `{ 'has-comment': p => commentMap.has(buildCellKey(p)) }`
- `onCellContextMenu`: parses cell identity → shows `CellContextMenu`
- Click handler: detects click in top-right 10×10px of `.has-comment` cell → opens popover
- `buildCellKey(rowId, month, field)` pure helper: `"${rowId}|${month}|${field}"`

### Grid page changes
- Fetch comments alongside plan data on mount
- `useMemo` derives `commentMap` from metric-type comments
- Passes `commentMap` + `refreshComments` into `OtbGrid`

### CSS
```css
.ag-cell.has-comment {
  position: relative;
}
.ag-cell.has-comment::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  border: 6px solid transparent;
  border-top-color: #faad14;
  border-right-color: #faad14;
  pointer-events: none;
}
```

---

## `brand` Comment Type Removal

`brand` comments are redundant — cycles are already brand-scoped, making them identical to `general` comments with a different label.

**Changes:**
- New DB migration: update `comments.comment_type` check constraint to `('general', 'metric')`, migrate existing `brand` rows → `general`
- `CommentType` TypeScript union: `'general' | 'metric'`
- Remove `brand` option from `CommentsPanel` dropdown
- Update API validation in `comments/route.ts`

---

## Error Handling

- Comment fetch failure: silent (grid still loads; triangles just don't appear — non-critical path)
- Comment post failure: `message.error()` in the popover, compose box stays open
- Cell key parse failure (malformed field name): no context menu shown, no crash
- Portal positioning: if cell rect is near viewport edge, popover uses CSS `max-height` + scroll rather than flipping

---

## Testing

- Unit: `buildCellKey` helper — correct key format, edge cases (null rowId)
- Unit: comment map derivation — filters correctly to `metric` type only
- Integration: POST with `comment_type: 'metric'`, `month`, `field` → 201; without `month`/`field` → 400
- Integration: POST with `comment_type: 'brand'` → 400 (after migration)
- E2E: right-click cell → context menu appears → "Add comment" → popover opens → post → triangle appears on cell
