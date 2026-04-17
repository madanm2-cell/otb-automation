# Executive Dashboard Redesign — Merge Cross-Brand Summary

## Context

The Executive Dashboard (`/`) and Cross-Brand Summary (`/summary`) serve the same CXO audience with overlapping data from the same API. CXOs need a single view organized around their workflow: review submitted plans, see committed numbers, track actuals. The cross-brand summary as a separate page adds no value — the drill-down should be brand-level, not cross-brand.

## Decision

Merge Cross-Brand Summary into the Executive Dashboard. Remove `/summary` as a separate page. Redesign the dashboard as a three-zone layout matching CXO workflow.

## Design

### Top KPI Row

6 MetricCards showing aggregates from **Approved cycles only**:

| Metric | Field |
|--------|-------|
| GMV | `sales_plan_gmv` |
| NSV | `nsv` |
| Total NSQ | `nsq` |
| Total Inwards | `inwards_qty` |
| Avg DoH | `fwd_30day_doh` |
| Total Closing Stock | `closing_stock_qty` |

If no approved cycles exist, show dashes with "No approved plans yet" note.

### Zone 1 — Pending Review

Cycles with status `InReview`. Section header with count badge.

**Collapsed card per brand**: brand name, cycle name, quarter, approval pipeline dots, 6 metrics inline.

**Expanded**: monthly breakdown table (months × 6 metrics), top 5 sub-categories by GMV, approve/revision action buttons, approval status per role.

### Zone 2 — Approved Plans

Cycles with status `Approved`. Same card layout as Zone 1.

**Collapsed**: brand name, cycle, quarter, green Approved tag, 6 metrics inline.

**Expanded**: monthly breakdown table, top 5 sub-categories, link to OTB Grid. Read-only — no actions.

### Zone 3 — Actuals vs Plan

Approved cycles with actuals uploaded.

**Collapsed**: brand name, cycle, quarter, 6 variance badges (color-coded %), overall severity indicator.

**Expanded**: monthly Plan vs Actual table (Plan | Actual sub-columns per metric + variance badge), category variance ranking, link to full Variance Report page.

If no actuals uploaded, show "No actuals uploaded yet" message.

### Removed

- `/summary` page (`src/app/summary/page.tsx`)
- `CrossBrandSummary.tsx` component
- "Cross-Brand Summary" sidebar nav item

### API Changes

Enhance `/api/summary` to return:
- Per-brand monthly breakdown including GMV, NSQ, closing stock (currently missing)
- Per-brand top category breakdown (group by sub_category)
- Status filter param (for Approved-only KPI aggregation)

Variance data for Zone 3 fetched lazily per cycle on expand via existing `/api/cycles/[id]/variance`.

### Files Affected

**Modify**: `src/app/page.tsx`, `src/hooks/useDashboardData.ts`, `src/components/AppLayout.tsx`, `src/app/api/summary/route.ts`

**Delete**: `src/app/summary/page.tsx`, `src/components/CrossBrandSummary.tsx`

**New**: expandable brand panel component (e.g., `src/components/ui/BrandPanel.tsx`)
