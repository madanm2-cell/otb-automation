# Variance Report Redesign — Design Doc

**Date:** 2026-05-08  
**Status:** Approved

## Problem

The existing variance report (`/cycles/[cycleId]/variance`) shows row-count-based summary cards (Within Threshold / Near Threshold / Exceeds Threshold). These are not meaningful to a CXO reviewing the brand's monthly performance. The CXO needs to understand:

1. **Sales achievement** — is GMV/NSV/NSQ tracking to plan?
2. **Working capital exposure** — is inventory (Inwards, Closing Stock, DOH) within plan?

Additionally, thresholds are hardcoded constants in `src/types/otb.ts`, making them impossible to configure per brand without a code change.

---

## Goals

- Redesign the variance report page as a CXO-facing monthly review tool
- Show Plan / Actual / Var% per metric in crores/units/days (not just % row counts)
- Make variance thresholds configurable per brand per metric via an admin UI
- Support direction-aware RAG coloring (over-plan is good for sales, bad for inventory)

---

## Out of Scope

- Cross-brand variance dashboard
- PDF export (removed)
- Per-cycle threshold overrides

---

## Page Structure

**Route:** `/cycles/[cycleId]/variance` (unchanged)

**Tabs (left to right):**
```
[ Summary ]  [ GMV ]  [ NSV ]  [ NSQ ]  [ Inwards ]  [ Closing Stock ]  [ DOH ]
```

Summary is the default tab. Export Excel button stays at top right.  
Existing row-count summary cards (green/yellow/red counts) are removed.

---

## Summary Tab

### Brand-Level KPI Grid

A compact table — metrics as rows, periods as columns.

**Columns:** Sub-Category | Apr Plan | Apr Actual | Apr Var% | May Plan | May Actual | May Var% | Jun Plan | Jun Actual | Jun Var% | Q-Total (Actuals to date)

**Rows:** One row per metric: GMV (₹ Cr) | NSV (₹ Cr) | NSQ (Units) | Inwards (₹ Cr) | Closing Stock (₹ Cr) | DOH (Days)

**Q-Total column:**
- Populates as soon as ≥1 month has actuals (running cumulative, not gated on all 3 months)
- Labelled *"Q1 to date (N of 3 months)"* so incompleteness is clear
- Updates automatically as each month's actuals are uploaded

**Months with no actuals:** Actual and Var% cells show `—` with no color. Plan value is always shown.

**Var% coloring** (direction-aware):
- GMV, NSV, NSQ: positive variance (actual > plan) = green; negative = red
- Inwards, Closing Stock, DOH: positive variance = red; negative = green
- Threshold determines intensity: within threshold = light shade; beyond threshold = full color

### Sub-Category Breakdown

- Collapsible section below the KPI grid (collapsed by default)
- Same metric-as-rows structure, broken out by sub-category
- **Sorted by highest GMV descending** (actual GMV where available, else planned GMV)
- A Channel filter dropdown lets the CXO filter to a specific channel; the grid re-aggregates

---

## Metric Drill-Down Tabs (GMV, NSV, NSQ, Inwards, Closing Stock, DOH)

Each metric tab shows a single table.

**Columns:**
```
Sub-Category | Apr Plan | Apr Actual | Apr Var% | May Plan | May Actual | May Var% | Jun Plan | Jun Actual | Jun Var% | Q-Total Plan | Q-Total Actual | Q-Total Var%
```

**Rows:**
- First row = Brand Total (bold, pinned at top) — aggregate across all sub-categories
- Remaining rows = one per sub-category, sorted by highest GMV descending (consistent across all tabs)

**Channel filter** at top of each tab — filters and re-aggregates the table.

**Cell coloring:** Var% cells only. Direction-aware per metric (same logic as Summary tab). Months with no actuals show `—`.

**Formatting:**
- GMV, NSV, Inwards, Closing Stock → ₹ Crores (2 decimal places)
- NSQ → integer units
- DOH → 1 decimal place, days

---

## Threshold Configuration

### Database

New table `brand_variance_thresholds`:

```sql
CREATE TABLE brand_variance_thresholds (
  brand_id        uuid REFERENCES brands(id),
  metric          text CHECK (metric IN ('gmv_pct','nsv_pct','nsq_pct','inwards_pct','closing_stock_pct','doh_pct')),
  threshold_pct   numeric NOT NULL,
  updated_by      uuid REFERENCES auth.users(id),
  updated_at      timestamptz DEFAULT now(),
  PRIMARY KEY (brand_id, metric)
);
```

### Fallback

If no DB record exists for a brand/metric pair, the variance engine falls back to `DEFAULT_VARIANCE_THRESHOLDS` (existing hardcoded values).

### Admin UI

New "Variance Thresholds" section added to `/admin/master-data` page.

- One row per metric, one column per brand (or brand selector for large brand lists)
- Inline editable number inputs (threshold_pct value)
- Save button per row
- Follows existing brand-scoped RBAC:
  - Admin → can edit any brand
  - Planning → can only edit their assigned brands

### API

- `GET /api/admin/variance-thresholds?brandId=X` — fetch thresholds for a brand
- `PUT /api/admin/variance-thresholds` — upsert one or more threshold rows

### How the Variance Report Uses Thresholds

`GET /api/cycles/[cycleId]/variance` fetches thresholds for the cycle's brand at load time. These are passed into `buildVarianceMetric()` replacing the hardcoded `DEFAULT_VARIANCE_THRESHOLDS`.

---

## Direction-Aware Variance Classification

Current `classifyVariance()` uses `Math.abs(variancePct)` — direction is lost. New logic:

```typescript
type MetricDirection = 'higher_is_good' | 'lower_is_good';

const METRIC_DIRECTIONS: Record<string, MetricDirection> = {
  gmv_pct: 'higher_is_good',
  nsv_pct: 'higher_is_good',
  nsq_pct: 'higher_is_good',
  inwards_pct: 'lower_is_good',
  closing_stock_pct: 'lower_is_good',
  doh_pct: 'lower_is_good',
};

// variance > 0 is good when higher_is_good → green
// variance > 0 is bad when lower_is_good → red
// threshold determines light vs full color intensity
```

`VarianceLevel` type gains a direction dimension: `green | yellow | red` remain but their assignment flips based on `MetricDirection`.

---

## Affected Files

### New
- `supabase/migrations/009_brand_variance_thresholds.sql`
- `src/app/api/admin/variance-thresholds/route.ts`
- `src/components/VarianceThresholdsAdmin.tsx`

### Modified
- `src/types/otb.ts` — add `MetricDirection`, `BrandVarianceThreshold`, update `VarianceThresholds`
- `src/lib/varianceEngine.ts` — direction-aware `classifyVariance()`, accept per-brand thresholds
- `src/app/api/cycles/[cycleId]/variance/route.ts` — fetch brand thresholds, pass to engine; add Q-total aggregation
- `src/components/VarianceReport.tsx` — full redesign: 7-tab layout, Summary grid, metric drill-down tables, channel filter
- `src/app/admin/master-data/page.tsx` — add Variance Thresholds section
- `src/app/api/cycles/[cycleId]/variance/export/route.ts` — remove PDF export, update Excel to new structure
