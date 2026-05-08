# Variance Report Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the variance report page into a CXO-facing tool with direction-aware RAG, monthly/quarterly aggregations, and per-brand threshold configuration in an admin UI.

**Architecture:** Extend `VarianceRow` with NSV and DOH metrics; add direction-aware `classifyVariance()` to varianceEngine; store thresholds in a new `brand_variance_thresholds` table fetched at report load time; restructure `VarianceReportData` to include `all_months`, `actuals_months`, `thresholds`, and `channels`; rewrite `VarianceReport.tsx` as a 7-tab component; all monthly/Q-total aggregations computed client-side from raw dimension rows.

**Tech Stack:** Next.js App Router, Supabase PostgreSQL, Ant Design 6, Vitest, ExcelJS

**Design Doc:** `docs/plans/2026-05-08-variance-report-redesign-design.md`

---

## Aggregation Rules (read before implementing)

- **GMV, NSV, NSQ, Inwards:** Q-total = sum across all `actuals_months`
- **Closing Stock, DOH:** Q-total = value from the _last_ available actuals month (not summed — these are position metrics)
- **Channel filter:** applied client-side; re-aggregates all metrics from the filtered dimension rows
- **Sub-category sort order:** highest actual GMV descending (fall back to planned GMV if no actuals)
- **Direction-aware RAG:**
  - GMV, NSV, NSQ (higher_is_good): over-plan = green; under within threshold = yellow; under beyond threshold = red
  - Inwards, Closing Stock, DOH (lower_is_good): under-plan = green; over within threshold = yellow; over beyond threshold = red

---

## Task 1: DB Migration — `brand_variance_thresholds`

**Files:**
- Create: `supabase/migrations/016_brand_variance_thresholds.sql`

**Step 1: Write the migration**

```sql
-- 016_brand_variance_thresholds.sql
CREATE TABLE brand_variance_thresholds (
  brand_id      uuid        NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  metric        text        NOT NULL CHECK (metric IN (
                              'gmv_pct','nsv_pct','nsq_pct',
                              'inwards_pct','closing_stock_pct','doh_pct'
                            )),
  threshold_pct numeric     NOT NULL CHECK (threshold_pct > 0),
  updated_by    uuid        REFERENCES auth.users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, metric)
);

ALTER TABLE brand_variance_thresholds ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all" ON brand_variance_thresholds
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

-- Planning: read/write only for their assigned brands
CREATE POLICY "planning_assigned" ON brand_variance_thresholds
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Planning'
        AND assigned_brands @> jsonb_build_array(brand_id::text)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Planning'
        AND assigned_brands @> jsonb_build_array(brand_id::text)
    )
  );

-- All authenticated: read
CREATE POLICY "all_read" ON brand_variance_thresholds
  FOR SELECT TO authenticated
  USING (true);
```

**Step 2: Apply the migration**

```bash
cd otb-automation
npx supabase db reset
```

Expected: migration runs without errors.

**Step 3: Commit**

```bash
git add supabase/migrations/016_brand_variance_thresholds.sql
git commit -m "feat: add brand_variance_thresholds migration"
```

---

## Task 2: Types — Extend variance types

**Files:**
- Modify: `src/types/otb.ts` (lines ~327–380)

**Step 1: Add new types and update existing ones**

Replace the variance section (everything from `export type VarianceLevel` through `export interface VarianceSummary`) with:

```typescript
// === Variance Types ===

export type VarianceLevel = 'green' | 'yellow' | 'red';
export type MetricDirection = 'higher_is_good' | 'lower_is_good';

export const METRIC_DIRECTIONS: Record<string, MetricDirection> = {
  gmv_pct: 'higher_is_good',
  nsv_pct: 'higher_is_good',
  nsq_pct: 'higher_is_good',
  inwards_pct: 'lower_is_good',
  closing_stock_pct: 'lower_is_good',
  doh_pct: 'lower_is_good',
};

export interface VarianceMetric {
  metric: string;
  planned: number | null;
  actual: number | null;
  variance_pct: number | null;
  level: VarianceLevel;
}

export interface VarianceRow {
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  month: string;
  nsq: VarianceMetric;
  gmv: VarianceMetric;
  nsv: VarianceMetric;
  inwards: VarianceMetric;
  closing_stock: VarianceMetric;
  doh: VarianceMetric;
}

export interface VarianceThresholds {
  nsq_pct: number;
  gmv_pct: number;
  nsv_pct: number;
  inwards_pct: number;
  closing_stock_pct: number;
  doh_pct: number;
}

export const DEFAULT_VARIANCE_THRESHOLDS: VarianceThresholds = {
  nsq_pct: 15,
  gmv_pct: 15,
  nsv_pct: 15,
  inwards_pct: 20,
  closing_stock_pct: 25,
  doh_pct: 20,
};

export interface BrandVarianceThreshold {
  brand_id: string;
  metric: string;
  threshold_pct: number;
  updated_by: string | null;
  updated_at: string;
}

export interface VarianceReportData {
  cycle_id: string;
  cycle_name: string;
  brand_name: string;
  brand_id: string;
  planning_quarter: string;
  all_months: string[];        // all 3 quarter months (from plan_data)
  actuals_months: string[];    // months that have actuals uploaded
  thresholds: VarianceThresholds;
  channels: string[];
  rows: VarianceRow[];
}
```

**Step 2: Run TypeScript check**

```bash
cd otb-automation
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in files that use old `VarianceSummary` / old `VarianceReportData` shape (we'll fix those in later tasks).

**Step 3: Commit**

```bash
git add src/types/otb.ts
git commit -m "feat: extend variance types with direction, NSV/DOH, new VarianceReportData shape"
```

---

## Task 3: varianceEngine.ts — Direction-aware classification

**Files:**
- Modify: `src/lib/varianceEngine.ts`
- Modify: `tests/unit/varianceEngine.test.ts` (create if not exists)

**Step 1: Write failing tests**

Create `tests/unit/varianceEngine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyVariance, buildVarianceMetric } from '../../src/lib/varianceEngine';

