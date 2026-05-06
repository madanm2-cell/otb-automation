# Executive Dashboard Zones Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Approved Plans and Actuals vs Plan dashboard zones so they are distinct, correctly labelled, and genuinely useful for a CXO audience.

**Architecture:** 5 tasks — types first, then API, then UI components, then page wiring. Each task is independently testable via `npx tsc --noEmit`. No new routes or DB tables.

**Tech Stack:** Next.js 16 App Router, TypeScript, Ant Design 6, Supabase, Vitest

---

### Task 1: Update types — `CategoryBreakdown.inwards_qty` + `EnhancedBrandSummary.has_actuals`

**Files:**
- Modify: `src/types/otb.ts`

**Context:**
`CategoryBreakdown` currently has `gmv`, `nsq`, `pct_of_total`. We're adding `inwards_qty`.
`EnhancedBrandSummary` needs `has_actuals: boolean` so the UI knows whether to show a variance panel or a placeholder.

**Step 1: Edit the types**

In `src/types/otb.ts`, update `CategoryBreakdown` (around line 394):

```typescript
export interface CategoryBreakdown {
  sub_category: string;
  gmv: number;
  nsq: number;
  inwards_qty: number;
  pct_of_total: number; // percentage of brand total GMV
}
```

In the same file, update `EnhancedBrandSummary` (around line 401) — add `has_actuals` after `top_categories`:

```typescript
export interface EnhancedBrandSummary {
  brand_id: string;
  brand_name: string;
  cycle_id: string;
  cycle_name: string;
  status: string;
  planning_quarter: string;
  // Aggregate metrics
  gmv: number;
  nsv: number;
  nsq: number;
  inwards_qty: number;
  avg_doh: number;
  closing_stock_qty: number;
  // Breakdowns
  monthly: BrandMonthBreakdown[];
  top_categories: CategoryBreakdown[];
  has_actuals: boolean;
}
```

**Step 2: Verify types compile**

```bash
cd otb-automation && npx tsc --noEmit 2>&1
```

Expected: TypeScript errors pointing to the API and component files that use the old types — that's expected and will be fixed in subsequent tasks. Zero errors means the types themselves are valid.

**Step 3: Commit**

```bash
git add src/types/otb.ts
git commit -m "feat: add inwards_qty to CategoryBreakdown and has_actuals to EnhancedBrandSummary"
```

---

### Task 2: Summary API — accumulate `inwards_qty` in categories + populate `has_actuals`

**Files:**
- Modify: `src/app/api/summary/route.ts`

**Context:**
The summary API at line 113 defines `categoryData: Record<string, { gmv: number; nsq: number }>`. We need to add `inwards_qty` here. The API already fetches `inwards_qty` from `otb_plan_data` (line 79) — it just doesn't accumulate it per category. We also need to query `otb_actuals` for a set of cycle IDs that have any actuals rows.

**Step 1: Add `inwards_qty` to the `categoryData` interface and aggregation**

At line 113, update the inline type:
```typescript
categoryData: Record<string, { gmv: number; nsq: number; inwards_qty: number }>;
```

At line 162 (the category breakdown init), update:
```typescript
if (!agg.categoryData[subCategory]) {
  agg.categoryData[subCategory] = { gmv: 0, nsq: 0, inwards_qty: 0 };
}
agg.categoryData[subCategory].gmv += pd.sales_plan_gmv || 0;
agg.categoryData[subCategory].nsq += pd.nsq || 0;
agg.categoryData[subCategory].inwards_qty += pd.inwards_qty || 0;
```

**Step 2: Query `otb_actuals` to build `cyclesWithActuals` set**

After `const cycleIds = cycles.map(c => c.id);` (around line 58), add:

```typescript
// Determine which cycles have actuals uploaded
const cyclesWithActuals = new Set<string>();
if (cycleIds.length > 0) {
  const { data: actualsCheck } = await supabase
    .from('otb_actuals')
    .select('cycle_id')
    .in('cycle_id', cycleIds);
  for (const row of actualsCheck || []) {
    cyclesWithActuals.add(row.cycle_id);
  }
}
```

