# Sprint 9-10: Actuals Upload, Variance Reports & Export

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Planning Team to upload actual performance data (NSQ + Inwards Qty), auto-recalculate derived metrics from actuals using the existing formula chain, generate plan-vs-actual variance reports with threshold-based color coding, and provide CSV/PDF export for OTB plans and variance reports. Also add version revert capability.

**Architecture:** Actuals are stored in a new `otb_actuals` table linked to approved OTB cycles. The existing 11-step formula engine is reused to derive actual GMV, NSV, Closing Stock, DoH, GM%, CM1, CM2 from uploaded actual NSQ and actual Inwards Qty. A pure-function variance engine computes percentage deviations and classifies them against PRD-defined thresholds. The variance report UI uses Ant Design tables with conditional cell styling for Green/Yellow/Red indicators.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL), ExcelJS (Excel export), jsPDF + jspdf-autotable (PDF export), Vitest (unit tests), existing formula engine

**PRD Reference:** `OTB_Automation_PRD_Phase1_V2.md` — Sections 10 (FR-5.1, FR-5.2), 11.3 (Export), 15.2 (Sprint 9-10)

**Prerequisites:** Sprints 1-8 complete — file upload, OTB grid, GD input, submission, auth/RBAC, approval workflow, cross-brand summary, comments, OTB plan Excel export, audit log CSV export all working.

---

## What's Already Built (from previous sprints)

- **OTB Plan Excel export** — `src/lib/exportEngine.ts` + `src/app/api/cycles/[cycleId]/export/route.ts`
- **Audit Log CSV export** — `src/app/api/admin/audit-logs/export/route.ts`
- **Formula engine** — `src/lib/formulaEngine.ts` (11-step chain, pure functions)
- **Upload validator** — `src/lib/uploadValidator.ts` (extendable for actuals file type)
- **Version history** — `version_history` table + `src/app/api/cycles/[cycleId]/versions/route.ts`
- **RBAC permissions** — `upload_actuals` and `view_variance` already defined in `src/lib/auth/roles.ts`

## What Needs to Be Built

1. **Database migration** — `otb_actuals` table
2. **Actuals upload** — file validation, API endpoint, UI page
3. **Actuals recalculation** — reuse formula engine on actual inputs
4. **Variance engine** — pure functions for variance calculation + thresholds
5. **Variance report API + UI** — plan vs actual with color coding, multiple views
6. **CSV export** — OTB plan as CSV
7. **PDF export** — OTB plan + variance report as PDF
8. **Variance report export** — Excel + PDF
9. **Version revert** — API + UI for reverting to a previous version

---

## Tasks

### Sprint 9: Actuals & Variance Engine (Tasks 1-10)

#### Task 1: Actuals & Variance Types

**Files:**
- Modify: `src/types/otb.ts`

**Step 1: Add actuals and variance types to otb.ts**

Add the following types at the end of the file:

```typescript
// === Actuals & Variance Types ===

export interface ActualsRow {
  id: string;
  cycle_id: string;
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  month: string;
  actual_nsq: number;
  actual_inwards_qty: number;
  // Recalculated from actuals
  actual_gmv: number | null;
  actual_nsv: number | null;
  actual_closing_stock_qty: number | null;
  actual_doh: number | null;
  actual_gm_pct: number | null;
  actual_cm1: number | null;
  actual_cm2: number | null;
  uploaded_at: string;
  uploaded_by: string;
}

export type VarianceLevel = 'green' | 'yellow' | 'red';

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
  inwards: VarianceMetric;
  closing_stock: VarianceMetric;
}

export interface VarianceThresholds {
  nsq_pct: number;          // ±15%
  gmv_pct: number;          // ±15%
  inwards_pct: number;      // ±20%
  closing_stock_pct: number; // ±25%
}

export const DEFAULT_VARIANCE_THRESHOLDS: VarianceThresholds = {
  nsq_pct: 15,
  gmv_pct: 15,
  inwards_pct: 20,
  closing_stock_pct: 25,
};

export interface VarianceReportData {
  cycle_id: string;
  cycle_name: string;
  brand_name: string;
  planning_quarter: string;
  months: string[];
  rows: VarianceRow[];
  summary: VarianceSummary;
}

export interface VarianceSummary {
  total_rows: number;
  red_count: number;
  yellow_count: number;
  green_count: number;
  top_variances: VarianceRow[]; // Top 10 by magnitude
}
```

**Step 2: Commit**

```bash
git add src/types/otb.ts
git commit -m "feat: add actuals and variance types"
```

**Depends on:** Nothing

---

#### Task 2: Variance Engine (Pure Functions)

**Files:**
- Create: `src/lib/varianceEngine.ts`
- Create: `tests/unit/varianceEngine.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/varianceEngine.test.ts
import { describe, it, expect } from 'vitest';
import {
  calcVariancePct,
  classifyVariance,
  buildVarianceMetric,
  calcActualDerived,
  getTopVariances,
} from '@/lib/varianceEngine';
import type { VarianceRow } from '@/types/otb';

describe('calcVariancePct', () => {
  it('returns percentage variance', () => {
    expect(calcVariancePct(115, 100)).toBeCloseTo(15);
  });
  it('returns negative variance', () => {
    expect(calcVariancePct(85, 100)).toBeCloseTo(-15);
  });
  it('returns null when planned is 0', () => {
    expect(calcVariancePct(10, 0)).toBeNull();
  });
  it('returns null when planned is null', () => {
    expect(calcVariancePct(10, null)).toBeNull();
  });
  it('returns null when actual is null', () => {
    expect(calcVariancePct(null, 100)).toBeNull();
  });
});

describe('classifyVariance', () => {
  it('green when within threshold', () => {
    expect(classifyVariance(10, 15)).toBe('green');
  });
  it('yellow when at threshold boundary', () => {
    expect(classifyVariance(15, 15)).toBe('yellow');
  });
  it('red when exceeds threshold', () => {
    expect(classifyVariance(20, 15)).toBe('red');
  });
  it('handles negative variance', () => {
    expect(classifyVariance(-20, 15)).toBe('red');
  });
  it('green when variance is null', () => {
    expect(classifyVariance(null, 15)).toBe('green');
  });
});

describe('buildVarianceMetric', () => {
  it('builds a complete variance metric', () => {
    const result = buildVarianceMetric('NSQ', 115, 100, 15);
    expect(result.metric).toBe('NSQ');
    expect(result.planned).toBe(100);
    expect(result.actual).toBe(115);
    expect(result.variance_pct).toBeCloseTo(15);
    expect(result.level).toBe('yellow');
  });
});

describe('calcActualDerived', () => {
  it('calculates actual GMV from actual NSQ and ASP', () => {
    const result = calcActualDerived({
      actualNsq: 100,
      actualInwardsQty: 50,
      asp: 500,
      cogs: 200,
      openingStockQty: 80,
      returnPct: 10,
      taxPct: 5,
      sellexPct: 8,
      nextMonthActualNsq: 120,
    });
    expect(result.actualGmv).toBe(50000); // 100 * 500
    expect(result.actualClosingStockQty).toBe(30); // 80 + 50 - 100
    expect(result.actualGmPct).toBeCloseTo(60); // (500-200)/500 * 100
  });

  it('returns nulls when inputs are null', () => {
    const result = calcActualDerived({
      actualNsq: null,
      actualInwardsQty: null,
      asp: null,
      cogs: null,
      openingStockQty: null,
      returnPct: null,
      taxPct: null,
      sellexPct: null,
      nextMonthActualNsq: null,
    });
    expect(result.actualGmv).toBeNull();
    expect(result.actualNsv).toBeNull();
  });
});

describe('getTopVariances', () => {
  it('returns top N rows by max absolute variance', () => {
    const rows: VarianceRow[] = [
      makeVarianceRow('A', 50), // max var = 50%
      makeVarianceRow('B', 10), // max var = 10%
      makeVarianceRow('C', 30), // max var = 30%
    ];
    const top = getTopVariances(rows, 2);
    expect(top).toHaveLength(2);
    expect(top[0].sub_category).toBe('A');
    expect(top[1].sub_category).toBe('C');
  });
});

function makeVarianceRow(subCat: string, variancePct: number): VarianceRow {
  const metric = {
    metric: 'NSQ',
    planned: 100,
    actual: 100 + variancePct,
    variance_pct: variancePct,
    level: 'red' as const,
  };
  return {
    sub_brand: 'test',
    wear_type: 'NWW',
    sub_category: subCat,
    gender: 'male',
    channel: 'myntra_sor',
    month: '2026-01-01',
    nsq: metric,
    gmv: { ...metric, metric: 'GMV' },
    inwards: { ...metric, metric: 'Inwards', variance_pct: 0, level: 'green' },
    closing_stock: { ...metric, metric: 'Closing Stock', variance_pct: 0, level: 'green' },
  };
}
```