describe('classifyVariance — direction-aware', () => {
  describe('higher_is_good (GMV, NSV, NSQ)', () => {
    it('over plan → green regardless of magnitude', () => {
      expect(classifyVariance(50, 15, 'higher_is_good')).toBe('green');
    });
    it('slightly under plan within threshold → yellow', () => {
      expect(classifyVariance(-10, 15, 'higher_is_good')).toBe('yellow');
    });
    it('under plan beyond threshold → red', () => {
      expect(classifyVariance(-20, 15, 'higher_is_good')).toBe('red');
    });
    it('exactly at threshold under plan → yellow', () => {
      expect(classifyVariance(-15, 15, 'higher_is_good')).toBe('yellow');
    });
    it('null variance → green', () => {
      expect(classifyVariance(null, 15, 'higher_is_good')).toBe('green');
    });
  });

  describe('lower_is_good (Inwards, Closing Stock, DOH)', () => {
    it('under plan → green regardless of magnitude', () => {
      expect(classifyVariance(-30, 20, 'lower_is_good')).toBe('green');
    });
    it('slightly over plan within threshold → yellow', () => {
      expect(classifyVariance(10, 20, 'lower_is_good')).toBe('yellow');
    });
    it('over plan beyond threshold → red', () => {
      expect(classifyVariance(30, 20, 'lower_is_good')).toBe('red');
    });
    it('exactly at threshold over plan → yellow', () => {
      expect(classifyVariance(20, 20, 'lower_is_good')).toBe('yellow');
    });
  });

  describe('backward compat — default direction is higher_is_good', () => {
    it('uses higher_is_good when direction omitted', () => {
      expect(classifyVariance(-20, 15)).toBe('red');
      expect(classifyVariance(5, 15)).toBe('green');
    });
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd otb-automation
npx vitest run tests/unit/varianceEngine.test.ts
```

Expected: FAIL — `classifyVariance` doesn't accept a direction argument yet.

**Step 3: Rewrite `varianceEngine.ts`**

```typescript
import type { VarianceLevel, VarianceMetric, MetricDirection, METRIC_DIRECTIONS } from '@/types/otb';
import { METRIC_DIRECTIONS as DIRECTIONS } from '@/types/otb';
import {
  calcSalesPlanGmv,
  calcNsv,
  calcClosingStockQty,
  calcFwd30dayDoh,
  calcGmPct,
} from './formulaEngine';

export function calcVariancePct(
  actual: number | null,
  planned: number | null,
): number | null {
  if (actual == null || planned == null || planned === 0) return null;
  return ((actual - planned) / planned) * 100;
}

export function classifyVariance(
  variancePct: number | null,
  thresholdPct: number,
  direction: MetricDirection = 'higher_is_good',
): VarianceLevel {
  if (variancePct == null) return 'green';

  if (direction === 'higher_is_good') {
    if (variancePct >= 0) return 'green';
    if (Math.abs(variancePct) <= thresholdPct) return 'yellow';
    return 'red';
  } else {
    if (variancePct <= 0) return 'green';
    if (variancePct <= thresholdPct) return 'yellow';
    return 'red';
  }
}

export function buildVarianceMetric(
  metricKey: string,
  actual: number | null,
  planned: number | null,
  thresholdPct: number,
): VarianceMetric {
  const variance_pct = calcVariancePct(actual, planned);
  const direction: MetricDirection = DIRECTIONS[metricKey] ?? 'higher_is_good';
  return {
    metric: metricKey,
    planned,
    actual,
    variance_pct,
    level: classifyVariance(variance_pct, thresholdPct, direction),
  };
}

export interface ActualDerivedInputs {
  actualNsq: number | null;
  actualInwardsQty: number | null;
  asp: number | null;
  cogs: number | null;
  openingStockQty: number | null;
  returnPct: number | null;
  taxPct: number | null;
  nextMonthActualNsq: number | null;
}

export interface ActualDerivedOutputs {
  actualGmv: number | null;
  actualNsv: number | null;
  actualClosingStockQty: number | null;
  actualDoh: number | null;
  actualGmPct: number | null;
}

export function calcActualDerived(inputs: ActualDerivedInputs): ActualDerivedOutputs {
  const actualGmv = calcSalesPlanGmv(inputs.actualNsq, inputs.asp);
  const actualNsv = calcNsv(actualGmv, inputs.returnPct, inputs.taxPct);
  const actualClosingStockQty = calcClosingStockQty(
    inputs.openingStockQty,
    inputs.actualInwardsQty,
    inputs.actualNsq,
  );
  const actualDoh = calcFwd30dayDoh(actualClosingStockQty, inputs.nextMonthActualNsq);
  const actualGmPct = calcGmPct(inputs.asp, inputs.cogs);

  return { actualGmv, actualNsv, actualClosingStockQty, actualDoh, actualGmPct };
}
```

Note: `getTopVariances` and `maxAbsVariance` are no longer needed — delete them.

**Step 4: Run tests**

```bash
npx vitest run tests/unit/varianceEngine.test.ts
```

Expected: all PASS.

**Step 5: Run all unit tests**

```bash
npx vitest run
```

Expected: all PASS (fix any type errors from removed helpers if other tests used them).

**Step 6: Commit**

```bash
git add src/lib/varianceEngine.ts tests/unit/varianceEngine.test.ts
git commit -m "feat: direction-aware classifyVariance in varianceEngine"
```

---

## Task 4: Thresholds API

**Files:**
- Create: `src/app/api/admin/variance-thresholds/route.ts`

**Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import {
  DEFAULT_VARIANCE_THRESHOLDS,
  type VarianceThresholds,
  type BrandVarianceThreshold,
} from '@/types/otb';

const METRICS = ['gmv_pct', 'nsv_pct', 'nsq_pct', 'inwards_pct', 'closing_stock_pct', 'doh_pct'] as const;

// GET /api/admin/variance-thresholds?brandId=X
// Returns a VarianceThresholds object (merges DB rows with defaults)
export const GET = withAuth('manage_master_data', async (req, auth) => {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('brand_variance_thresholds')
    .select('*')
    .eq('brand_id', brandId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Merge DB rows with defaults
  const thresholds: VarianceThresholds = { ...DEFAULT_VARIANCE_THRESHOLDS };
  for (const row of (data ?? []) as BrandVarianceThreshold[]) {
    if (row.metric in thresholds) {
      (thresholds as Record<string, number>)[row.metric] = row.threshold_pct;
    }
  }

  return NextResponse.json(thresholds);
});

// PUT /api/admin/variance-thresholds
// Body: { brandId: string, metric: string, threshold_pct: number }
export const PUT = withAuth('manage_master_data', async (req, auth) => {
  const body = await req.json();
  const { brandId, metric, threshold_pct } = body;

  if (!brandId || !metric || typeof threshold_pct !== 'number' || threshold_pct <= 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  if (!METRICS.includes(metric as typeof METRICS[number])) {
    return NextResponse.json({ error: `Unknown metric: ${metric}` }, { status: 400 });
  }

  // Planning users can only edit their assigned brands
  if (auth.profile.role === 'Planning') {
    const assigned = (auth.profile.assigned_brands ?? []) as string[];
    if (!assigned.includes(brandId)) {
      return NextResponse.json({ error: 'Forbidden: brand not assigned' }, { status: 403 });
    }
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('brand_variance_thresholds')
    .upsert(
      { brand_id: brandId, metric, threshold_pct, updated_by: auth.user.id, updated_at: new Date().toISOString() },
      { onConflict: 'brand_id,metric' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "variance-thresholds"
```

Expected: no errors for this file.

**Step 3: Commit**

```bash
git add src/app/api/admin/variance-thresholds/route.ts
git commit -m "feat: GET/PUT /api/admin/variance-thresholds API"
```

---

## Task 5: VarianceThresholdsAdmin component

**Files:**
- Create: `src/components/VarianceThresholdsAdmin.tsx`

**Step 1: Write the component**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, InputNumber, Button, message, Typography, Spin, Alert } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_VARIANCE_THRESHOLDS, type VarianceThresholds } from '@/types/otb';

const { Text } = Typography;

const METRIC_LABELS: Record<string, string> = {
  gmv_pct: 'GMV',
  nsv_pct: 'NSV',
  nsq_pct: 'NSQ',
  inwards_pct: 'Inwards',
  closing_stock_pct: 'Closing Stock',
  doh_pct: 'DOH',
};

const METRIC_KEYS = Object.keys(METRIC_LABELS) as (keyof VarianceThresholds)[];

interface Props {
  brandId: string;
}

export function VarianceThresholdsAdmin({ brandId }: Props) {
  const { profile } = useAuth();
  const [thresholds, setThresholds] = useState<VarianceThresholds>({ ...DEFAULT_VARIANCE_THRESHOLDS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/variance-thresholds?brandId=${brandId}`);
    if (res.ok) {
      setThresholds(await res.json());
    } else {
      setError('Failed to load thresholds');
    }
    setLoading(false);
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  const save = async (metric: string) => {
    setSaving(metric);
    const value = (thresholds as Record<string, number>)[metric];
    const res = await fetch('/api/admin/variance-thresholds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId, metric, threshold_pct: value }),
    });
    setSaving(null);
    if (res.ok) {
      message.success(`${METRIC_LABELS[metric]} threshold saved`);
    } else {
      const body = await res.json().catch(() => ({}));
      message.error(body.error ?? 'Save failed');
    }
  };

  if (loading) return <Spin />;
  if (error) return <Alert type="error" message={error} />;

  const rows = METRIC_KEYS.map(metric => ({
    key: metric,
    metric,
    label: METRIC_LABELS[metric],
    value: (thresholds as Record<string, number>)[metric],
    default: (DEFAULT_VARIANCE_THRESHOLDS as Record<string, number>)[metric],
  }));

  return (
    <Table
      dataSource={rows}
      pagination={false}
      size="small"
      columns={[
        {
          title: 'Metric',
          dataIndex: 'label',
          key: 'label',
          render: (v: string) => <Text strong>{v}</Text>,
        },
        {
          title: 'Threshold %',
          key: 'threshold',
          render: (_, record) => (
            <InputNumber
              min={1}
              max={100}
              value={record.value}
              onChange={(v) => {
                if (v == null) return;
                setThresholds(prev => ({ ...prev, [record.metric]: v }));
              }}
              addonAfter="%"
              style={{ width: 120 }}
            />
          ),
        },
        {
          title: 'Default',
          dataIndex: 'default',
          key: 'default',
          render: (v: number) => <Text type="secondary">{v}%</Text>,
        },
        {
          title: '',
          key: 'action',
          render: (_, record) => (
            <Button
              icon={<SaveOutlined />}
              size="small"
              type="primary"
              loading={saving === record.metric}
              onClick={() => save(record.metric)}
            >
              Save
            </Button>
          ),
        },
      ]}
    />
  );
}
```

**Step 2: Wire into master-data page**

In `src/app/admin/master-data/page.tsx`, the page just renders `<MasterDataManager />`. The threshold section needs a brand selector.

In `src/components/MasterDataManager.tsx`, add a new tab "Variance Thresholds" to the existing `TABS`-driven Tabs component. Since this tab is different (not a CRUD table), add it as a special case:

At the bottom of the `<Tabs>` items array in `MasterDataManager`, add:

```typescript
{
  key: 'variance_thresholds',
  label: 'Variance Thresholds',
  children: selectedBrandId ? (
    <VarianceThresholdsAdmin brandId={selectedBrandId} />
  ) : (
    <Alert type="info" message="Select a brand to manage thresholds" showIcon />
  ),
},
```

Import `VarianceThresholdsAdmin` and `Alert` at the top of `MasterDataManager.tsx`.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "VarianceThresholdsAdmin|MasterDataManager"
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/VarianceThresholdsAdmin.tsx src/components/MasterDataManager.tsx
git commit -m "feat: VarianceThresholdsAdmin component and master-data tab"
```

---

## Task 6: Variance API — new response shape

**Files:**
- Modify: `src/app/api/cycles/[cycleId]/variance/route.ts`

**Step 1: Rewrite the route**

The key changes:
1. Fetch `brand_id` from the cycle
2. Fetch brand thresholds (merge with defaults)
3. Add NSV and DOH to each `VarianceRow`
4. Determine `all_months` from `otb_plan_data` (not just actuals months)
5. Collect available `channels`
6. Return new `VarianceReportData` shape

**Note on plan_data field names:** Check the actual `otb_plan_data` columns. Based on formula engine naming:
- NSV → column `nsv` (computed in step 3 of formula chain)
- DOH → column `fwd_30day_doh`

If column names differ, adjust accordingly.

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildVarianceMetric } from '@/lib/varianceEngine';
import {
  DEFAULT_VARIANCE_THRESHOLDS,
  type VarianceRow,
  type VarianceReportData,
  type VarianceThresholds,
  type BrandVarianceThreshold,
} from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

export const GET = withAuth('view_variance', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  // 1. Fetch cycle with brand info
  const { data: cycle, error: cycleError } = await supabase
    .from('otb_cycles')
    .select('*, brands(id, name)')
    .eq('id', cycleId)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  const brandName = (cycle.brands as { id: string; name?: string } | null)?.name ?? 'Unknown';
  const brandId = (cycle.brands as { id: string } | null)?.id ?? '';

  // 2. Fetch brand thresholds (merge with defaults)
  const { data: thresholdRows } = await supabase
    .from('brand_variance_thresholds')
    .select('*')
    .eq('brand_id', brandId);

  const thresholds: VarianceThresholds = { ...DEFAULT_VARIANCE_THRESHOLDS };
  for (const row of (thresholdRows ?? []) as BrandVarianceThreshold[]) {
    if (row.metric in thresholds) {
      (thresholds as Record<string, number>)[row.metric] = row.threshold_pct;
    }
  }

  // 3. Fetch actuals
  const { data: actuals, error: actualsError } = await supabase
    .from('otb_actuals')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('month');

  if (actualsError) return NextResponse.json({ error: actualsError.message }, { status: 500 });
  if (!actuals || actuals.length === 0) {
    return NextResponse.json({ error: 'No actuals data found for this cycle.' }, { status: 404 });
  }

  // 4. Fetch plan rows + plan data
  const { data: planRows, error: rowError } = await supabase
    .from('otb_plan_rows')
    .select('*')
    .eq('cycle_id', cycleId);

  if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });

  const rowIds = (planRows ?? []).map(r => r.id);
  const allPlanData: Record<string, unknown>[] = [];
  const BATCH = 200;

  for (let i = 0; i < rowIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from('otb_plan_data')
      .select('*')
      .in('row_id', rowIds.slice(i, i + BATCH));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data) allPlanData.push(...data);
  }

  // 5. Build indexes
  const planRowById = new Map<string, Record<string, unknown>>();
  for (const row of planRows ?? []) planRowById.set(row.id, row);

  const planDataMap = new Map<string, Record<string, unknown>>();
  const allMonthSet = new Set<string>();
  for (const pd of allPlanData) {
    const row = planRowById.get(pd.row_id as string);
    if (!row) continue;
    allMonthSet.add(pd.month as string);
    const key = dimKey(
      row.sub_brand as string, row.wear_type as string,
      row.sub_category as string, row.gender as string,
      row.channel as string, pd.month as string,
    );
    planDataMap.set(key, pd);
  }

  // 6. Build variance rows (one per actual record)
  const actualsMonthSet = new Set<string>();
  const channelSet = new Set<string>();
  const varianceRows: VarianceRow[] = [];

  for (const actual of actuals) {
    const month = actual.month as string;
    actualsMonthSet.add(month);
    channelSet.add(actual.channel as string);

    const planned = planDataMap.get(dimKey(
      actual.sub_brand, actual.wear_type,
      actual.sub_category, actual.gender,
      actual.channel, month,
    ));

    varianceRows.push({
      sub_brand: actual.sub_brand,
      wear_type: actual.wear_type,
      sub_category: actual.sub_category,
      gender: actual.gender,
      channel: actual.channel,
      month,
      nsq: buildVarianceMetric('nsq_pct', actual.actual_nsq, (planned?.nsq as number | null) ?? null, thresholds.nsq_pct),
      gmv: buildVarianceMetric('gmv_pct', actual.actual_gmv, (planned?.sales_plan_gmv as number | null) ?? null, thresholds.gmv_pct),
      nsv: buildVarianceMetric('nsv_pct', actual.actual_nsv, (planned?.nsv as number | null) ?? null, thresholds.nsv_pct),
      inwards: buildVarianceMetric('inwards_pct', actual.actual_inwards_qty, (planned?.inwards_qty as number | null) ?? null, thresholds.inwards_pct),
      closing_stock: buildVarianceMetric('closing_stock_pct', actual.actual_closing_stock_qty, (planned?.closing_stock_qty as number | null) ?? null, thresholds.closing_stock_pct),
      doh: buildVarianceMetric('doh_pct', actual.actual_doh, (planned?.fwd_30day_doh as number | null) ?? null, thresholds.doh_pct),
    });
  }

  const report: VarianceReportData = {
    cycle_id: cycleId,
    cycle_name: cycle.cycle_name,
    brand_name: brandName,
    brand_id: brandId,
    planning_quarter: cycle.planning_quarter ?? '',
    all_months: Array.from(allMonthSet).sort(),
    actuals_months: Array.from(actualsMonthSet).sort(),
    thresholds,
    channels: Array.from(channelSet).sort(),
    rows: varianceRows,
  };

  return NextResponse.json(report);
});

function dimKey(
  subBrand: string, wearType: string, subCategory: string,
  gender: string, channel: string, month: string,
): string {
  return `${subBrand}|${wearType}|${subCategory}|${gender}|${channel}|${month}`.toLowerCase();
}
```

**Step 2: Verify plan_data field names**

Run this to check which columns exist in your local Supabase:

```bash
npx supabase db diff --use-migra 2>/dev/null || true
# Or check the migration files:
grep -i "nsv\|fwd_30day_doh\|doh" supabase/migrations/*.sql | head -20
```

If `nsv` or `fwd_30day_doh` column names differ, update the field accesses in the route accordingly (lines `planned?.nsv` and `planned?.fwd_30day_doh`).

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "variance/route"
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/api/cycles/[cycleId]/variance/route.ts
git commit -m "feat: variance API — brand thresholds, NSV/DOH metrics, new response shape"
```

---

## Task 7: VarianceReport — aggregation helpers + Summary tab

**Files:**
- Rewrite: `src/components/VarianceReport.tsx`

This is the largest task. Split into two steps: first the aggregation helpers and Summary tab, then the metric tabs (Task 8).

**Step 1: Write the new `VarianceReport.tsx` with Summary tab only**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { Tabs, Select, Space, Typography, Table, Tag, Collapse, Alert } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { COLORS, CARD_STYLES, SPACING } from '@/lib/designTokens';
import { formatCrore, formatQty, formatPct } from '@/lib/formatting';
import type { VarianceReportData, VarianceRow, VarianceLevel, VarianceMetric } from '@/types/otb';

const { Title, Text } = Typography;

// ─── Aggregation ────────────────────────────────────────────────────────────

// For a set of rows, aggregate one metric across rows.
// For position metrics (closing_stock, doh): use values from the LAST month only.
// For flow metrics (gmv, nsv, nsq, inwards): sum across all rows.
function aggregateMetric(
  rows: VarianceRow[],
  key: keyof Pick<VarianceRow, 'gmv' | 'nsv' | 'nsq' | 'inwards' | 'closing_stock' | 'doh'>,
  actualsMonths: string[],
  isPositionMetric: boolean,
  thresholdPct: number,
): VarianceMetric {
  if (rows.length === 0) {
    return { metric: key, planned: null, actual: null, variance_pct: null, level: 'green' };
  }

  let planned: number | null = null;
  let actual: number | null = null;

  if (isPositionMetric) {
    // Use the last actuals month's values
    const lastMonth = actualsMonths[actualsMonths.length - 1];
    const lastRows = lastMonth ? rows.filter(r => r.month === lastMonth) : rows;
    for (const r of lastRows) {
      const m = r[key];
      if (m.planned != null) planned = (planned ?? 0) + m.planned;
      if (m.actual != null) actual = (actual ?? 0) + m.actual;
    }
  } else {
    // Sum across all rows
    for (const r of rows) {
      const m = r[key];
      if (m.planned != null) planned = (planned ?? 0) + m.planned;
      if (m.actual != null) actual = (actual ?? 0) + m.actual;
    }
  }

  const variance_pct = actual != null && planned != null && planned !== 0
    ? ((actual - planned) / planned) * 100
    : null;

  // Use level from the most extreme individual row's metric
  const levels = rows.map(r => r[key].level);
  const level: VarianceLevel = levels.includes('red') ? 'red'
    : levels.includes('yellow') ? 'yellow' : 'green';

  return { metric: key, planned, actual, variance_pct, level };
}

const POSITION_METRICS = new Set(['closing_stock', 'doh']);

function aggregateRows(
  rows: VarianceRow[],
  actualsMonths: string[],
  thresholds: VarianceReportData['thresholds'],
): Record<string, VarianceMetric> {
  const keys = ['gmv', 'nsv', 'nsq', 'inwards', 'closing_stock', 'doh'] as const;
  const thresholdMap: Record<string, number> = {
    gmv: thresholds.gmv_pct,
    nsv: thresholds.nsv_pct,
    nsq: thresholds.nsq_pct,
    inwards: thresholds.inwards_pct,
    closing_stock: thresholds.closing_stock_pct,
    doh: thresholds.doh_pct,
  };
  return Object.fromEntries(
    keys.map(k => [k, aggregateMetric(rows, k, actualsMonths, POSITION_METRICS.has(k), thresholdMap[k])])
  );
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtValue(key: string, value: number | null): string {
  if (value == null) return '—';
  if (['gmv', 'nsv', 'inwards', 'closing_stock'].includes(key)) return formatCrore(value);
  if (key === 'nsq') return formatQty(value);
  if (key === 'doh') return value.toFixed(1) + ' d';
  return String(value);
}

function VarPctCell({ metric }: { metric: VarianceMetric }) {
  if (metric.variance_pct == null) return <Text type="secondary">—</Text>;
  const LEVEL_COLORS: Record<VarianceLevel, string> = {
    green: COLORS.success,
    yellow: COLORS.warning,
    red: COLORS.danger,
  };
  const color = LEVEL_COLORS[metric.level];
  const sign = metric.variance_pct > 0 ? '+' : '';
  return (
    <Tag color={metric.level === 'green' ? 'success' : metric.level === 'yellow' ? 'warning' : 'error'}
      style={{ fontWeight: 600, fontSize: 12 }}>
      {sign}{metric.variance_pct.toFixed(1)}%
    </Tag>
  );
}

// ─── Summary Tab ─────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  gmv: 'GMV (₹ Cr)',
  nsv: 'NSV (₹ Cr)',
  nsq: 'NSQ (Units)',
  inwards: 'Inwards (₹ Cr)',
  closing_stock: 'Closing Stock (₹ Cr)',
  doh: 'DOH (Days)',
};
const METRIC_KEYS = ['gmv', 'nsv', 'nsq', 'inwards', 'closing_stock', 'doh'] as const;

function shortMonth(m: string) {
  return new Date(m).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

interface SummaryTabProps {
  data: VarianceReportData;
  channelFilter: string | null;
}

function SummaryTab({ data, channelFilter }: SummaryTabProps) {
  const { all_months, actuals_months, thresholds } = data;

  const filteredRows = useMemo(() => {
    return channelFilter ? data.rows.filter(r => r.channel === channelFilter) : data.rows;
  }, [data.rows, channelFilter]);

  // Brand-level aggregated by month
  const byMonth = useMemo(() => {
    return Object.fromEntries(
      all_months.map(m => [m, aggregateRows(filteredRows.filter(r => r.month === m), [m], thresholds)])
    );
  }, [filteredRows, all_months, thresholds]);

  const qTotal = useMemo(() => {
    const actualsRows = filteredRows.filter(r => actuals_months.includes(r.month));
    return aggregateRows(actualsRows, actuals_months, thresholds);
  }, [filteredRows, actuals_months, thresholds]);

  const qLabel = `Q Total (${actuals_months.length} of ${all_months.length} months)`;

  // Build column structure: per month (Plan/Actual/Var%) + Q Total
  const buildColumns = () => {
    const monthCols = all_months.map(m => ({
      title: shortMonth(m),
      children: [
        { title: 'Plan', key: `${m}_plan`, dataIndex: m, render: (_: unknown, row: { key: string }) =>
            <Text type="secondary">{fmtValue(row.key, byMonth[m]?.[row.key]?.planned ?? null)}</Text>
        },
        { title: 'Actual', key: `${m}_actual`, render: (_: unknown, row: { key: string }) =>
            actuals_months.includes(m)
              ? <Text strong>{fmtValue(row.key, byMonth[m]?.[row.key]?.actual ?? null)}</Text>
              : <Text type="secondary">—</Text>
        },
        { title: 'Var%', key: `${m}_var`, render: (_: unknown, row: { key: string }) =>
            actuals_months.includes(m) && byMonth[m]?.[row.key]
              ? <VarPctCell metric={byMonth[m][row.key]} />
              : <Text type="secondary">—</Text>
        },
      ],
    }));

    return [
      { title: 'Metric', dataIndex: 'label', key: 'label', width: 180,
        render: (v: string) => <Text strong>{v}</Text> },
      ...monthCols,
      {
        title: qLabel,
        children: [
          { title: 'Plan', key: 'q_plan', render: (_: unknown, row: { key: string }) =>
              <Text type="secondary">{fmtValue(row.key, qTotal[row.key]?.planned ?? null)}</Text> },
          { title: 'Actual', key: 'q_actual', render: (_: unknown, row: { key: string }) =>
              <Text strong>{fmtValue(row.key, qTotal[row.key]?.actual ?? null)}</Text> },
          { title: 'Var%', key: 'q_var', render: (_: unknown, row: { key: string }) =>
              qTotal[row.key] ? <VarPctCell metric={qTotal[row.key]} /> : <Text type="secondary">—</Text> },
        ],
      },
    ];
  };

  const tableRows = METRIC_KEYS.map(k => ({ key: k, label: METRIC_LABELS[k] }));

  // Sub-category breakdown: aggregate by sub_category, sort by GMV desc
  const subCategories = useMemo(() => {
    const cats = new Set(filteredRows.map(r => r.sub_category));
    return Array.from(cats).sort((a, b) => {
      const aGmv = filteredRows.filter(r => r.sub_category === a && actuals_months.includes(r.month))
        .reduce((s, r) => s + (r.gmv.actual ?? r.gmv.planned ?? 0), 0);
      const bGmv = filteredRows.filter(r => r.sub_category === b && actuals_months.includes(r.month))
        .reduce((s, r) => s + (r.gmv.actual ?? r.gmv.planned ?? 0), 0);
      return bGmv - aGmv;
    });
  }, [filteredRows, actuals_months]);

  return (
    <div>
      <Table
        columns={buildColumns() as any}
        dataSource={tableRows}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
      />

      <Collapse
        style={{ marginTop: SPACING.lg }}
        items={[{
          key: 'detail',
          label: `Sub-Category Breakdown (${subCategories.length} categories)`,
          children: subCategories.map(cat => {
            const catRows = filteredRows.filter(r => r.sub_category === cat);
            const catByMonth = Object.fromEntries(
              all_months.map(m => [m, aggregateRows(catRows.filter(r => r.month === m), [m], thresholds)])
            );
            const catQTotal = aggregateRows(
              catRows.filter(r => actuals_months.includes(r.month)), actuals_months, thresholds
            );
            const catTableRows = METRIC_KEYS.map(k => ({ key: k, label: METRIC_LABELS[k] }));

            return (
              <div key={cat} style={{ marginBottom: SPACING.lg }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>{cat}</Text>
                <Table
                  columns={buildColumns() as any}
                  dataSource={catTableRows}
                  pagination={false}
                  size="small"
                  bordered
                  scroll={{ x: 'max-content' }}
                />
              </div>
            );
          }),
        }]}
      />
    </div>
  );
}

// ─── Main component (stub — metric tabs added in Task 8) ──────────────────────

interface Props {
  data: VarianceReportData;
}

export function VarianceReport({ data }: Props) {
  const [channelFilter, setChannelFilter] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: SPACING.xl }}>
        <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Variance Report
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {data.cycle_name} · {data.brand_name} · {data.planning_quarter}
          {data.actuals_months.length > 0 && (
            <> · Actuals: {data.actuals_months.map(m => shortMonth(m)).join(', ')}</>
          )}
        </Text>
      </div>

      {/* Channel filter — shared across all tabs */}
      <div style={{ marginBottom: SPACING.lg }}>
        <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Channel:</Text>
        <Select
          style={{ width: 180 }}
          placeholder="All Channels"
          allowClear
          value={channelFilter}
          onChange={setChannelFilter}
          options={data.channels.map(c => ({ label: c, value: c }))}
        />
      </div>

      <Tabs
        defaultActiveKey="summary"
        items={[
          {
            key: 'summary',
            label: 'Summary',
            children: <SummaryTab data={data} channelFilter={channelFilter} />,
          },
          // Metric tabs added in Task 8
        ]}
      />
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "VarianceReport"
```

Fix any type errors before proceeding.

**Step 3: Commit**

```bash
git add src/components/VarianceReport.tsx
git commit -m "feat: VarianceReport Summary tab with monthly/Q-total aggregation"
```

---

## Task 8: VarianceReport — Metric drill-down tabs

**Files:**
- Modify: `src/components/VarianceReport.tsx`

**Step 1: Add `MetricTab` component and wire into Tabs**

Add this component to `VarianceReport.tsx` before the main `VarianceReport` export:

```typescript
interface MetricTabProps {
  metricKey: 'gmv' | 'nsv' | 'nsq' | 'inwards' | 'closing_stock' | 'doh';
  data: VarianceReportData;
  channelFilter: string | null;
}

function MetricTab({ metricKey, data, channelFilter }: MetricTabProps) {
  const { all_months, actuals_months, thresholds } = data;

  const filteredRows = useMemo(() => {
    return channelFilter ? data.rows.filter(r => r.channel === channelFilter) : data.rows;
  }, [data.rows, channelFilter]);

  // Sort sub-categories by GMV desc (actual > planned)
  const subCategories = useMemo(() => {
    const cats = new Set(filteredRows.map(r => r.sub_category));
    return Array.from(cats).sort((a, b) => {
      const gmvFor = (cat: string) =>
        filteredRows.filter(r => r.sub_category === cat && actuals_months.includes(r.month))
          .reduce((s, r) => s + (r.gmv.actual ?? r.gmv.planned ?? 0), 0);
      return gmvFor(b) - gmvFor(a);
    });
  }, [filteredRows, actuals_months]);

  const thresholdPct = ({
    gmv: thresholds.gmv_pct, nsv: thresholds.nsv_pct, nsq: thresholds.nsq_pct,
    inwards: thresholds.inwards_pct, closing_stock: thresholds.closing_stock_pct, doh: thresholds.doh_pct,
  } as Record<string, number>)[metricKey];

  const isPosition = POSITION_METRICS.has(metricKey);

  function getMetricForRows(rows: VarianceRow[], forMonth?: string): VarianceMetric {
    const subset = forMonth ? rows.filter(r => r.month === forMonth) : rows;
    const actualsForAgg = forMonth ? [forMonth] : actuals_months;
    return aggregateMetric(subset, metricKey, actualsForAgg, isPosition, thresholdPct);
  }

  // Brand total row + sub-category rows
  const brandTotalMetrics = Object.fromEntries(
    [...all_months.map(m => [m, getMetricForRows(filteredRows, m)]),
     ['q_total', getMetricForRows(filteredRows.filter(r => actuals_months.includes(r.month)))]]
  );

  const subCatMetrics = Object.fromEntries(
    subCategories.map(cat => {
      const catRows = filteredRows.filter(r => r.sub_category === cat);
      return [cat, Object.fromEntries(
        [...all_months.map(m => [m, getMetricForRows(catRows, m)]),
         ['q_total', getMetricForRows(catRows.filter(r => actuals_months.includes(r.month)))]]
      )];
    })
  );

  const qLabel = `Q Total (${actuals_months.length}/${all_months.length} months)`;

  const columns = [
    { title: 'Sub-Category', dataIndex: 'cat', key: 'cat', width: 180,
      render: (v: string, _: unknown, i: number) =>
        i === 0 ? <Text strong>{v}</Text> : <Text>{v}</Text> },
    ...all_months.flatMap(m => [
      { title: `${shortMonth(m)} Plan`, key: `${m}_p`,
        render: (_: unknown, row: { cat: string; isBrand: boolean }) => {
          const metric = row.isBrand ? brandTotalMetrics[m] : subCatMetrics[row.cat]?.[m];
          return <Text type="secondary">{fmtValue(metricKey, metric?.planned ?? null)}</Text>;
        }
      },
      { title: `${shortMonth(m)} Actual`, key: `${m}_a`,
        render: (_: unknown, row: { cat: string; isBrand: boolean }) => {
          if (!actuals_months.includes(m)) return <Text type="secondary">—</Text>;
          const metric = row.isBrand ? brandTotalMetrics[m] : subCatMetrics[row.cat]?.[m];
          return <Text>{fmtValue(metricKey, metric?.actual ?? null)}</Text>;
        }
      },
      { title: `${shortMonth(m)} Var%`, key: `${m}_v`, align: 'right' as const,
        render: (_: unknown, row: { cat: string; isBrand: boolean }) => {
          if (!actuals_months.includes(m)) return <Text type="secondary">—</Text>;
          const metric = row.isBrand ? brandTotalMetrics[m] : subCatMetrics[row.cat]?.[m];
          return metric ? <VarPctCell metric={metric} /> : <Text type="secondary">—</Text>;
        }
      },
    ]),
    { title: `${qLabel} Plan`, key: 'q_p',
      render: (_: unknown, row: { cat: string; isBrand: boolean }) => {
        const metric = row.isBrand ? brandTotalMetrics['q_total'] : subCatMetrics[row.cat]?.['q_total'];
        return <Text type="secondary">{fmtValue(metricKey, metric?.planned ?? null)}</Text>;
      }
    },
    { title: `${qLabel} Actual`, key: 'q_a',
      render: (_: unknown, row: { cat: string; isBrand: boolean }) => {
        const metric = row.isBrand ? brandTotalMetrics['q_total'] : subCatMetrics[row.cat]?.['q_total'];
        return <Text>{fmtValue(metricKey, metric?.actual ?? null)}</Text>;
      }
    },
    { title: `${qLabel} Var%`, key: 'q_v', align: 'right' as const,
      render: (_: unknown, row: { cat: string; isBrand: boolean }) => {
        const metric = row.isBrand ? brandTotalMetrics['q_total'] : subCatMetrics[row.cat]?.['q_total'];
        return metric ? <VarPctCell metric={metric} /> : <Text type="secondary">—</Text>;
      }
    },
  ];

  const tableRows = [
    { key: '__brand__', cat: 'Brand Total', isBrand: true },
    ...subCategories.map(cat => ({ key: cat, cat, isBrand: false })),
  ];

  return (
    <Table
      columns={columns}
      dataSource={tableRows}
      pagination={false}
      size="small"
      bordered
      scroll={{ x: 'max-content' }}
      rowClassName={(_, i) => i === 0 ? 'ant-table-row-brand-total' : ''}
    />
  );
}
```

**Step 2: Update the `VarianceReport` Tabs to include metric tabs**

Replace the `items` array in the main `VarianceReport` component:

```typescript
const METRIC_TAB_KEYS = [
  { key: 'gmv', label: 'GMV' },
  { key: 'nsv', label: 'NSV' },
  { key: 'nsq', label: 'NSQ' },
  { key: 'inwards', label: 'Inwards' },
  { key: 'closing_stock', label: 'Closing Stock' },
  { key: 'doh', label: 'DOH' },
] as const;

// In items array:
items={[
  {
    key: 'summary',
    label: 'Summary',
    children: <SummaryTab data={data} channelFilter={channelFilter} />,
  },
  ...METRIC_TAB_KEYS.map(({ key, label }) => ({
    key,
    label,
    children: <MetricTab metricKey={key} data={data} channelFilter={channelFilter} />,
  })),
]}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "VarianceReport"
```

Fix any errors.

**Step 4: Commit**

```bash
git add src/components/VarianceReport.tsx
git commit -m "feat: VarianceReport metric drill-down tabs (GMV, NSV, NSQ, Inwards, Closing Stock, DOH)"
```

---

## Task 9: Export route — remove PDF, update Excel

**Files:**
- Modify: `src/app/api/cycles/[cycleId]/variance/export/route.ts`

**Step 1: Rewrite the export route**

The export route currently duplicates all the DB fetch logic from `variance/route.ts`. Simplify it by calling the internal variance API, then building the Excel from the result. Key changes:
1. Remove PDF support entirely
2. Remove `?format=` parameter (xlsx only)
3. Rebuild Excel with 7 sheets: Summary + one per metric
4. Update to use new `VarianceReportData` shape

```typescript
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildVarianceMetric } from '@/lib/varianceEngine';
import {
  DEFAULT_VARIANCE_THRESHOLDS,
  type VarianceRow,
  type VarianceReportData,
  type VarianceThresholds,
  type BrandVarianceThreshold,
  METRIC_DIRECTIONS,
} from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// Fill colors for variance levels
const LEVEL_FILLS: Record<string, string> = {
  green: 'FFE8F5E9',
  yellow: 'FFFFF8E1',
  red: 'FFFCE4EC',
};

// GET /api/cycles/:cycleId/variance/export
export const GET = withAuth('view_variance', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;

  // Re-fetch the full variance data (same logic as variance/route.ts)
  // For DRY, this could be extracted to a shared helper — acceptable duplication for now
  const supabase = await createServerClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*, brands(id, name)')
    .eq('id', cycleId)
    .single();

  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

  const brandId = (cycle.brands as { id: string } | null)?.id ?? '';
  const { data: thresholdRows } = await supabase
    .from('brand_variance_thresholds')
    .select('*')
    .eq('brand_id', brandId);

  const thresholds: VarianceThresholds = { ...DEFAULT_VARIANCE_THRESHOLDS };
  for (const row of (thresholdRows ?? []) as BrandVarianceThreshold[]) {
    if (row.metric in thresholds) {
      (thresholds as Record<string, number>)[row.metric] = row.threshold_pct;
    }
  }

  const { data: actuals } = await supabase
    .from('otb_actuals').select('*').eq('cycle_id', cycleId).order('month');

  if (!actuals?.length) return NextResponse.json({ error: 'No actuals' }, { status: 404 });

  const { data: planRows } = await supabase
    .from('otb_plan_rows').select('*').eq('cycle_id', cycleId);

  const rowIds = (planRows ?? []).map((r: any) => r.id);
  const allPlanData: any[] = [];
  for (let i = 0; i < rowIds.length; i += 200) {
    const { data } = await supabase.from('otb_plan_data').select('*').in('row_id', rowIds.slice(i, i + 200));
    if (data) allPlanData.push(...data);
  }

  const planRowById = new Map(planRows?.map((r: any) => [r.id, r]) ?? []);
  const planDataMap = new Map<string, any>();
  const allMonthSet = new Set<string>();

  for (const pd of allPlanData) {
    const row = planRowById.get(pd.row_id);
    if (!row) continue;
    allMonthSet.add(pd.month);
    const key = dimKey(row.sub_brand, row.wear_type, row.sub_category, row.gender, row.channel, pd.month);
    planDataMap.set(key, pd);
  }

  const actualsMonthSet = new Set<string>();
  const varianceRows: VarianceRow[] = [];

  for (const actual of actuals) {
    actualsMonthSet.add(actual.month);
    const planned = planDataMap.get(dimKey(
      actual.sub_brand, actual.wear_type, actual.sub_category,
      actual.gender, actual.channel, actual.month,
    ));
    varianceRows.push({
      sub_brand: actual.sub_brand, wear_type: actual.wear_type,
      sub_category: actual.sub_category, gender: actual.gender,
      channel: actual.channel, month: actual.month,
      nsq: buildVarianceMetric('nsq_pct', actual.actual_nsq, planned?.nsq ?? null, thresholds.nsq_pct),
      gmv: buildVarianceMetric('gmv_pct', actual.actual_gmv, planned?.sales_plan_gmv ?? null, thresholds.gmv_pct),
      nsv: buildVarianceMetric('nsv_pct', actual.actual_nsv, planned?.nsv ?? null, thresholds.nsv_pct),
      inwards: buildVarianceMetric('inwards_pct', actual.actual_inwards_qty, planned?.inwards_qty ?? null, thresholds.inwards_pct),
      closing_stock: buildVarianceMetric('closing_stock_pct', actual.actual_closing_stock_qty, planned?.closing_stock_qty ?? null, thresholds.closing_stock_pct),
      doh: buildVarianceMetric('doh_pct', actual.actual_doh, planned?.fwd_30day_doh ?? null, thresholds.doh_pct),
    });
  }

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OTB Automation';
  workbook.created = new Date();

  // Sheet: Variance Detail (all rows, all 6 metrics)
  const sheet = workbook.addWorksheet('Variance Detail');
  sheet.columns = [
    { header: 'Sub Brand', key: 'sub_brand', width: 15 },
    { header: 'Sub Category', key: 'sub_category', width: 15 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Channel', key: 'channel', width: 12 },
    { header: 'Month', key: 'month', width: 10 },
    { header: 'NSQ Plan', key: 'nsq_p', width: 12 }, { header: 'NSQ Actual', key: 'nsq_a', width: 12 }, { header: 'NSQ Var%', key: 'nsq_v', width: 10 },
    { header: 'GMV Plan', key: 'gmv_p', width: 14 }, { header: 'GMV Actual', key: 'gmv_a', width: 14 }, { header: 'GMV Var%', key: 'gmv_v', width: 10 },
    { header: 'NSV Plan', key: 'nsv_p', width: 14 }, { header: 'NSV Actual', key: 'nsv_a', width: 14 }, { header: 'NSV Var%', key: 'nsv_v', width: 10 },
    { header: 'Inwards Plan', key: 'inw_p', width: 14 }, { header: 'Inwards Actual', key: 'inw_a', width: 14 }, { header: 'Inwards Var%', key: 'inw_v', width: 10 },
    { header: 'Closing Stock Plan', key: 'cs_p', width: 18 }, { header: 'Closing Stock Actual', key: 'cs_a', width: 18 }, { header: 'Closing Stock Var%', key: 'cs_v', width: 14 },
    { header: 'DOH Plan', key: 'doh_p', width: 12 }, { header: 'DOH Actual', key: 'doh_a', width: 12 }, { header: 'DOH Var%', key: 'doh_v', width: 10 },
  ];

  const hdr = sheet.getRow(1);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };

  // Var% column indices (1-based): 8, 11, 14, 17, 20, 23
  const varColIndices = [8, 11, 14, 17, 20, 23];
  const varMetricOrder: Array<keyof VarianceRow> = ['nsq', 'gmv', 'nsv', 'inwards', 'closing_stock', 'doh'];

  for (const row of varianceRows) {
    const dataRow = sheet.addRow({
      sub_brand: row.sub_brand, sub_category: row.sub_category,
      gender: row.gender, channel: row.channel,
      month: new Date(row.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      nsq_p: row.nsq.planned, nsq_a: row.nsq.actual,
      nsq_v: row.nsq.variance_pct != null ? +row.nsq.variance_pct.toFixed(1) : null,
      gmv_p: row.gmv.planned, gmv_a: row.gmv.actual,
      gmv_v: row.gmv.variance_pct != null ? +row.gmv.variance_pct.toFixed(1) : null,
      nsv_p: row.nsv.planned, nsv_a: row.nsv.actual,
      nsv_v: row.nsv.variance_pct != null ? +row.nsv.variance_pct.toFixed(1) : null,
      inw_p: row.inwards.planned, inw_a: row.inwards.actual,
      inw_v: row.inwards.variance_pct != null ? +row.inwards.variance_pct.toFixed(1) : null,
      cs_p: row.closing_stock.planned, cs_a: row.closing_stock.actual,
      cs_v: row.closing_stock.variance_pct != null ? +row.closing_stock.variance_pct.toFixed(1) : null,
      doh_p: row.doh.planned, doh_a: row.doh.actual,
      doh_v: row.doh.variance_pct != null ? +row.doh.variance_pct.toFixed(1) : null,
    });

    // Color var% cells
    varColIndices.forEach((colIdx, i) => {
      const metricKey = varMetricOrder[i];
      const metric = row[metricKey] as { level: string };
      const cell = dataRow.getCell(colIdx);
      if (LEVEL_FILLS[metric.level]) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LEVEL_FILLS[metric.level] } };
      }
    });
  }

  const safeFileName = cycle.cycle_name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="variance_${safeFileName}.xlsx"`,
    },
  });
});