**Step 3: Include `inwards_qty` and `has_actuals` in the brand summary output**

In the `top_categories` mapping (around line 187), update:
```typescript
const top_categories: CategoryBreakdown[] = Object.entries(agg.categoryData)
  .map(([sub_category, data]) => ({
    sub_category,
    gmv: data.gmv,
    nsq: data.nsq,
    inwards_qty: data.inwards_qty,
    pct_of_total: (data.gmv / totalBrandGmv) * 100,
  }))
  .sort((a, b) => b.gmv - a.gmv)
  .slice(0, 5);
```

In the `return { ... }` object (around line 197), add `has_actuals`:
```typescript
return {
  ...
  monthly,
  top_categories,
  has_actuals: cyclesWithActuals.has(agg.cycle_id),
};
```

**Step 4: Verify no TypeScript errors**

```bash
cd otb-automation && npx tsc --noEmit 2>&1
```

Expected: Errors only in `BrandPanel.tsx` and `page.tsx` (not yet updated) — the API itself should be clean.

**Step 5: Commit**

```bash
git add src/app/api/summary/route.ts
git commit -m "feat: add inwards_qty category rollup and has_actuals to summary API"
```

---

### Task 3: Rewrite `TopCategories` component with labelled table

**Files:**
- Modify: `src/components/ui/BrandPanel.tsx`

**Context:**
`TopCategories` currently renders unlabelled inline values. Replace it with an Ant Design `Table` matching `MonthlyTable`'s pattern. The `CategoryBreakdown` type now has `inwards_qty`.

**Step 1: Replace the `TopCategories` function**

Find the existing `TopCategories` function (lines 125–161) and replace entirely:

```typescript
function TopCategories({ categories }: { categories: EnhancedBrandSummary['top_categories'] }) {
  if (!categories || categories.length === 0) return null;

  const columns = [
    {
      title: 'Sub-Category',
      dataIndex: 'sub_category',
      key: 'sub_category',
    },
    {
      title: 'GMV',
      dataIndex: 'gmv',
      key: 'gmv',
      render: (v: number) => formatCrore(v),
    },
    {
      title: 'NSQ',
      dataIndex: 'nsq',
      key: 'nsq',
      render: (v: number) => formatQty(v),
    },
    {
      title: 'Inwards',
      dataIndex: 'inwards_qty',
      key: 'inwards_qty',
      render: (v: number) => formatQty(v),
    },
    {
      title: 'GMV Share',
      dataIndex: 'pct_of_total',
      key: 'pct_of_total',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
  ];

  return (
    <div style={{ marginTop: SPACING.lg }}>
      <Text strong style={{ fontSize: 13, color: COLORS.textSecondary }}>
        Top Sub-Categories by GMV
      </Text>
      <Table
        dataSource={categories}
        columns={columns}
        rowKey="sub_category"
        size="small"
        pagination={false}
        style={{ marginTop: SPACING.sm }}
      />
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
cd otb-automation && npx tsc --noEmit 2>&1
```

Expected: Clean for `BrandPanel.tsx`. Remaining errors only in `page.tsx` (Task 5).

**Step 3: Commit**

```bash
git add src/components/ui/BrandPanel.tsx
git commit -m "feat: rewrite TopCategories with labelled table (GMV, NSQ, Inwards, GMV Share)"
```

---

### Task 4: Variance zone — new collapsed header + new expanded body in `BrandPanel`

**Files:**
- Modify: `src/components/ui/BrandPanel.tsx`

**Context:**
When `zone === 'variance'`, the collapsed header currently shows plan metrics (GMV, NSV, NSQ…) — identical to the approved zone. It should instead show aggregate variance badges (e.g. "GMV −4.2%") colour-coded by threshold. The expanded body should show RAG counts + top variances table, not the monthly plan table.

`VarianceRow` has: `gmv`, `nsq`, `inwards`, `closing_stock` (each a `VarianceMetric` with `planned`, `actual`, `variance_pct`). There is **no `nsv`** in `VarianceRow`.