**Step 2: Run tests to verify they fail**

Run: `cd otb-automation && npx vitest run tests/unit/varianceEngine.test.ts`
Expected: FAIL — module not found

**Step 3: Implement variance engine**

```typescript
// src/lib/varianceEngine.ts
import type { VarianceLevel, VarianceMetric, VarianceRow } from '@/types/otb';
import {
  calcSalesPlanGmv,
  calcNsv,
  calcClosingStockQty,
  calcFwd30dayDoh,
  calcGmPct,
  calcCm1Pct,
} from './formulaEngine';

/** (Actual - Planned) / Planned × 100 */
export function calcVariancePct(
  actual: number | null,
  planned: number | null,
): number | null {
  if (actual == null || planned == null || planned === 0) return null;
  return ((actual - planned) / planned) * 100;
}

/** Classify variance against threshold: green < threshold, yellow = threshold, red > threshold */
export function classifyVariance(
  variancePct: number | null,
  thresholdPct: number,
): VarianceLevel {
  if (variancePct == null) return 'green';
  const abs = Math.abs(variancePct);
  if (abs < thresholdPct) return 'green';
  if (abs <= thresholdPct * 1.0) return 'yellow'; // at boundary
  return 'red';
}

/** Build a single variance metric object */
export function buildVarianceMetric(
  metric: string,
  actual: number | null,
  planned: number | null,
  thresholdPct: number,
): VarianceMetric {
  const variance_pct = calcVariancePct(actual, planned);
  return {
    metric,
    planned,
    actual,
    variance_pct,
    level: classifyVariance(variance_pct, thresholdPct),
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
  sellexPct: number | null;
  nextMonthActualNsq: number | null;
}

export interface ActualDerivedOutputs {
  actualGmv: number | null;
  actualNsv: number | null;
  actualClosingStockQty: number | null;
  actualDoh: number | null;
  actualGmPct: number | null;
  actualCm1: number | null;
}

/** Recalculate derived metrics from actuals using the same formula chain */
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
  const actualCm1 = calcCm1Pct(actualGmPct, inputs.sellexPct);

  return { actualGmv, actualNsv, actualClosingStockQty, actualDoh, actualGmPct, actualCm1 };
}

/** Get the maximum absolute variance percentage from a VarianceRow */
function maxAbsVariance(row: VarianceRow): number {
  const values = [
    row.nsq.variance_pct,
    row.gmv.variance_pct,
    row.inwards.variance_pct,
    row.closing_stock.variance_pct,
  ];
  return Math.max(...values.map(v => Math.abs(v ?? 0)));
}

/** Return top N variance rows sorted by max absolute variance descending */
export function getTopVariances(rows: VarianceRow[], n: number): VarianceRow[] {
  return [...rows]
    .sort((a, b) => maxAbsVariance(b) - maxAbsVariance(a))
    .slice(0, n);
}
```

**Step 4: Run tests to verify they pass**

Run: `cd otb-automation && npx vitest run tests/unit/varianceEngine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/varianceEngine.ts tests/unit/varianceEngine.test.ts
git commit -m "feat: add variance engine with threshold classification"
```

**Depends on:** Task 1

---

#### Task 3: Database Migration 011 — Actuals Table

**Files:**
- Create: `supabase/migrations/011_actuals.sql`

**Step 1: Write the migration**

```sql
-- otb_actuals: stores actual performance data uploaded by Planning Team
CREATE TABLE otb_actuals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES otb_cycles(id) ON DELETE CASCADE,
  sub_brand TEXT NOT NULL,
  wear_type TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  gender TEXT NOT NULL,
  channel TEXT NOT NULL,
  month DATE NOT NULL,
  -- Uploaded actuals (2 fields)
  actual_nsq INT NOT NULL,
  actual_inwards_qty INT NOT NULL,
  -- Recalculated from actuals using formula chain
  actual_gmv NUMERIC(15,2),
  actual_nsv NUMERIC(15,2),
  actual_closing_stock_qty INT,
  actual_doh NUMERIC(8,2),
  actual_gm_pct NUMERIC(5,2),
  actual_cm1 NUMERIC(15,2),
  actual_cm2 NUMERIC(15,2),
  -- Metadata
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  -- One actual per dimension combo per month per cycle
  UNIQUE(cycle_id, sub_brand, wear_type, sub_category, gender, channel, month)
);

-- Indexes
CREATE INDEX idx_actuals_cycle ON otb_actuals(cycle_id);
CREATE INDEX idx_actuals_month ON otb_actuals(cycle_id, month);

-- RLS
ALTER TABLE otb_actuals ENABLE ROW LEVEL SECURITY;

-- Planning, Admin can insert/update actuals
CREATE POLICY actuals_insert ON otb_actuals
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Admin', 'Planning')
    )
  );

CREATE POLICY actuals_update ON otb_actuals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Admin', 'Planning')
    )
  );

-- All authenticated users can read actuals (view_variance permission checked at API layer)
CREATE POLICY actuals_select ON otb_actuals
  FOR SELECT TO authenticated
  USING (true);
```

**Step 2: Run migration**

Run: `cd otb-automation && npx supabase db reset`
Expected: All migrations apply successfully

**Step 3: Commit**

```bash
git add supabase/migrations/011_actuals.sql
git commit -m "feat: add otb_actuals table migration"
```

**Depends on:** Nothing

---

#### Task 4: Actuals File Validator

**Files:**
- Modify: `src/types/otb.ts` — Add `'actuals'` to FileType union
- Modify: `src/lib/uploadValidator.ts` — Add actuals schema

**Step 1: Update FileType in otb.ts**

Add `'actuals'` to the `FileType` union type. Update `ALL_FILE_TYPES` and `FILE_TYPE_LABELS`:

```typescript
export type FileType =
  | 'opening_stock'
  | 'ly_sales' | 'recent_sales'
  | 'soft_forecast'
  | 'actuals';

export const ALL_FILE_TYPES: FileType[] = [
  ...REQUIRED_FILE_TYPES,
  'soft_forecast',
  'actuals',
];

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  opening_stock: 'Opening Stock',
  ly_sales: 'LY Sales',
  recent_sales: 'Recent Sales (3M)',
  soft_forecast: 'Soft Forecast (Optional)',
  actuals: 'Actuals (NSQ + Inwards)',
};
```

**Step 2: Add actuals schema to uploadValidator.ts**

Add to `FILE_SCHEMAS`:

```typescript
actuals: {
  fileType: 'actuals',
  requiredColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month', 'actual_nsq', 'actual_inwards_qty'],
  dimensionColumns: ['sub_brand', 'sub_category', 'gender', 'channel', 'month'],
  numericColumns: ['actual_nsq', 'actual_inwards_qty'],
  percentColumns: [],
},
```

**Step 3: Write unit test for actuals validation**

Add to `tests/unit/uploadValidator.test.ts`:

```typescript
describe('actuals validation', () => {
  const masterData: MasterDataContext = {
    subBrands: new Set(['bewakoof']),
    subCategories: new Set(['t-shirts']),
    channels: new Set(['myntra_sor']),
    genders: new Set(['male']),
    mappings: new Map(),
  };

  it('validates valid actuals rows', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 't-shirts', gender: 'male', channel: 'myntra_sor', month: '2026-01-01', actual_nsq: '100', actual_inwards_qty: '50' },
    ];
    const result = validateUpload('actuals', rows, masterData);
    expect(result.valid).toBe(true);
    expect(result.normalizedRows).toHaveLength(1);
  });

  it('rejects negative actual_nsq', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 't-shirts', gender: 'male', channel: 'myntra_sor', month: '2026-01-01', actual_nsq: '-5', actual_inwards_qty: '50' },
    ];
    const result = validateUpload('actuals', rows, masterData);
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('V-001');
  });
});
```