function dimKey(sb: string, wt: string, sc: string, g: string, ch: string, m: string): string {
  return `${sb}|${wt}|${sc}|${g}|${ch}|${m}`.toLowerCase();
}
```

**Step 2: Update the variance page to remove PDF export button**

In `src/app/cycles/[cycleId]/variance/page.tsx`, remove the PDF export button and update the Excel button URL (remove `?format=xlsx`):

```typescript
// Remove:
<Button icon={<DownloadOutlined />} href={`/api/cycles/${cycleId}/variance/export?format=pdf`}>
  Export PDF
</Button>

// Update to:
<Button icon={<DownloadOutlined />} href={`/api/cycles/${cycleId}/variance/export`}>
  Export Excel
</Button>
```

**Step 3: TypeScript check and build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/api/cycles/[cycleId]/variance/export/route.ts src/app/cycles/[cycleId]/variance/page.tsx
git commit -m "feat: remove PDF export, update variance Excel export to 6-metric schema"
```

---

## Task 10: Final check

**Step 1: Run all unit tests**

```bash
cd otb-automation
npx vitest run
```

Expected: all PASS.

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: 0 errors.

**Step 3: Run lint**

```bash
npm run lint 2>&1 | head -30
```

Fix any lint errors.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: variance report redesign — CXO monthly view, direction-aware RAG, per-brand thresholds"
```