Thresholds from `DEFAULT_VARIANCE_THRESHOLDS` (already exported from `src/types/otb.ts`):
- gmv_pct: 15, nsq_pct: 15, inwards_pct: 20, closing_stock_pct: 25

Colour logic:
- `|pct| <= threshold` → green (`COLORS.success`)
- `threshold < |pct| <= 2×threshold` → amber (`COLORS.warning`)
- `|pct| > 2×threshold` → red (`COLORS.danger`)

**Step 1: Add imports**

At the top of `BrandPanel.tsx`, add to the existing import from `@/types/otb`:
```typescript
import type {
  EnhancedBrandSummary,
  BrandMonthBreakdown,
  VarianceReportData,
  VarianceRow,
} from '@/types/otb';
import { DEFAULT_VARIANCE_THRESHOLDS } from '@/types/otb';
```

Also add `Skeleton` to the antd import:
```typescript
import { Card, Tag, Table, Button, Space, Typography, Tooltip, Modal, Input, message, Skeleton } from 'antd';
```

**Step 2: Add the pure `aggregateVariancePct` helper before `BrandPanel`**

Add this function after the `formatMonth` helper:

```typescript
type VarianceMetricKey = 'gmv' | 'nsq' | 'inwards' | 'closing_stock';

function aggregateVariancePct(rows: VarianceRow[], metric: VarianceMetricKey): number | null {
  let planned = 0;
  let actual = 0;
  let hasData = false;
  for (const row of rows) {
    const m = row[metric];
    if (m.planned != null && m.actual != null) {
      planned += m.planned;
      actual += m.actual;
      hasData = true;
    }
  }
  if (!hasData || planned === 0) return null;
  return ((actual - planned) / planned) * 100;
}

function varianceColor(pct: number, threshold: number): string {
  const abs = Math.abs(pct);
  if (abs <= threshold) return COLORS.success;
  if (abs <= threshold * 2) return COLORS.warning;
  return COLORS.danger;
}
```

**Step 3: Add `VarianceBadge` component**

Add after `InlineMetric`:

```typescript
function VarianceBadge({ label, pct, threshold }: { label: string; pct: number | null; threshold: number }) {
  return (
    <Tooltip title={label}>
      <div style={{ textAlign: 'center', minWidth: 80 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>{label}</div>
        {pct === null ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMuted }}>—</div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, color: varianceColor(pct, threshold) }}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
          </div>
        )}
      </div>
    </Tooltip>
  );
}
```

**Step 4: Add `VarianceBody` component**

Add after `TopCategories`:

```typescript
function VarianceBody({ variance }: { variance: VarianceReportData }) {
  const { summary } = variance;

  const topVarColumns = [
    { title: 'Month', dataIndex: 'month', key: 'month', render: (v: string) => formatMonth(v) },
    { title: 'Sub-Category', dataIndex: 'sub_category', key: 'sub_category' },
    { title: 'Channel', dataIndex: 'channel', key: 'channel' },
    {
      title: 'GMV Var%',
      key: 'gmv',
      render: (_: unknown, row: VarianceRow) =>
        row.gmv.variance_pct != null ? (
          <span style={{ color: varianceColor(row.gmv.variance_pct, DEFAULT_VARIANCE_THRESHOLDS.gmv_pct), fontWeight: 600 }}>
            {row.gmv.variance_pct >= 0 ? '+' : ''}{row.gmv.variance_pct.toFixed(1)}%
          </span>
        ) : '—',
    },
    {
      title: 'NSQ Var%',
      key: 'nsq',
      render: (_: unknown, row: VarianceRow) =>
        row.nsq.variance_pct != null ? (
          <span style={{ color: varianceColor(row.nsq.variance_pct, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct), fontWeight: 600 }}>
            {row.nsq.variance_pct >= 0 ? '+' : ''}{row.nsq.variance_pct.toFixed(1)}%
          </span>
        ) : '—',
    },
  ];

  return (
    <div style={{ marginTop: SPACING.lg }}>
      {/* RAG Summary */}
      <Space size={SPACING.lg} style={{ marginBottom: SPACING.md }}>
        <span style={{ color: COLORS.danger, fontWeight: 600 }}>● {summary.red_count} red</span>
        <span style={{ color: COLORS.warning, fontWeight: 600 }}>● {summary.yellow_count} amber</span>
        <span style={{ color: COLORS.success, fontWeight: 600 }}>● {summary.green_count} green</span>
      </Space>
      {/* Top Variances */}
      {summary.top_variances.length > 0 && (
        <>
          <Text strong style={{ fontSize: 13, color: COLORS.textSecondary }}>Top Variances</Text>
          <Table
            dataSource={summary.top_variances}
            columns={topVarColumns}
            rowKey={(row) => `${row.sub_category}-${row.channel}-${row.month}`}
            size="small"
            pagination={false}
            style={{ marginTop: SPACING.sm }}
          />
        </>
      )}
    </div>
  );
}
```

