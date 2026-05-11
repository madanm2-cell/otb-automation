# Executive Dashboard Rework — Design

**Date:** 2026-05-11
**Status:** Design approved; implementation plan to follow
**Scope:** `src/app/page.tsx` (Executive Dashboard) and supporting API/components

## Problem

The current dashboard has three structural issues:

1. **Misleading subtitle.** The KPI row carries an explanatory subtitle ("From approved cycle plans · not actuals") that doesn't belong on an executive dashboard.
2. **No quarter navigation.** Heading reads "Q1 FY27 Overview" but there is no way for a CXO to view past quarters or see how the full financial year is performing.
3. **Redundant zoning.** The page renders three vertical zones — *Pending Review*, *Approved Plans*, *Actuals vs Plan* — but a cycle is only ever in one state. An Approved cycle with actuals shows up in two zones today, duplicating its row.

The underlying data also currently merges multiple cycles per brand in the summary API (KPIs sum across quarters), which compounds the duplication problem.

## Goals

- Single-brand, single-quarter focus by default — the primary CXO read is "how is this quarter going for this brand".
- Add an **FY YTD** view as a peer scope so CXOs can see full-year performance.
- Collapse the three zones into one cycle row whose state badge carries the operational status.
- Honest plan-vs-actual comparisons even when actuals are partial (mid-quarter).

## Non-goals

- No "All Brands" rollup view. Brand selection is enforced via the existing brand-select flow and header switcher.
- No multi-cycle handling within a quarter (the data model already guarantees one cycle per brand-quarter).
- No approval actions from this dashboard. Approving happens on the cycle detail page.

## Design

### Page layout

```
┌──────────────────────────────────────────────────────────────┐
│  Executive Dashboard                              Bewakoof ⇄  │
│                                                               │
│  FY27 ▾   [ Q1 FY27 ][ Q2 FY27 ][ Q3 FY27 ][ Q4 FY27 ][ YTD ] │
│                                                               │
│  ── Planned Totals ───────────────────────────────────────── │
│  [ GMV card ] [ NSV card ] [ NSQ ] [ Inwards ] [ DoH ] [ CS ] │
│                                                               │
│  ── Cycles ──────────────────────────────────────────────── │
│  ▸ Bewakoof Q1 FY27   Approved   3/3 approved   Open Cycle → │
└──────────────────────────────────────────────────────────────┘
```

- Brand pill stays in the header (existing behavior).
- Time-scope selector is a tab strip with an FY-year dropdown on its left. Tabs always render — four quarters of the FY plus an "FY YTD" tab.
- Default tab = the quarter containing today's date.
- URL captures active scope (`?scope=Q1-FY27` or `?scope=FY27-YTD`) for bookmarking.
- The three-zone layout (Pending Review / Approved Plans / Actuals vs Plan) is removed entirely.

### KPI card

Six cards per scope: **GMV, NSV, NSQ, Inwards, DoH, Closing Stock**. Section header reads *"Planned Totals"* for a quarter tab or *"FY27 Year to Date"* for the YTD tab. No subtitle.

**No actuals yet:**
```
┌─────────────────────────┐
│ GMV                     │
│ 29.93 Cr                │
│ Planned                 │
└─────────────────────────┘
```

**Partial or full actuals available:**
```
┌─────────────────────────┐
│ GMV                     │
│ −8.4%                   │   ← headline variance, color-coded
│ Plan 9.5 · Actual 8.7   │   ← comparable window
│ Through Apr · May–Jun   │
│ pending                 │
└─────────────────────────┘
```

Rules:

- Variance is always computed against **plan-to-date** — the plan for whichever months have actuals — never against full-quarter plan. This is the apples-to-apples read.
- Subtitle disambiguates the window. When the quarter is complete it reads "Q1 FY27 complete"; for the FY YTD tab it reflects elapsed months across quarters (e.g. "Through May · Q1 complete, Q2 partial").
- Variance color uses per-brand thresholds from `brand_variance_thresholds` (existing) and direction from `METRIC_DIRECTIONS` (existing — DoH/Closing Stock are higher-is-worse).
- When no actuals exist for the selected scope, cards degrade to planned-only.

### Cycle row

A single slim row under the KPI cards, on quarter tabs only. With single-brand + single-quarter scope the row is always 0 or 1 — the data model guarantees one cycle per brand-quarter.

