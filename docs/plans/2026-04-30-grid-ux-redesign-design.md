# OTB Grid UX Redesign — Design

**Date:** 2026-04-30
**Status:** Approved

## Problem

The OTB grid currently shows all 3 months side by side, resulting in 51+ data columns visible simultaneously. There is no visual distinction between editable, reference, and calculated columns beyond the header group label text. GDs find it visually cluttered and cannot tell at a glance what they can and cannot edit.

## Solution

Month tabs isolate one month at a time (matching the GD's one-month-at-a-time workflow), reducing the visible column count from 51 to 17. Color coding on column group headers and cell backgrounds makes editability visually obvious without reading labels.

---

## Section 1 — Month Tabs

Ant Design `Tabs` rendered inside `OtbGrid`, above the AG Grid, below the existing toolbar.

- **Labels:** Short month format — "Apr 26", "May 26", "Jun 26"
- **Default:** First month active on load
- **Badge:** Each tab shows a dot/count if there are pending suggestions for that month
- **Switching:** Instant — no data re-fetch. `activeMonth` state lives inside `OtbGrid`. Only `columnDefs` changes; the full flat row data is already loaded. Filters and sort carry over across tab switches.
- **Always visible:** The 5 pinned dimension columns (Sub Brand, Sub Category, Wear Type, Gender, Channel) and the Recent Sales (3M) collapsed group are always shown regardless of active tab.
- **Header hierarchy:** Simplifies from 3 levels (Month → Section → Column) to 2 levels (Section → Column), since the tab already identifies the month.

---

## Section 2 — Color Coding

Applied to both the column group header background and the cell background:

| Section | Group header bg | Cell bg | Header text color | Meaning |
|---|---|---|---|---|
| **Reference** | `#f0f0f0` | `#fafafa` | `#595959` (dark gray) | Read-only context data |
| **GD Inputs** | `#e6f4ff` | `#ffffff` | `#0958d9` (blue) | Editable — where the GD works |
| **Calculated** | `#f6ffed` | `#f9fff6` | `#389e0d` (green) | Auto-computed, read-only |

Additional editable affordance on GD Input cells:
- Text/pointer cursor on hover
- Blue focus ring on click (AG Grid default focus style, no extra code needed)

---

## Section 3 — Column Layout Per Tab

17 columns per active month tab. No columns removed.

**Reference** (5 cols):
`Op. Stock` · `ASP` · `COGS` · `LY NSQ` · `Std DoH`

**GD Inputs** (3 cols):
`NSQ` · `Inwards` · `Sugg. Inwards`

`Sugg. Inwards` stays in GD Inputs (not Reference) — it is part of the GD's active decision workflow (accept or override), not static reference data.

**Calculated** (9 cols):
`GMV` · `GOLY%` · `NSV` · `Inw Val` · `Op. Stock Val` · `Cl. Stock` · `Fwd DoH` · `GM%` · `Gross Margin`

---

## Section 4 — Behavior

- **Save Draft / Undo / Redo / Accept Suggestions:** All operate across all months regardless of which tab is active.
- **"Accept Suggestions (N)" count:** Total across all months — not filtered to active tab.
- **Pending suggestion badge on tabs:** Count of `pendingSuggestions` entries for that month — helps GD see which months still need attention.
- **Bulk Edit:** Operates on filtered rows across all months (no change to existing behavior).
- **Filters / sort:** Carry over when switching tabs (same rows, different column set).
- **Scroll position:** Resets on tab switch (different column layout).

---

## Files Affected

| File | Change |
|---|---|
| `src/components/OtbGrid.tsx` | Add `activeMonth` state + Ant Design `Tabs`; build `columnDefs` for active month only; apply color coding via `headerClass` and `cellStyle` |