**Step 5: Update the collapsed header in `BrandPanel` to branch on `zone`**

Find the `{/* Inline Metrics */}` block in the `BrandPanel` return (around line 378). Replace it with a branch:

```typescript
{/* Inline Metrics — plan view for review/approved; variance view for variance zone */}
<div style={{ display: 'flex', gap: SPACING.lg, marginLeft: 'auto', flexWrap: 'wrap' }}>
  {zone === 'variance' ? (
    variance ? (
      <>
        <VarianceBadge
          label="GMV"
          pct={aggregateVariancePct(variance.rows, 'gmv')}
          threshold={DEFAULT_VARIANCE_THRESHOLDS.gmv_pct}
        />
        <VarianceBadge
          label="NSQ"
          pct={aggregateVariancePct(variance.rows, 'nsq')}
          threshold={DEFAULT_VARIANCE_THRESHOLDS.nsq_pct}
        />
        <VarianceBadge
          label="Inwards"
          pct={aggregateVariancePct(variance.rows, 'inwards')}
          threshold={DEFAULT_VARIANCE_THRESHOLDS.inwards_pct}
        />
        <VarianceBadge
          label="Closing Stock"
          pct={aggregateVariancePct(variance.rows, 'closing_stock')}
          threshold={DEFAULT_VARIANCE_THRESHOLDS.closing_stock_pct}
        />
      </>
    ) : (
      // Variance not yet loaded — skeleton placeholders
      <Space size={SPACING.lg}>
        {['GMV', 'NSQ', 'Inwards', 'Closing Stock'].map(label => (
          <div key={label} style={{ textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{label}</div>
            <Skeleton.Input active style={{ width: 60, height: 18 }} size="small" />
          </div>
        ))}
      </Space>
    )
  ) : (
    <>
      <InlineMetric label="GMV" value={formatCrore(brand.gmv)} />
      <InlineMetric label="NSV" value={formatCrore(brand.nsv)} />
      <InlineMetric label="NSQ" value={formatQty(brand.nsq)} />
      <InlineMetric label="Inwards" value={formatQty(brand.inwards_qty)} />
      <InlineMetric label="Closing Stock" value={formatQty(brand.closing_stock_qty)} />
      <InlineMetric label="DoH" value={String(Math.round(brand.avg_doh))} />
    </>
  )}
</div>
```

**Step 6: Update the expanded body to branch on `zone`**

Find the `{/* Expanded Body */}` block (around line 396). Replace the inner content:

```typescript
{expanded && (
  <div
    style={{
      padding: `0 ${SPACING.lg}px ${SPACING.lg}px`,
      borderTop: `1px solid ${COLORS.borderLight}`,
    }}
  >
    {zone === 'variance' ? (
      variance ? (
        <VarianceBody variance={variance} />
      ) : (
        <Skeleton active paragraph={{ rows: 3 }} style={{ marginTop: SPACING.md }} />
      )
    ) : (
      <>
        <MonthlyTable data={brand.monthly} />
        <TopCategories categories={brand.top_categories} />
      </>
    )}
    <ZoneActions
      zone={zone}
      brand={brand}
      approvalProgress={approvalProgress}
      needsMyApproval={needsMyApproval}
      actionLoading={actionLoading}
      onApprove={handleApprove}
      onRequestRevision={() => setRevisionModalOpen(true)}
    />
  </div>
)}
```

