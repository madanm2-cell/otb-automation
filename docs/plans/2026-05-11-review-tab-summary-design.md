---
date: 2026-05-11
topic: Review Tab Plan Summary
status: approved
---

# Review Tab Plan Summary

## Problem
The Review tab only shows approval status cards and action buttons. Stakeholders have no data basis to approve or request revision.

## Design

### Layout (top to bottom)
1. **KPI tiles** — GMV, NSV, NSQ, Inwards, DoH, Closing Stock (compact, same as dashboard)
2. **Monthly breakdown table** — one row per quarter month, same columns as KPI tiles
3. **Top sub-categories table** — sub-category, GMV, NSQ, Inwards, GMV share %
4. **Approval panel** — existing component unchanged

### Data layer
New `GET /api/cycles/[cycleId]/summary` endpoint.

Aggregates from `otb_plan_rows` + `otb_plan_data`:
- KPI totals (sum GMV/NSV/NSQ/inwards_qty/closing_stock_qty, weighted avg DoH)
- Monthly breakdown (group by month)
- Top categories (group by sub_category, ordered by GMV desc, limit 10)

Returns shape matching `EnhancedBrandSummary` fields (gmv, nsv, nsq, inwards_qty, avg_doh, closing_stock_qty, monthly[], top_categories[]).

### Component
`ReviewSummary` — new component in `src/components/cycle-workspace/`. Fetches `/api/cycles/[cycleId]/summary` on mount. Shows skeleton while loading, graceful error state. Inserted above `ApprovalPanel` in `ReviewTabContent`.

### Auth
Uses existing `withAuth(null, ...)` — any authenticated user can view (same as the cycle detail endpoint).