**Step 4: Run tests**

Run: `cd otb-automation && npx vitest run tests/unit/uploadValidator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/otb.ts src/lib/uploadValidator.ts tests/unit/uploadValidator.test.ts
git commit -m "feat: add actuals file type and validation schema"
```

**Depends on:** Task 1

---

#### Task 5: Actuals Upload API Endpoint

**Files:**
- Create: `src/app/api/cycles/[cycleId]/actuals/upload/route.ts`

**Step 1: Implement the endpoint**

```typescript
// src/app/api/cycles/[cycleId]/actuals/upload/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { parseCsv } from '@/lib/fileParser';
import { validateUpload } from '@/lib/uploadValidator';
import { calcActualDerived } from '@/lib/varianceEngine';
import { logAuditEvent } from '@/lib/auth/auditLogger';
import type { MasterDataContext } from '@/lib/uploadValidator';

type Params = { params: Promise<{ cycleId: string }> };

export const POST = withAuth('upload_actuals', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  // Verify cycle exists and is Approved
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status, brand_id')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  if (cycle.status !== 'Approved') {
    return NextResponse.json(
      { error: 'Actuals can only be uploaded for approved cycles' },
      { status: 400 },
    );
  }

  // Parse uploaded file
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);

  // Build master data context for validation
  const [subBrandsRes, subCatsRes, channelsRes, gendersRes, mappingsRes] = await Promise.all([
    supabase.from('sub_brands').select('name').eq('brand_id', cycle.brand_id),
    supabase.from('sub_categories').select('name').eq('brand_id', cycle.brand_id),
    supabase.from('channels').select('name').eq('brand_id', cycle.brand_id),
    supabase.from('genders').select('name').eq('brand_id', cycle.brand_id),
    supabase.from('master_mappings').select('*'),
  ]);

  const masterData: MasterDataContext = {
    subBrands: new Set((subBrandsRes.data || []).map(r => r.name.toLowerCase())),
    subCategories: new Set((subCatsRes.data || []).map(r => r.name.toLowerCase())),
    channels: new Set((channelsRes.data || []).map(r => r.name.toLowerCase())),
    genders: new Set((gendersRes.data || []).map(r => r.name.toLowerCase())),
    mappings: new Map(
      (mappingsRes.data || []).map(m => [`${m.mapping_type}:${m.raw_value.toLowerCase()}`, m.standard_value.toLowerCase()]),
    ),
  };

  // Validate
  const validation = validateUpload('actuals', rows, masterData);
  if (!validation.valid) {
    return NextResponse.json({ valid: false, errors: validation.errors }, { status: 400 });
  }

  // Get plan rows + plan data for reference data (ASP, COGS, etc.) needed for recalculation
  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('id, sub_brand, wear_type, sub_category, gender, channel')
    .eq('cycle_id', cycleId);

  const planRowMap = new Map<string, string>(); // dimKey → row_id
  for (const pr of planRows || []) {
    const key = [pr.sub_brand, pr.sub_category, pr.gender, pr.channel].join('|').toLowerCase();
    planRowMap.set(key, pr.id);
  }

  // Get plan data for reference values
  const rowIds = (planRows || []).map(r => r.id);
  let planDataMap: Record<string, Record<string, any>> = {};
  if (rowIds.length > 0) {
    const { data: planData } = await supabase
      .from('otb_plan_data')
      .select('row_id, month, asp, cogs, opening_stock_qty, return_pct, tax_pct, sellex_pct')
      .in('row_id', rowIds);

    for (const pd of planData || []) {
      const key = `${pd.row_id}|${pd.month}`;
      planDataMap[key] = pd;
    }
  }

  // Build actuals rows with recalculated fields
  const actualsToInsert = [];
  const unmatchedRows: number[] = [];

  for (let i = 0; i < validation.normalizedRows.length; i++) {
    const row = validation.normalizedRows[i];
    const dimKey = [row.sub_brand, row.sub_category, row.gender, row.channel]
      .map(v => String(v).toLowerCase())
      .join('|');

    // Find matching plan row to get wear_type and reference data
    const matchingPlanRow = (planRows || []).find(pr =>
      pr.sub_brand.toLowerCase() === String(row.sub_brand).toLowerCase() &&
      pr.sub_category.toLowerCase() === String(row.sub_category).toLowerCase() &&
      pr.gender.toLowerCase() === String(row.gender).toLowerCase() &&
      pr.channel.toLowerCase() === String(row.channel).toLowerCase()
    );

    if (!matchingPlanRow) {
      unmatchedRows.push(i + 2);
      continue;
    }

    const month = String(row.month);
    const planDataKey = `${matchingPlanRow.id}|${month}`;
    const refData = planDataMap[planDataKey] || {};

    const actualNsq = Number(row.actual_nsq);
    const actualInwardsQty = Number(row.actual_inwards_qty);

    // Recalculate derived metrics
    const derived = calcActualDerived({
      actualNsq,
      actualInwardsQty,
      asp: refData.asp ?? null,
      cogs: refData.cogs ?? null,
      openingStockQty: refData.opening_stock_qty ?? null,
      returnPct: refData.return_pct ?? null,
      taxPct: refData.tax_pct ?? null,
      sellexPct: refData.sellex_pct ?? null,
      nextMonthActualNsq: null, // Will be updated in a second pass
    });

    actualsToInsert.push({
      cycle_id: cycleId,
      sub_brand: String(row.sub_brand),
      wear_type: matchingPlanRow.wear_type,
      sub_category: String(row.sub_category),
      gender: String(row.gender),
      channel: String(row.channel),
      month,
      actual_nsq: actualNsq,
      actual_inwards_qty: actualInwardsQty,
      actual_gmv: derived.actualGmv,
      actual_nsv: derived.actualNsv,
      actual_closing_stock_qty: derived.actualClosingStockQty,
      actual_doh: derived.actualDoh,
      actual_gm_pct: derived.actualGmPct,
      actual_cm1: derived.actualCm1,
      actual_cm2: null, // CM2 needs perf_marketing_pct which is a plan input
      uploaded_by: auth.user.id,
    });
  }

  // Upsert actuals (replace existing for same dimension+month)
  const { error } = await supabase
    .from('otb_actuals')
    .upsert(actualsToInsert, {
      onConflict: 'cycle_id,sub_brand,wear_type,sub_category,gender,channel,month',
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await logAuditEvent(supabase, {
    entityType: 'otb_actuals',
    entityId: cycleId,
    action: 'UPLOAD_ACTUALS',
    userId: auth.user.id,
    changes: { rows_uploaded: actualsToInsert.length, unmatched_rows: unmatchedRows.length },
  });

  return NextResponse.json({
    success: true,
    rows_uploaded: actualsToInsert.length,
    unmatched_rows: unmatchedRows,
  });
});
```

**Step 2: Commit**

```bash
git add src/app/api/cycles/[cycleId]/actuals/upload/route.ts
git commit -m "feat: add actuals upload API endpoint with recalculation"
```

**Depends on:** Tasks 2, 3, 4

---

#### Task 6: Variance Report API Endpoint

**Files:**
- Create: `src/app/api/cycles/[cycleId]/variance/route.ts`

**Step 1: Implement the endpoint**