**Step 7: Verify TypeScript**

```bash
cd otb-automation && npx tsc --noEmit 2>&1
```

Expected: Clean for `BrandPanel.tsx`.

**Step 8: Commit**

```bash
git add src/components/ui/BrandPanel.tsx
git commit -m "feat: variance zone collapsed header with RAG badges and expanded variance body"
```

---

### Task 5: Update `page.tsx` — conditional Actuals vs Plan section + slim no-actuals row

**Files:**
- Modify: `src/app/page.tsx`

**Context:**
The "Actuals vs Plan" section currently always renders when `approvedBrands.length > 0`, using the same `approvedBrands` list as "Approved Plans". We need to:
1. Only show the section when at least one brand has `has_actuals === true`
2. For brands without actuals, show a slim non-expandable placeholder row
3. For brands with actuals, show the existing `BrandPanel zone="variance"`

**Step 1: Add the `NoActualsRow` inline component**

Add this small component before the `CxoDashboard` function or inside it:

```typescript
function NoActualsRow({ brand }: { brand: EnhancedBrandSummary }) {
  return (
    <Card
      style={{ ...CARD_STYLES, marginBottom: SPACING.md }}
      styles={{ body: { padding: 0 } }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `${SPACING.md}px ${SPACING.lg}px`,
          gap: SPACING.md,
        }}
      >
        <div style={{ minWidth: 160, flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.textPrimary }}>
            {brand.brand_name}
          </div>
          <div style={{ fontSize: 13, color: COLORS.textSecondary }}>{brand.cycle_name}</div>
        </div>
        <Text style={{ fontSize: 12, color: COLORS.textMuted, flexShrink: 0 }}>
          {brand.planning_quarter}
        </Text>
        <Text type="secondary" style={{ fontSize: 13, marginLeft: SPACING.md }}>
          Actuals not yet uploaded
        </Text>
      </div>
    </Card>
  );
}
```

Import `EnhancedBrandSummary` at the top of `page.tsx`:
```typescript
import type { EnhancedBrandSummary } from '@/types/otb';
```

Also import `Card` from antd (add to existing antd import).

**Step 2: Replace the Actuals vs Plan zone**

Find the `{/* Zone 3 — Actuals vs Plan */}` block and replace entirely:

```typescript
{/* Zone 3 — Actuals vs Plan (only shown when at least one cycle has actuals) */}
{approvedBrands.some(b => b.has_actuals) && (
  <div style={{ marginBottom: SPACING.xl }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
      <Title level={4} style={{ margin: 0 }}>Actuals vs Plan</Title>
    </div>
    {approvedBrands.map(brand =>
      brand.has_actuals ? (
        <BrandPanel
          key={brand.cycle_id}
          brand={brand}
          zone="variance"
          variance={dashboard.varianceCache[brand.cycle_id] || null}
          onLoadVariance={dashboard.loadVariance}
        />
      ) : (
        <NoActualsRow key={brand.cycle_id} brand={brand} />
      )
    )}
  </div>
)}
```

**Step 3: Verify TypeScript — full clean**

```bash
cd otb-automation && npx tsc --noEmit 2>&1
```

Expected: No errors anywhere.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: conditional Actuals vs Plan zone with slim no-actuals placeholder rows"
```

---

### Verification checklist

After all tasks:

1. `npx tsc --noEmit` — zero errors
2. `npx vitest run` — all existing tests pass
3. Dashboard with no actuals: "Actuals vs Plan" section hidden entirely
4. Dashboard with actuals on some cycles: section shows; cycles with actuals show variance badges in collapsed header; cycles without show slim placeholder
5. Expanding a variance panel: shows RAG counts + top variances table (no monthly plan table)
6. Expanding a non-variance panel: still shows monthly table + top categories table with proper column headers (Sub-Category, GMV, NSQ, Inwards, GMV Share)
7. Top categories: "Top Sub-Categories by GMV" heading, 5 columns all labelled