```
▸ Bewakoof Q1 FY27   [Approved]                    Open Cycle →
▸ Bewakoof Q1 FY27   [InReview]   2/3 approved     Open Cycle →
```

Contents:
- Cycle name
- Status badge (Approved / InReview / Filling / Draft)
- Approval progress — only when InReview ("2/3 approved")
- "Open Cycle →" link to existing `/cycles/[cycleId]` page

Empty state:
```
No cycle yet for Q3 FY27.
```

What's deliberately absent: last-updated timestamp, Approve button, inline KPI numbers, expand/collapse.

The FY YTD tab does not show this section — it's a performance view, not a cycle-operations view.

### FY YTD view

```
┌──────────────────────────────────────────────────────────────┐
│  ── FY27 Year to Date ─────────────────────────────────────  │
│  [ GMV ] [ NSV ] [ NSQ ] [ Inwards ] [ DoH ] [ CS ]          │
│  Through Apr · Q1 partial                                     │
│                                                               │
│  ── Quarterly breakdown ─────────────────────────────────── │
│             │   Q1 FY27   │   Q2 FY27   │   Q3 FY27   │  Q4   │
│  GMV        │ 9.5 / 8.7   │     —       │     —       │   —   │
│             │   −8.4%     │             │             │       │
│  NSV        │ 7.4 / 6.8   │     —       │     —       │   —   │
│             │   −8.1%     │             │             │       │
│  ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

- Top: same six KPI cards, same partial-window logic. Window is "elapsed months of the FY"; variance is YTD plan-to-date vs YTD actual-to-date.
- Bottom: a metrics-by-quarter table. Each cell shows `plan / actual` with variance % below, color-coded. Future quarters render as "—".
- A monthly trend chart (line chart, plan + actual series over Apr→Mar) is **deferred** to a follow-up — the table covers the primary CXO need.

## Data flow

**Quarter tab fetch.** Continue using `/api/summary?scope=Q1-FY27&brandId=<id>`. The endpoint already supports brand and quarter filtering after the recent fix. The response shape needs one addition: an explicit list of months that have actuals for the cycle (currently inferred from `actuals_months_count`/`total_months_count`). This lets the card subtitle render "Through Apr" / "Through Apr–May" without further round-trips.

Approval progress for InReview rows continues to come from `/api/approvals/dashboard`.

**FY YTD tab fetch.** New endpoint (or new mode on `/api/summary`):

```
GET /api/summary/fy-ytd?fy=27&brandId=<id>
```

Returns:
- Per-quarter entries (Q1..Q4) with `planned`, `actual`, `actuals_months` per metric.
- YTD rollup: sum of plan-to-date, sum of actual-to-date, variance per metric.

One request per FY tab load — avoids four parallel quarter fetches.

**Frontend.** `useDashboardData` gets a `scope` parameter (`Q1-FY27` | `FY27-YTD`) instead of just `brandId`. It fetches the appropriate endpoint based on scope. `page.tsx` gains the FY-year dropdown + tab strip; active scope is reflected in the URL.

## Components

**Removed/heavily reduced.**
- `BrandPanel.tsx` (~673 lines today) shrinks to a slim cycle-row component (~30 lines). The variance table, monthly breakdown, category breakdown, expand/collapse — none of those belong on this dashboard anymore.

**Moved.**
- The inline variance/monthly/category drill-down components — port to `/cycles/[cycleId]` if not already present there, or extract into a shared component used only on the cycle detail page.

**New/changed.**
- Tab strip + FY-year dropdown component in `page.tsx`.
- KPI card variant that shows plan + actual + variance with partial-window subtitle (existing `MetricCard` may be reused or a new `PlanVsActualCard` introduced).
- Quarterly breakdown table component for the FY YTD tab.

## Open questions

- **Threshold semantics for FY YTD variance.** Per-brand thresholds today apply to per-cycle variance. For the FY YTD rollup, do we want the same thresholds to apply to the rolled-up YTD %, or different thresholds? Default assumption: reuse the same thresholds. Confirm with stakeholders.
- **FY-year dropdown scope.** Show only FY years that have at least one cycle for the brand, or always show the last N years? Default: only FYs with cycles.

## Out of scope (this design)

- Monthly trend chart on the FY YTD tab (deferred follow-up).
- Cross-brand rollup views.
- Quarter selector on `/cycles/[cycleId]` or other pages.
- Migrations to normalize legacy `planning_quarter` strings — the recent summary fix already filters by `planning_period_start` to avoid the string format issue.