```typescript
// src/app/api/cycles/[cycleId]/variance/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildVarianceMetric, getTopVariances } from '@/lib/varianceEngine';
import { DEFAULT_VARIANCE_THRESHOLDS } from '@/types/otb';
import type { VarianceRow, VarianceSummary } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

export const GET = withAuth('view_variance', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  // Get cycle info
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*, brands(name)')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  // Get plan rows + plan data
  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('id, sub_brand, wear_type, sub_category, gender, channel')
    .eq('cycle_id', cycleId);

  const rowIds = (planRows || []).map(r => r.id);
  let planDataList: any[] = [];
  if (rowIds.length > 0) {
    const { data } = await supabase
      .from('otb_plan_data')
      .select('row_id, month, nsq, inwards_qty, sales_plan_gmv, closing_stock_qty')
      .in('row_id', rowIds);
    planDataList = data || [];
  }

  // Build plan data lookup: rowId|month → { nsq, inwards_qty, gmv, closing_stock }
  const planLookup = new Map<string, any>();
  for (const pd of planDataList) {
    planLookup.set(`${pd.row_id}|${pd.month}`, pd);
  }

  // Plan row lookup by dim key
  const planRowByDim = new Map<string, any>();
  for (const pr of planRows || []) {
    const key = [pr.sub_brand, pr.wear_type, pr.sub_category, pr.gender, pr.channel]
      .join('|').toLowerCase();
    planRowByDim.set(key, pr);
  }

  // Get actuals
  const { data: actuals } = await supabase
    .from('otb_actuals')
    .select('*')
    .eq('cycle_id', cycleId);

  if (!actuals || actuals.length === 0) {
    return NextResponse.json({ error: 'No actuals uploaded for this cycle' }, { status: 404 });
  }

  // Build variance rows
  const months = new Set<string>();
  const varianceRows: VarianceRow[] = [];
  const thresholds = DEFAULT_VARIANCE_THRESHOLDS;

  for (const actual of actuals) {
    months.add(actual.month);

    const dimKey = [actual.sub_brand, actual.wear_type, actual.sub_category, actual.gender, actual.channel]
      .join('|').toLowerCase();
    const planRow = planRowByDim.get(dimKey);
    if (!planRow) continue;

    const planData = planLookup.get(`${planRow.id}|${actual.month}`);
    const plannedNsq = planData?.nsq ?? null;
    const plannedGmv = planData?.sales_plan_gmv ?? null;
    const plannedInwards = planData?.inwards_qty ?? null;
    const plannedClosingStock = planData?.closing_stock_qty ?? null;

    varianceRows.push({
      sub_brand: actual.sub_brand,
      wear_type: actual.wear_type,
      sub_category: actual.sub_category,
      gender: actual.gender,
      channel: actual.channel,
      month: actual.month,
      nsq: buildVarianceMetric('NSQ', actual.actual_nsq, plannedNsq, thresholds.nsq_pct),
      gmv: buildVarianceMetric('GMV', actual.actual_gmv, plannedGmv, thresholds.gmv_pct),
      inwards: buildVarianceMetric('Inwards', actual.actual_inwards_qty, plannedInwards, thresholds.inwards_pct),
      closing_stock: buildVarianceMetric('Closing Stock', actual.actual_closing_stock_qty, plannedClosingStock, thresholds.closing_stock_pct),
    });
  }

  // Summary
  let redCount = 0, yellowCount = 0, greenCount = 0;
  for (const row of varianceRows) {
    for (const m of [row.nsq, row.gmv, row.inwards, row.closing_stock]) {
      if (m.level === 'red') redCount++;
      else if (m.level === 'yellow') yellowCount++;
      else greenCount++;
    }
  }

  const summary: VarianceSummary = {
    total_rows: varianceRows.length,
    red_count: redCount,
    yellow_count: yellowCount,
    green_count: greenCount,
    top_variances: getTopVariances(varianceRows, 10),
  };

  return NextResponse.json({
    cycle_id: cycleId,
    cycle_name: cycle.cycle_name,
    brand_name: (cycle.brands as any)?.name || 'Unknown',
    planning_quarter: cycle.planning_quarter,
    months: Array.from(months).sort(),
    rows: varianceRows,
    summary,
  });
});
```

**Step 2: Commit**

```bash
git add src/app/api/cycles/[cycleId]/variance/route.ts
git commit -m "feat: add variance report API endpoint"
```

**Depends on:** Tasks 2, 3

---

#### Task 7: Actuals Upload UI Page

**Files:**
- Create: `src/app/cycles/[cycleId]/actuals/page.tsx`

**Step 1: Implement the upload page**

```tsx
// src/app/cycles/[cycleId]/actuals/page.tsx
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, Button, Card, Alert, Typography, Table, Space, message } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

const { Title, Text } = Typography;

export default function ActualsUploadPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errors, setErrors] = useState<any[]>([]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setResult(null);
    setErrors([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/cycles/${cycleId}/actuals/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          message.error(data.error || 'Upload failed');
        }
        return;
      }

      setResult(data);
      message.success(`${data.rows_uploaded} actuals rows uploaded successfully`);
    } catch (err) {
      message.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const errorColumns = [
    { title: 'Row', dataIndex: 'row', key: 'row', width: 80 },
    { title: 'Field', dataIndex: 'field', key: 'field', width: 150 },
    { title: 'Rule', dataIndex: 'rule', key: 'rule', width: 80 },
    { title: 'Message', dataIndex: 'message', key: 'message' },
  ];

  return (
    <ProtectedRoute permission="upload_actuals">
      <AppLayout>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={3}>Upload Actuals</Title>

          <Card title="Actuals File Upload">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Text>
                Upload a CSV file with columns: <code>sub_brand, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty</code>
              </Text>
              <Text type="secondary">
                Month format: YYYY-MM-DD (first day of month, e.g., 2026-01-01).
                Only approved cycles accept actuals uploads.
              </Text>

              <Upload.Dragger
                accept=".csv,.xlsx"
                maxCount={1}
                beforeUpload={(file) => {
                  handleUpload(file);
                  return false;
                }}
                showUploadList={false}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">Click or drag CSV file to upload</p>
              </Upload.Dragger>

              {uploading && <Alert message="Uploading and validating..." type="info" showIcon />}

              {result && (
                <Alert
                  message={`Upload successful: ${result.rows_uploaded} rows processed`}
                  description={
                    result.unmatched_rows?.length > 0
                      ? `${result.unmatched_rows.length} rows could not be matched to plan dimensions (rows: ${result.unmatched_rows.join(', ')})`
                      : undefined
                  }
                  type="success"
                  showIcon
                  action={
                    <Button
                      type="primary"
                      onClick={() => router.push(`/cycles/${cycleId}/variance`)}
                    >
                      View Variance Report
                    </Button>
                  }
                />
              )}

              {errors.length > 0 && (
                <>
                  <Alert
                    message={`Validation failed: ${errors.length} error(s)`}
                    type="error"
                    showIcon
                  />
                  <Table
                    dataSource={errors}
                    columns={errorColumns}
                    rowKey={(_, i) => String(i)}
                    size="small"
                    pagination={{ pageSize: 20 }}
                  />
                </>
              )}
            </Space>
          </Card>
        </Space>
      </AppLayout>
    </ProtectedRoute>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/cycles/[cycleId]/actuals/page.tsx
git commit -m "feat: add actuals upload UI page"
```

**Depends on:** Task 5

---

#### Task 8: Variance Report UI Page

**Files:**
- Create: `src/app/cycles/[cycleId]/variance/page.tsx`
- Create: `src/components/VarianceReport.tsx`

**Step 1: Create the VarianceReport component**

