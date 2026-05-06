# Executive Dashboard Zones Redesign — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Approved Plans and Actuals vs Plan zones on the Executive Dashboard so they are distinct, correctly labelled, and genuinely useful for a CXO audience.

**Problems being solved:**
1. "Approved Plans" and "Actuals vs Plan" show identical data when no actuals are uploaded — confusing and redundant.
2. Top sub-categories section has unlabelled columns (values appear with no context).
3. The Actuals vs Plan collapsed header shows plan metrics instead of variance metrics.

**Architecture:** Minimal — one new API field (`has_actuals`), one new type field (`inwards_qty` on `CategoryBreakdown`), targeted changes to `BrandPanel` and `TopCategories`, and conditional rendering in `page.tsx`. No new routes, no new DB queries beyond what is already fetched.

**Tech Stack:** Next.js App Router, TypeScript, Ant Design 6, Supabase

---

## Design

### 1. Data changes

**`CategoryBreakdown` type** (`src/types/otb.ts`):
Add `inwards_qty: number` alongside the existing `gmv` and `nsq` fields.

**`EnhancedBrandSummary` type** (`src/types/otb.ts`):
Add `has_actuals: boolean`. Populated by the summary API.

**Summary API** (`src/app/api/summary/route.ts`):
- Track `inwards_qty` in `categoryData` aggregation (already fetched in `planData`, just not accumulated).
- After fetching cycles, run a single query: `SELECT cycle_id FROM otb_actuals WHERE cycle_id IN (...) LIMIT 1 per cycle` — or equivalently fetch distinct `cycle_id` values from `otb_actuals` for the current cycle set. Use this set to populate `has_actuals` on each brand summary.

---

### 2. Approved Plans zone — Top Sub-Categories fix

**Component:** `TopCategories` in `src/components/ui/BrandPanel.tsx`

**Changes:**
- Rename section title from "Top Sub-Categories" → **"Top Sub-Categories by GMV"**
- Replace the current unlabelled inline layout with a compact table:

| Sub-Category | GMV | NSQ | Inwards | GMV Share |
|---|---|---|---|---|
| Jeans | 8.2 Cr | 1,20,000 | 95,000 | 31.4% |
| T-Shirts | 6.1 Cr | 98,000 | 72,000 | 23.4% |

- Use Ant Design `Table` (already used in `MonthlyTable`) with `size="small"`, `pagination={false}`.
- Columns: Sub-Category, GMV (`formatCrore`), NSQ (`formatQty`), Inwards (`formatQty`), GMV Share (`pct_of_total.toFixed(1) + '%'`).

---

### 3. Actuals vs Plan zone — Conditional rendering

**Component:** `src/app/page.tsx`

**Visibility rule:** The entire "Actuals vs Plan" section only renders when at least one brand in `approvedBrands` has `has_actuals === true`. When the condition is false, the section is hidden entirely — no empty state, no heading.

**Per-cycle rendering (two cases):**

**Case A — cycle has actuals** (`brand.has_actuals === true`):
Render a full `BrandPanel` with `zone="variance"`. The collapsed header shows variance metrics (see §4). Expandable.

**Case B — cycle has no actuals** (`brand.has_actuals === false`):
Render a slim non-expandable row showing brand name, quarter, and muted text "Actuals not yet uploaded". Same card style as `BrandPanel` for visual consistency, but no chevron and no expand behaviour.

---

### 4. Actuals vs Plan zone — Variance BrandPanel

**Collapsed header** (replaces plan metrics for `zone="variance"`):

Show four variance metric badges inline — GMV, NSV, NSQ, Inwards — each as `±X.X%` with a colour dot:
- Green: within threshold (GMV/NSV/NSQ ±15%, Inwards ±20%)
- Amber: between threshold and 2×threshold
- Red: beyond 2×threshold

Variance % computed client-side from `VarianceReportData.rows`:
```
planned_total = sum(row.gmv.planned) across all rows
actual_total  = sum(row.gmv.actual)  across all rows
variance_pct  = (actual_total - planned_total) / planned_total * 100
```
Same logic for NSV, NSQ, Inwards.

When `variance` is `null` (not yet lazy-loaded): show a subtle loading skeleton in place of the badges.

**Expanded body** (replaces monthly table for `zone="variance"`):

- **RAG summary row**: "🔴 12 red · 🟡 8 amber · 🟢 45 green" — total row counts from `variance.summary`.
- **Top variances table**: existing data from `variance.summary.top_variances` — sub-brand, sub-category, channel, month, metric, planned, actual, variance %.
- No monthly breakdown table (that belongs in Approved Plans, not here).

---

### 5. Files changed

| File | Change |
|---|---|
| `src/types/otb.ts` | Add `inwards_qty` to `CategoryBreakdown`; add `has_actuals` to `EnhancedBrandSummary` |
| `src/app/api/summary/route.ts` | Accumulate `inwards_qty` in `categoryData`; query `otb_actuals` to populate `has_actuals` |
| `src/components/ui/BrandPanel.tsx` | Rewrite `TopCategories`; add variance collapsed header; add variance expanded body; add slim no-actuals row |
| `src/app/page.tsx` | Conditionalize Actuals vs Plan section; render slim row for cycles without actuals |
