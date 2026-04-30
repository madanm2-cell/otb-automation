# Inwards Suggestion from Standard DoH — Design

**Date:** 2026-04-30  
**Status:** Approved

## Problem

GDs currently enter Inwards Qty manually with no guidance. The Standard DoH reference value exists in the grid but is disconnected from the Inwards field. This leads to inconsistent plans and extra back-and-forth during review.

## Solution

Auto-suggest Inwards Qty whenever NSQ is non-zero, using Standard DoH and next month's demand. GD must explicitly accept suggestions (per cell or all at once). Formula calculations always use actual `inwards_qty` only.

---

## Section 1 — Suggestion Formula

```
NextDemand = next month NSQ   (if already entered, non-null and non-zero)
             else current month NSQ   (fallback, including last month of quarter)

Suggested Inwards = max(0, round(Standard_DoH × NextDemand / 30 − Opening_Stock_Qty + NSQ))
```

**Trigger conditions:**
- NSQ changes to a non-zero, non-null value
- AND `inwards_qty` is currently null or 0

If `inwards_qty` is already non-zero (GD has entered or accepted a value), NSQ changes do not overwrite it. A new suggestion is still computed and shown so the GD can see what the updated recommendation would be.

**Last month of quarter:** No next month exists — always uses current month NSQ as proxy.

---

## Section 2 — Data Layer

### DB Migration
Add one column to `otb_plan_data`:
```sql
ALTER TABLE otb_plan_data ADD COLUMN inwards_qty_suggested NUMERIC;
```

### Write Path
- Computed client-side whenever NSQ changes and suggestion trigger conditions are met
- Included in the `bulk-update` API save payload alongside `nsq` and `inwards_qty`
- Server writes it to `otb_plan_data.inwards_qty_suggested`
- Formula engine (`calculateAll`) is unchanged — only reads `inwards_qty`

### Read Path
- Grid page fetches `inwards_qty_suggested` as part of existing plan data fetch (already selects `*`)
- Export reads it from DB for the Suggested Inwards column

---

## Section 3 — Grid UX

### Client State
```ts
pendingSuggestions: Map<`${rowId}|${month}`, number>
```
Populated in `handleCellValueChanged` when NSQ changes and `inwards_qty` is null/0. Cleared per-cell on accept or manual override.

### Inwards Cell Renderer
Custom AG Grid `cellRenderer` for Inwards columns:
- **Suggestion pending:** show suggested value in muted italic + inline ✓ accept button
- **No suggestion:** normal editable cell (no change to current behaviour)
- **GD types a value:** clears suggestion from map, value written as `inwards_qty`

### Accept All Button
- Shown in toolbar only when `pendingSuggestions.size > 0`
- Label: `Accept Suggestions (N)`
- On click: calls `handleBulkApply` with all pending suggestions as `inwards_qty` changes, then clears the map

### Formula Behaviour
Closing Stock and Forward DoH always use `inwards_qty`. While a suggestion is pending (not accepted), these fields show `−` for that cell — correct, since inwards hasn't been committed.

---

## Section 4 — Export

### Excel
- New **"Suggested Inwards"** column per month in the OTB Plan sheet
- Placed immediately after the "Inwards Qty" column
- Read from `inwards_qty_suggested`; blank if null

### CSV
- Same additional column, same placement

---

## Files Affected

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: add `inwards_qty_suggested` to `otb_plan_data` |
| `src/lib/formulaEngine.ts` | Add `calcSuggestedInwards(nsq, nextNsq, standardDoh, opening)` helper |
| `src/hooks/useFormulaEngine.ts` | Call suggestion helper on NSQ change; populate `pendingSuggestions` |
| `src/app/cycles/[cycleId]/grid/page.tsx` | Add `pendingSuggestions` state; "Accept All" button; pass to OtbGrid |
| `src/components/OtbGrid.tsx` | Accept `pendingSuggestions` prop; wire custom cell renderer to Inwards cols |
| `src/components/InwardsCellRenderer.tsx` | New: renders suggestion hint + ✓ button or normal cell |
| `src/app/api/cycles/[cycleId]/plan-data/bulk-update/route.ts` | Accept and write `inwards_qty_suggested` in save payload |
| `src/lib/exportEngine.ts` | Add Suggested Inwards column to Excel/CSV output |
| `src/types/otb.ts` | Add `inwards_qty_suggested` to `PlanMonthData`; add `BulkUpdateItem` field |