```tsx
// src/components/VarianceReport.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, Table, Tag, Tabs, Statistic, Row, Col, Select, Typography, Space, Empty } from 'antd';
import { WarningOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { VarianceReportData, VarianceRow, VarianceMetric, VarianceLevel } from '@/types/otb';
import { formatCrore, formatPct, formatQty } from '@/lib/formatting';

const { Title } = Typography;

function levelColor(level: VarianceLevel): string {
  if (level === 'red') return '#ff4d4f';
  if (level === 'yellow') return '#faad14';
  return '#52c41a';
}

function levelTag(level: VarianceLevel) {
  if (level === 'red') return <Tag color="error" icon={<CloseCircleOutlined />}>Exceeds</Tag>;
  if (level === 'yellow') return <Tag color="warning" icon={<WarningOutlined />}>Near</Tag>;
  return <Tag color="success" icon={<CheckCircleOutlined />}>OK</Tag>;
}

function formatMetricCell(metric: VarianceMetric) {
  return (
    <div style={{ color: levelColor(metric.level) }}>
      <div>{metric.variance_pct != null ? `${metric.variance_pct > 0 ? '+' : ''}${metric.variance_pct.toFixed(1)}%` : '—'}</div>
      <div style={{ fontSize: 11, opacity: 0.7 }}>
        P: {metric.planned != null ? metric.planned.toLocaleString() : '—'} / A: {metric.actual != null ? metric.actual.toLocaleString() : '—'}
      </div>
    </div>
  );
}

interface Props {
  data: VarianceReportData;
}

export default function VarianceReport({ data }: Props) {
  const [monthFilter, setMonthFilter] = useState<string | 'all'>('all');
  const [subCatFilter, setSubCatFilter] = useState<string | 'all'>('all');

  const filteredRows = data.rows.filter(row => {
    if (monthFilter !== 'all' && row.month !== monthFilter) return false;
    if (subCatFilter !== 'all' && row.sub_category !== subCatFilter) return false;
    return true;
  });

  const subCategories = [...new Set(data.rows.map(r => r.sub_category))].sort();

  const columns = [
    { title: 'Sub Brand', dataIndex: 'sub_brand', key: 'sub_brand', width: 120 },
    { title: 'Sub Category', dataIndex: 'sub_category', key: 'sub_category', width: 120 },
    { title: 'Gender', dataIndex: 'gender', key: 'gender', width: 80 },
    { title: 'Channel', dataIndex: 'channel', key: 'channel', width: 120 },
    { title: 'Month', dataIndex: 'month', key: 'month', width: 100,
      render: (v: string) => new Date(v).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    },
    {
      title: 'NSQ Var %', key: 'nsq',
      render: (_: any, row: VarianceRow) => formatMetricCell(row.nsq),
      sorter: (a: VarianceRow, b: VarianceRow) => (a.nsq.variance_pct ?? 0) - (b.nsq.variance_pct ?? 0),
    },
    {
      title: 'GMV Var %', key: 'gmv',
      render: (_: any, row: VarianceRow) => formatMetricCell(row.gmv),
      sorter: (a: VarianceRow, b: VarianceRow) => (a.gmv.variance_pct ?? 0) - (b.gmv.variance_pct ?? 0),
    },
    {
      title: 'Inwards Var %', key: 'inwards',
      render: (_: any, row: VarianceRow) => formatMetricCell(row.inwards),
      sorter: (a: VarianceRow, b: VarianceRow) => (a.inwards.variance_pct ?? 0) - (b.inwards.variance_pct ?? 0),
    },
    {
      title: 'Closing Stock Var %', key: 'closing_stock',
      render: (_: any, row: VarianceRow) => formatMetricCell(row.closing_stock),
      sorter: (a: VarianceRow, b: VarianceRow) => (a.closing_stock.variance_pct ?? 0) - (b.closing_stock.variance_pct ?? 0),
    },
  ];

  const topVarianceColumns = [...columns]; // Same columns for top variances

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Summary Cards */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Rows" value={data.summary.total_rows} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Within Threshold"
              value={data.summary.green_count}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Near Threshold"
              value={data.summary.yellow_count}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Exceeds Threshold"
              value={data.summary.red_count}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small">
        <Space>
          <Select
            style={{ width: 160 }}
            value={monthFilter}
            onChange={setMonthFilter}
            options={[
              { value: 'all', label: 'All Months' },
              ...data.months.map(m => ({
                value: m,
                label: new Date(m).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
              })),
            ]}
          />
          <Select
            style={{ width: 180 }}
            value={subCatFilter}
            onChange={setSubCatFilter}
            options={[
              { value: 'all', label: 'All Sub Categories' },
              ...subCategories.map(s => ({ value: s, label: s })),
            ]}
          />
        </Space>
      </Card>

      <Tabs
        defaultActiveKey="all"
        items={[
          {
            key: 'all',
            label: 'All Variances',
            children: (
              <Table
                dataSource={filteredRows}
                columns={columns}
                rowKey={(row) => `${row.sub_brand}-${row.sub_category}-${row.gender}-${row.channel}-${row.month}`}
                size="small"
                pagination={{ pageSize: 50 }}
                scroll={{ x: 1200 }}
              />
            ),
          },
          {
            key: 'top10',
            label: 'Top 10 Variances',
            children: (
              <Table
                dataSource={data.summary.top_variances}
                columns={topVarianceColumns}
                rowKey={(row) => `top-${row.sub_brand}-${row.sub_category}-${row.gender}-${row.channel}-${row.month}`}
                size="small"
                pagination={false}
                scroll={{ x: 1200 }}
              />
            ),
          },
        ]}
      />
    </Space>
  );
}
```

**Step 2: Create the variance page**

```tsx
// src/app/cycles/[cycleId]/variance/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Typography, Spin, Alert, Button, Space } from 'antd';
import { FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import AppLayout from '@/components/AppLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import VarianceReport from '@/components/VarianceReport';
import type { VarianceReportData } from '@/types/otb';

const { Title } = Typography;

export default function VarianceReportPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [data, setData] = useState<VarianceReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/cycles/${cycleId}/variance`);
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || 'Failed to load variance report');
          return;
        }
        setData(await res.json());
      } catch {
        setError('Failed to load variance report');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [cycleId]);

  const handleExportExcel = () => {
    window.open(`/api/cycles/${cycleId}/variance/export?format=xlsx`, '_blank');
  };

  const handleExportPdf = () => {
    window.open(`/api/cycles/${cycleId}/variance/export?format=pdf`, '_blank');
  };

  return (
    <ProtectedRoute permission="view_variance">
      <AppLayout>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3}>Variance Report</Title>
            {data && (
              <Space>
                <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>
                  Export Excel
                </Button>
                <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>
                  Export PDF
                </Button>
              </Space>
            )}
          </div>

          {loading && <Spin size="large" />}
          {error && <Alert message={error} type="warning" showIcon />}
          {data && <VarianceReport data={data} />}
        </Space>
      </AppLayout>
    </ProtectedRoute>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/VarianceReport.tsx src/app/cycles/[cycleId]/variance/page.tsx
git commit -m "feat: add variance report UI with filtering and color coding"
```

**Depends on:** Task 6

---

#### Task 9: Version Revert API

**Files:**
- Create: `src/app/api/cycles/[cycleId]/versions/revert/route.ts`

**Step 1: Implement the revert endpoint**

```typescript
// src/app/api/cycles/[cycleId]/versions/revert/route.ts
import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAuditEvent } from '@/lib/auth/auditLogger';

type Params = { params: Promise<{ cycleId: string }> };

export const POST = withAuth('edit_otb', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const { version_number } = await req.json();

  if (!version_number || typeof version_number !== 'number') {
    return NextResponse.json({ error: 'version_number is required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const admin = createAdminClient();

  // Verify cycle exists and is in editable state
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  if (cycle.status === 'Approved') {
    return NextResponse.json({ error: 'Cannot revert an approved cycle' }, { status: 400 });
  }

  // Get the version snapshot
  const { data: version } = await supabase
    .from('version_history')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('version_number', version_number)
    .single();

  if (!version) {
    return NextResponse.json({ error: `Version ${version_number} not found` }, { status: 404 });
  }

  const snapshot = version.snapshot as any;
  if (!snapshot || !snapshot.rows) {
    return NextResponse.json({ error: 'Invalid version snapshot' }, { status: 400 });
  }

  // Delete existing plan data for this cycle, then re-insert from snapshot
  // Get all row IDs first
  const { data: existingRows } = await admin
    .from('otb_plan_rows')
    .select('id')
    .eq('cycle_id', cycleId);

  const rowIds = (existingRows || []).map(r => r.id);

  if (rowIds.length > 0) {
    // Delete plan data
    await admin.from('otb_plan_data').delete().in('row_id', rowIds);
    // Delete plan rows
    await admin.from('otb_plan_rows').delete().eq('cycle_id', cycleId);
  }

  // Re-insert from snapshot
  for (const row of snapshot.rows) {
    const { data: newRow } = await admin
      .from('otb_plan_rows')
      .insert({
        cycle_id: cycleId,
        sub_brand: row.sub_brand,
        wear_type: row.wear_type,
        sub_category: row.sub_category,
        gender: row.gender,
        channel: row.channel,
      })
      .select('id')
      .single();

    if (newRow && row.months) {
      const monthEntries = Object.entries(row.months).map(([month, data]: [string, any]) => ({
        row_id: newRow.id,
        month,
        ...data,
      }));

      if (monthEntries.length > 0) {
        await admin.from('otb_plan_data').insert(monthEntries);
      }
    }
  }

  // Audit log
  await logAuditEvent(admin, {
    entityType: 'otb_cycle',
    entityId: cycleId,
    action: 'REVERT',
    userId: auth.user.id,
    changes: { reverted_to_version: version_number },
  });

  return NextResponse.json({ success: true, reverted_to: version_number });
});
```

**Step 2: Commit**

```bash
git add src/app/api/cycles/[cycleId]/versions/revert/route.ts
git commit -m "feat: add version revert API endpoint"
```

**Depends on:** Nothing (uses existing version_history)

---

#### Task 10: Version Revert UI

**Files:**
- Modify: `src/app/cycles/[cycleId]/grid/page.tsx` — Add revert button to version history panel

**Step 1: Add revert button to version history**

In the existing version history section of the grid page, add a "Revert" button next to each version entry. When clicked, show a confirmation modal, then call `POST /api/cycles/${cycleId}/versions/revert` with `{ version_number }`.

Key UI elements:
- `Button` with `Popconfirm`: "Are you sure you want to revert to version N? This will replace all current plan data."
- After successful revert, reload the grid data
- Disable revert when cycle is Approved
- Show success message after revert

**Step 2: Commit**

```bash
git add src/app/cycles/[cycleId]/grid/page.tsx
git commit -m "feat: add version revert UI with confirmation"
```

**Depends on:** Task 9

---

### Sprint 10: Export & Polish (Tasks 11-17)

#### Task 11: CSV Export for OTB Plan

**Files:**
- Modify: `src/app/api/cycles/[cycleId]/export/route.ts` — Add `?format=csv` query param support

**Step 1: Add CSV format support**

Modify the existing export route to check `req.nextUrl.searchParams.get('format')`. If `format=csv`, build a CSV string from the same data and return with `text/csv` content type. If `format=xlsx` or no format specified, use existing Excel logic.

```typescript
// Add to existing export/route.ts after building formattedRows
const format = req.nextUrl.searchParams.get('format') || 'xlsx';

if (format === 'csv') {
  const headers = ['Sub Brand', 'Wear Type', 'Sub Category', 'Gender', 'Channel'];
  for (const month of sortedMonths) {
    const label = new Date(month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    headers.push(`${label} NSQ`, `${label} ASP`, `${label} GMV`, `${label} NSV`,
      `${label} COGS`, `${label} GM%`, `${label} Inwards Qty`, `${label} DoH`);
  }

  const csvRows = [headers.join(',')];
  for (const row of formattedRows) {
    const cells = [row.sub_brand, row.wear_type, row.sub_category, row.gender, row.channel];
    for (const month of sortedMonths) {
      const md = row.months[month];
      if (md) {
        cells.push(md.nsq, md.asp, md.sales_plan_gmv, md.nsv, md.cogs, md.gm_pct, md.inwards_qty, md.fwd_30day_doh);
      } else {
        cells.push('', '', '', '', '', '', '', '');
      }
    }
    csvRows.push(cells.map(c => `"${c ?? ''}"`).join(','));
  }

  return new NextResponse(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename.replace('.xlsx', '.csv')}"`,
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/cycles/[cycleId]/export/route.ts
git commit -m "feat: add CSV export format for OTB plan"
```

**Depends on:** Nothing (extends existing)

---

#### Task 12: PDF Export Engine

**Files:**
- Create: `src/lib/pdfExport.ts`

**Step 1: Install jspdf and jspdf-autotable**

Run: `cd otb-automation && npm install jspdf jspdf-autotable`

**Step 2: Implement PDF export**

```typescript
// src/lib/pdfExport.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { VarianceReportData, VarianceRow } from '@/types/otb';

export interface PdfPlanData {
  cycleName: string;
  brandName: string;
  planningQuarter: string;
  months: string[];
  rows: any[];
}

export function buildPlanPdf(data: PdfPlanData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  doc.setFontSize(16);
  doc.text(`OTB Plan: ${data.cycleName}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Brand: ${data.brandName} | Quarter: ${data.planningQuarter} | Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 22);

  const headers = ['Sub Brand', 'Wear Type', 'Sub Cat', 'Gender', 'Channel'];
  for (const month of data.months) {
    const label = new Date(month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    headers.push(`${label} NSQ`, `${label} GMV`, `${label} GM%`);
  }

  const body = data.rows.map(row => {
    const cells = [row.sub_brand, row.wear_type, row.sub_category, row.gender, row.channel];
    for (const month of data.months) {
      const md = row.months?.[month];
      cells.push(
        md?.nsq?.toLocaleString() ?? '',
        md?.sales_plan_gmv ? (md.sales_plan_gmv / 1e7).toFixed(2) : '',
        md?.gm_pct?.toFixed(1) ?? '',
      );
    }
    return cells;
  });

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body,
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [46, 125, 50] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  return doc;
}

export function buildVariancePdf(data: VarianceReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  doc.setFontSize(16);
  doc.text(`Variance Report: ${data.cycle_name}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Brand: ${data.brand_name} | Quarter: ${data.planning_quarter}`, 14, 22);

  // Summary line
  doc.text(
    `Summary: ${data.summary.green_count} OK | ${data.summary.yellow_count} Near Threshold | ${data.summary.red_count} Exceeds Threshold`,
    14, 28,
  );

  const headers = ['Sub Brand', 'Sub Cat', 'Gender', 'Channel', 'Month',
    'NSQ Plan', 'NSQ Actual', 'NSQ Var%',
    'GMV Plan', 'GMV Actual', 'GMV Var%',
    'Inwards Plan', 'Inwards Actual', 'Inwards Var%',
  ];

  const body = data.rows.map(row => [
    row.sub_brand, row.sub_category, row.gender, row.channel,
    new Date(row.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    row.nsq.planned?.toLocaleString() ?? '', row.nsq.actual?.toLocaleString() ?? '',
    row.nsq.variance_pct != null ? `${row.nsq.variance_pct.toFixed(1)}%` : '',
    row.gmv.planned != null ? (row.gmv.planned / 1e7).toFixed(2) : '',
    row.gmv.actual != null ? (row.gmv.actual / 1e7).toFixed(2) : '',
    row.gmv.variance_pct != null ? `${row.gmv.variance_pct.toFixed(1)}%` : '',
    row.inwards.planned?.toLocaleString() ?? '', row.inwards.actual?.toLocaleString() ?? '',
    row.inwards.variance_pct != null ? `${row.inwards.variance_pct.toFixed(1)}%` : '',
  ]);

  // Color-code variance cells
  autoTable(doc, {
    startY: 34,
    head: [headers],
    body,
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [25, 118, 210] },
    didParseCell: function (hookData) {
      // Color variance % columns (indices 7, 10, 13)
      if (hookData.section === 'body' && [7, 10, 13].includes(hookData.column.index)) {
        const text = String(hookData.cell.raw);
        const val = parseFloat(text);
        if (!isNaN(val)) {
          const abs = Math.abs(val);
          if (abs > 20) hookData.cell.styles.textColor = [255, 77, 79]; // red
          else if (abs > 10) hookData.cell.styles.textColor = [250, 173, 20]; // yellow
          else hookData.cell.styles.textColor = [82, 196, 26]; // green
        }
      }
    },
  });

  return doc;
}
```

**Step 3: Commit**

```bash
git add src/lib/pdfExport.ts
git commit -m "feat: add PDF export engine for OTB plan and variance report"
```

**Depends on:** Task 1

---

#### Task 13: PDF Export API — OTB Plan

**Files:**
- Modify: `src/app/api/cycles/[cycleId]/export/route.ts` — Add `format=pdf` support

**Step 1: Add PDF format to existing export route**

Add a condition for `format === 'pdf'` that uses `buildPlanPdf()` from `pdfExport.ts`:

```typescript
if (format === 'pdf') {
  const { buildPlanPdf } = await import('@/lib/pdfExport');
  const doc = buildPlanPdf({
    cycleName: cycle.cycle_name,
    brandName: (cycle.brands as any)?.name || 'Unknown',
    planningQuarter: cycle.planning_quarter,
    months: sortedMonths,
    rows: formattedRows,
  });

  const pdfBuffer = doc.output('arraybuffer');
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename.replace('.xlsx', '.pdf')}"`,
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/cycles/[cycleId]/export/route.ts
git commit -m "feat: add PDF export for OTB plan"
```

**Depends on:** Task 12

---

#### Task 14: Variance Report Export API (Excel + PDF)

**Files:**
- Create: `src/app/api/cycles/[cycleId]/variance/export/route.ts`

**Step 1: Implement variance export endpoint**

```typescript
// src/app/api/cycles/[cycleId]/variance/export/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildVarianceMetric, getTopVariances } from '@/lib/varianceEngine';
import { DEFAULT_VARIANCE_THRESHOLDS } from '@/types/otb';
import type { VarianceRow, VarianceReportData, VarianceSummary } from '@/types/otb';
import ExcelJS from 'exceljs';

type Params = { params: Promise<{ cycleId: string }> };

async function getVarianceData(supabase: any, cycleId: string): Promise<VarianceReportData | null> {
  // Reuse the same logic as the variance GET endpoint
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*, brands(name)')
    .eq('id', cycleId)
    .single();

  if (!cycle) return null;

  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('id, sub_brand, wear_type, sub_category, gender, channel')
    .eq('cycle_id', cycleId);

  const rowIds = (planRows || []).map((r: any) => r.id);
  let planDataList: any[] = [];
  if (rowIds.length > 0) {
    const { data } = await supabase
      .from('otb_plan_data')
      .select('row_id, month, nsq, inwards_qty, sales_plan_gmv, closing_stock_qty')
      .in('row_id', rowIds);
    planDataList = data || [];
  }

  const planLookup = new Map<string, any>();
  for (const pd of planDataList) {
    planLookup.set(`${pd.row_id}|${pd.month}`, pd);
  }

  const planRowByDim = new Map<string, any>();
  for (const pr of planRows || []) {
    const key = [pr.sub_brand, pr.wear_type, pr.sub_category, pr.gender, pr.channel].join('|').toLowerCase();
    planRowByDim.set(key, pr);
  }

  const { data: actuals } = await supabase.from('otb_actuals').select('*').eq('cycle_id', cycleId);
  if (!actuals || actuals.length === 0) return null;

  const months = new Set<string>();
  const varianceRows: VarianceRow[] = [];
  const thresholds = DEFAULT_VARIANCE_THRESHOLDS;

  for (const actual of actuals) {
    months.add(actual.month);
    const dimKey = [actual.sub_brand, actual.wear_type, actual.sub_category, actual.gender, actual.channel].join('|').toLowerCase();
    const planRow = planRowByDim.get(dimKey);
    if (!planRow) continue;

    const planData = planLookup.get(`${planRow.id}|${actual.month}`);

    varianceRows.push({
      sub_brand: actual.sub_brand,
      wear_type: actual.wear_type,
      sub_category: actual.sub_category,
      gender: actual.gender,
      channel: actual.channel,
      month: actual.month,
      nsq: buildVarianceMetric('NSQ', actual.actual_nsq, planData?.nsq ?? null, thresholds.nsq_pct),
      gmv: buildVarianceMetric('GMV', actual.actual_gmv, planData?.sales_plan_gmv ?? null, thresholds.gmv_pct),
      inwards: buildVarianceMetric('Inwards', actual.actual_inwards_qty, planData?.inwards_qty ?? null, thresholds.inwards_pct),
      closing_stock: buildVarianceMetric('Closing Stock', actual.actual_closing_stock_qty, planData?.closing_stock_qty ?? null, thresholds.closing_stock_pct),
    });
  }

  let redCount = 0, yellowCount = 0, greenCount = 0;
  for (const row of varianceRows) {
    for (const m of [row.nsq, row.gmv, row.inwards, row.closing_stock]) {
      if (m.level === 'red') redCount++;
      else if (m.level === 'yellow') yellowCount++;
      else greenCount++;
    }
  }

  return {
    cycle_id: cycleId,
    cycle_name: cycle.cycle_name,
    brand_name: (cycle.brands as any)?.name || 'Unknown',
    planning_quarter: cycle.planning_quarter,
    months: Array.from(months).sort(),
    rows: varianceRows,
    summary: { total_rows: varianceRows.length, red_count: redCount, yellow_count: yellowCount, green_count: greenCount, top_variances: getTopVariances(varianceRows, 10) },
  };
}

function varianceLevelFill(level: string): { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } } {
  if (level === 'red') return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
  if (level === 'yellow') return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
}

export const GET = withAuth('view_variance', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const format = req.nextUrl.searchParams.get('format') || 'xlsx';
  const supabase = await createServerClient();

  const data = await getVarianceData(supabase, cycleId);
  if (!data) {
    return NextResponse.json({ error: 'No variance data available' }, { status: 404 });
  }

  const filename = `Variance_${data.brand_name.replace(/[^a-zA-Z0-9]/g, '_')}_${data.planning_quarter}`;

  if (format === 'pdf') {
    const { buildVariancePdf } = await import('@/lib/pdfExport');
    const doc = buildVariancePdf(data);
    const pdfBuffer = doc.output('arraybuffer');
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  // Default: Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OTB Automation';

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['Variance Report', data.cycle_name]);
  summarySheet.addRow(['Brand', data.brand_name]);
  summarySheet.addRow(['Quarter', data.planning_quarter]);
  summarySheet.addRow([]);
  summarySheet.addRow(['Total Rows', data.summary.total_rows]);
  summarySheet.addRow(['Within Threshold (Green)', data.summary.green_count]);
  summarySheet.addRow(['Near Threshold (Yellow)', data.summary.yellow_count]);
  summarySheet.addRow(['Exceeds Threshold (Red)', data.summary.red_count]);
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 30;

  // Detail sheet
  const detailSheet = workbook.addWorksheet('Variance Detail');
  const headers = ['Sub Brand', 'Sub Category', 'Gender', 'Channel', 'Month',
    'NSQ Planned', 'NSQ Actual', 'NSQ Var%', 'NSQ Status',
    'GMV Planned', 'GMV Actual', 'GMV Var%', 'GMV Status',
    'Inwards Planned', 'Inwards Actual', 'Inwards Var%', 'Inwards Status',
    'Closing Stock Planned', 'Closing Stock Actual', 'Closing Stock Var%', 'Closing Stock Status',
  ];

  const hdr = detailSheet.addRow(headers);
  hdr.font = { bold: true };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };

  for (const row of data.rows) {
    const monthLabel = new Date(row.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const excelRow = detailSheet.addRow([
      row.sub_brand, row.sub_category, row.gender, row.channel, monthLabel,
      row.nsq.planned, row.nsq.actual, row.nsq.variance_pct != null ? `${row.nsq.variance_pct.toFixed(1)}%` : '', row.nsq.level.toUpperCase(),
      row.gmv.planned, row.gmv.actual, row.gmv.variance_pct != null ? `${row.gmv.variance_pct.toFixed(1)}%` : '', row.gmv.level.toUpperCase(),
      row.inwards.planned, row.inwards.actual, row.inwards.variance_pct != null ? `${row.inwards.variance_pct.toFixed(1)}%` : '', row.inwards.level.toUpperCase(),
      row.closing_stock.planned, row.closing_stock.actual, row.closing_stock.variance_pct != null ? `${row.closing_stock.variance_pct.toFixed(1)}%` : '', row.closing_stock.level.toUpperCase(),
    ]);

    // Color-code status cells
    const statusCols = [9, 13, 17, 21]; // 1-indexed
    const metrics = [row.nsq, row.gmv, row.inwards, row.closing_stock];
    for (let j = 0; j < statusCols.length; j++) {
      excelRow.getCell(statusCols[j]).fill = varianceLevelFill(metrics[j].level);
    }
  }

  detailSheet.columns.forEach(col => { col.width = 14; });

  // Top 10 sheet
  const topSheet = workbook.addWorksheet('Top 10 Variances');
  const topHdr = topSheet.addRow(headers);
  topHdr.font = { bold: true };
  topHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

  for (const row of data.summary.top_variances) {
    const monthLabel = new Date(row.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    topSheet.addRow([
      row.sub_brand, row.sub_category, row.gender, row.channel, monthLabel,
      row.nsq.planned, row.nsq.actual, row.nsq.variance_pct != null ? `${row.nsq.variance_pct.toFixed(1)}%` : '', row.nsq.level.toUpperCase(),
      row.gmv.planned, row.gmv.actual, row.gmv.variance_pct != null ? `${row.gmv.variance_pct.toFixed(1)}%` : '', row.gmv.level.toUpperCase(),
      row.inwards.planned, row.inwards.actual, row.inwards.variance_pct != null ? `${row.inwards.variance_pct.toFixed(1)}%` : '', row.inwards.level.toUpperCase(),
      row.closing_stock.planned, row.closing_stock.actual, row.closing_stock.variance_pct != null ? `${row.closing_stock.variance_pct.toFixed(1)}%` : '', row.closing_stock.level.toUpperCase(),
    ]);
  }
  topSheet.columns.forEach(col => { col.width = 14; });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
    },
  });
});
```

**Step 2: Commit**

```bash
git add src/app/api/cycles/[cycleId]/variance/export/route.ts
git commit -m "feat: add variance report export (Excel + PDF)"
```

**Depends on:** Tasks 6, 12

---

#### Task 15: Export Buttons on Grid Page

**Files:**
- Modify: `src/app/cycles/[cycleId]/grid/page.tsx` — Add export dropdown (Excel, CSV, PDF)

**Step 1: Add export dropdown to grid toolbar**

Add an Ant Design `Dropdown` with 3 menu items:
- Export as Excel → `window.open(\`/api/cycles/${cycleId}/export?format=xlsx\`, '_blank')`
- Export as CSV → `window.open(\`/api/cycles/${cycleId}/export?format=csv\`, '_blank')`
- Export as PDF → `window.open(\`/api/cycles/${cycleId}/export?format=pdf\`, '_blank')`

**Step 2: Commit**

```bash
git add src/app/cycles/[cycleId]/grid/page.tsx
git commit -m "feat: add export dropdown (Excel/CSV/PDF) to grid toolbar"
```

**Depends on:** Tasks 11, 13

---

#### Task 16: Navigation Updates

**Files:**
- Modify: `src/components/AppLayout.tsx` — Add Actuals and Variance links
- Modify: `src/app/cycles/[cycleId]/page.tsx` — Add Actuals/Variance buttons for approved cycles

**Step 1: Add cycle-level action buttons**

On the cycle detail page, when cycle status is `Approved`, show:
- "Upload Actuals" button → `/cycles/${cycleId}/actuals`
- "View Variance Report" button → `/cycles/${cycleId}/variance`

**Step 2: Commit**

```bash
git add src/components/AppLayout.tsx src/app/cycles/[cycleId]/page.tsx
git commit -m "feat: add actuals/variance navigation for approved cycles"
```

**Depends on:** Tasks 7, 8

---

#### Task 17: Integration Tests

**Files:**
- Create: `tests/integration/actualsVariance.test.ts`

**Step 1: Write integration tests**

```typescript
// tests/integration/actualsVariance.test.ts
import { describe, it, expect } from 'vitest';
import { calcActualDerived, calcVariancePct, buildVarianceMetric, classifyVariance, getTopVariances } from '@/lib/varianceEngine';
import { DEFAULT_VARIANCE_THRESHOLDS } from '@/types/otb';

describe('Actuals & Variance Integration', () => {
  describe('full actuals recalculation flow', () => {
    it('calculates all derived metrics from actuals', () => {
      const derived = calcActualDerived({
        actualNsq: 1000,
        actualInwardsQty: 500,
        asp: 800,
        cogs: 300,
        openingStockQty: 200,
        returnPct: 15,
        taxPct: 5,
        sellexPct: 10,
        nextMonthActualNsq: 1200,
      });

      expect(derived.actualGmv).toBe(800000); // 1000 * 800
      expect(derived.actualClosingStockQty).toBe(-300); // 200 + 500 - 1000
      expect(derived.actualGmPct).toBeCloseTo(62.5); // (800-300)/800 * 100
    });
  });

  describe('full variance flow', () => {
    it('computes variance and classifies correctly', () => {
      const metric = buildVarianceMetric('NSQ', 1150, 1000, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct);
      expect(metric.variance_pct).toBeCloseTo(15);
      expect(metric.level).toBe('yellow'); // exactly at 15% threshold
    });

    it('handles large positive variance as red', () => {
      const metric = buildVarianceMetric('GMV', 200, 100, DEFAULT_VARIANCE_THRESHOLDS.gmv_pct);
      expect(metric.variance_pct).toBeCloseTo(100);
      expect(metric.level).toBe('red');
    });

    it('handles negative variance correctly', () => {
      const metric = buildVarianceMetric('Inwards', 50, 100, DEFAULT_VARIANCE_THRESHOLDS.inwards_pct);
      expect(metric.variance_pct).toBeCloseTo(-50);
      expect(metric.level).toBe('red');
    });

    it('green for small variance', () => {
      const metric = buildVarianceMetric('NSQ', 105, 100, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct);
      expect(metric.variance_pct).toBeCloseTo(5);
      expect(metric.level).toBe('green');
    });
  });

  describe('end-to-end: actuals → variance → top 10', () => {
    it('processes multiple rows and selects top variances', () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        sub_brand: 'test',
        wear_type: 'NWW',
        sub_category: `cat-${i}`,
        gender: 'male',
        channel: 'myntra_sor',
        month: '2026-01-01',
        nsq: buildVarianceMetric('NSQ', 100 + i * 10, 100, 15),
        gmv: buildVarianceMetric('GMV', 80000 + i * 5000, 80000, 15),
        inwards: buildVarianceMetric('Inwards', 50 + i * 5, 50, 20),
        closing_stock: buildVarianceMetric('Closing Stock', 200 + i * 20, 200, 25),
      }));

      const top = getTopVariances(rows, 10);
      expect(top).toHaveLength(10);
      // Top variance should be the last row (highest i = 19)
      expect(top[0].sub_category).toBe('cat-19');
    });
  });
});
```

**Step 2: Run tests**

Run: `cd otb-automation && npx vitest run tests/integration/actualsVariance.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/actualsVariance.test.ts
git commit -m "test: add actuals and variance integration tests"
```

**Depends on:** Tasks 2, 4

---

## Dependency Graph & Parallelization

```
Parallel Wave 1 (no dependencies):
  Task 1  (types)
  Task 3  (migration 011)
  Task 9  (version revert API)

Wave 2 (depends on Wave 1):
  Task 2  (variance engine)      → depends on 1
  Task 4  (actuals validator)    → depends on 1
  Task 12 (PDF export engine)    → depends on 1
  Task 11 (CSV export)           → depends on nothing (extends existing)

Wave 3 (depends on Wave 2):
  Task 5  (actuals upload API)   → depends on 2, 3, 4
  Task 6  (variance report API)  → depends on 2, 3
  Task 10 (version revert UI)    → depends on 9
  Task 13 (PDF export plan)      → depends on 12
  Task 17 (integration tests)    → depends on 2, 4

Wave 4 (depends on Wave 3):
  Task 7  (actuals upload UI)    → depends on 5
  Task 8  (variance report UI)   → depends on 6
  Task 14 (variance export)      → depends on 6, 12
  Task 15 (export buttons)       → depends on 11, 13

Wave 5:
  Task 16 (navigation updates)   → depends on 7, 8
```

## Execution Strategy

Use `superpowers:executing-plans` skill. Leverage `superpowers:dispatching-parallel-agents` for Wave 1 (Tasks 1, 3, 9 in parallel) and within subsequent waves where tasks are independent.

Each task follows TDD where applicable — write tests first for pure function modules (Tasks 2, 17).
