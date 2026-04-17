# Executive Dashboard Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge the Cross-Brand Summary into the Executive Dashboard as a three-zone CXO-workflow layout (Pending Review, Approved Plans, Actuals vs Plan) with a redesigned KPI row and expandable brand panels.

**Architecture:** Enhance the existing `/api/summary` endpoint with a `status` filter param, per-brand monthly breakdown (GMV, NSQ, closing stock), and per-brand top sub-category ranking. Create a new `BrandPanel` component with three variants (review/approved/variance) used across all three dashboard zones. Rewrite the dashboard page (`page.tsx`) and its data hook (`useDashboardData.ts`) to organize data into zones. Lazy-load variance data on panel expand via the existing `/api/cycles/[id]/variance` endpoint. Remove the `/summary` page and `CrossBrandSummary` component.

**Tech Stack:** Next.js 16 App Router, TypeScript, Ant Design 6, Supabase (PostgreSQL), Vitest

---

## Task 1: Add TypeScript Interfaces for Enhanced Dashboard

**Files:**
- Modify: `src/types/otb.ts`
- Test: `tests/unit/dashboardTypes.test.ts`

### Step 1: Write the type-checking test

Create `tests/unit/dashboardTypes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type {
  EnhancedBrandSummary,
  BrandMonthBreakdown,
  CategoryBreakdown,
  DashboardSummaryResponse,
} from '@/types/otb';

describe('Dashboard types', () => {
  it('EnhancedBrandSummary has required shape', () => {
    const brand: EnhancedBrandSummary = {
      brand_id: 'b1',
      brand_name: 'Bewakoof',
      cycle_id: 'c1',
      cycle_name: 'Q1 FY27',
      status: 'Approved',
      planning_quarter: 'Q1 FY27',
      gmv: 100000,
      nsv: 80000,
      nsq: 5000,
      inwards_qty: 3000,
      avg_doh: 45,
      closing_stock_qty: 2000,
      monthly: [
        { month: '2026-04-01', gmv: 33000, nsv: 26000, nsq: 1600, inwards_qty: 1000, closing_stock_qty: 700, avg_doh: 44 },
      ],
      top_categories: [
        { sub_category: 'T-Shirts', gmv: 50000, nsq: 2500, pct_of_total: 50 },
      ],
    };
    expect(brand.brand_id).toBe('b1');
    expect(brand.monthly).toHaveLength(1);
    expect(brand.top_categories).toHaveLength(1);
  });

  it('DashboardSummaryResponse has required shape', () => {
    const resp: DashboardSummaryResponse = {
      kpiTotals: { gmv: 0, nsv: 0, nsq: 0, inwards_qty: 0, avg_doh: 0, closing_stock_qty: 0 },
      brands: [],
      months: [],
    };
    expect(resp.kpiTotals).toBeDefined();
    expect(resp.brands).toEqual([]);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd otb-automation && npx vitest run tests/unit/dashboardTypes.test.ts`
Expected: FAIL — types not exported yet

### Step 3: Add the interfaces to `src/types/otb.ts`

Append after the `VarianceSummary` interface (around line 388):

```typescript
// === Enhanced Dashboard Types ===

export interface BrandMonthBreakdown {
  month: string;
  gmv: number;
  nsv: number;
  nsq: number;
  inwards_qty: number;
  closing_stock_qty: number;
  avg_doh: number;
}

export interface CategoryBreakdown {
  sub_category: string;
  gmv: number;
  nsq: number;
  pct_of_total: number; // percentage of brand total GMV
}

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
}

export interface DashboardKpiTotals {
  gmv: number;
  nsv: number;
  nsq: number;
  inwards_qty: number;
  avg_doh: number;
  closing_stock_qty: number;
}

export interface DashboardSummaryResponse {
  kpiTotals: DashboardKpiTotals;
  brands: EnhancedBrandSummary[];
  months: string[];
}
```

### Step 4: Run test to verify it passes

Run: `cd otb-automation && npx vitest run tests/unit/dashboardTypes.test.ts`
Expected: PASS

### Step 5: Commit

```bash
cd otb-automation
git add tests/unit/dashboardTypes.test.ts src/types/otb.ts
git commit -m "feat: add TypeScript interfaces for enhanced dashboard summary"
```

---

## Task 2: Enhance Summary API — Status Filter + Expanded Monthly Fields

**Files:**
- Modify: `src/app/api/summary/route.ts`
- Test: `tests/integration/dashboardSummary.test.ts`

### Step 1: Write the integration test

Create `tests/integration/dashboardSummary.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (_perm: string, handler: Function) => handler,
}));

describe('GET /api/summary — enhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters by status=Approved when param provided', async () => {
    // Track what status values are passed to .in()
    const inStatuses: string[][] = [];
    mockFrom.mockReturnValue({
      select: () => ({
        in: (col: string, vals: string[]) => {
          if (col === 'status') inStatuses.push(vals);
          return {
            eq: () => ({ data: [], error: null }),
            data: [],
            error: null,
          };
        },
      }),
    });

    // Import the handler dynamically after mocks are set up
    const { GET } = await import('@/app/api/summary/route');
    const req = new Request('http://localhost/api/summary?status=Approved');
    const auth = { user: { id: 'u1' }, profile: { role: 'CXO', assigned_brands: [] } };

    await GET(req, auth as any);

    expect(inStatuses[0]).toEqual(['Approved']);
  });

  it('returns enhanced brand shape with monthly and top_categories', async () => {
    const mockCycles = [
      { id: 'c1', cycle_name: 'Q1', brand_id: 'b1', planning_quarter: 'Q1 FY27', status: 'Approved', brands: { name: 'Bewakoof' } },
    ];
    const mockPlanRows = [
      { id: 'r1', cycle_id: 'c1', sub_category: 'T-Shirts' },
      { id: 'r2', cycle_id: 'c1', sub_category: 'Joggers' },
    ];
    const mockPlanData = [
      { row_id: 'r1', month: '2026-04-01', sales_plan_gmv: 50000, nsv: 40000, nsq: 2000, inwards_qty: 1500, closing_stock_qty: 800, fwd_30day_doh: 42 },
      { row_id: 'r2', month: '2026-04-01', sales_plan_gmv: 30000, nsv: 24000, nsq: 1200, inwards_qty: 900, closing_stock_qty: 500, fwd_30day_doh: 48 },
    ];

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'otb_cycles') {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({ data: mockCycles, error: null }),
              data: mockCycles,
              error: null,
            }),
          }),
        };
      }
      if (table === 'otb_plan_rows') {
        return {
          select: () => ({
            in: () => ({ data: mockPlanRows, error: null }),
          }),
        };
      }
      if (table === 'otb_plan_data') {
        return {
          select: () => ({
            in: () => ({ data: mockPlanData, error: null }),
          }),
        };
      }
      return { select: () => ({ in: () => ({ data: [], error: null }) }) };
    });

    const { GET } = await import('@/app/api/summary/route');
    const req = new Request('http://localhost/api/summary');
    const auth = { user: { id: 'u1' }, profile: { role: 'CXO', assigned_brands: [] } };

    const response = await GET(req, auth as any);
    const body = await response.json();

    // Should have enhanced brand structure
    expect(body.brands[0]).toHaveProperty('gmv');
    expect(body.brands[0]).toHaveProperty('nsq');
    expect(body.brands[0]).toHaveProperty('closing_stock_qty');
    expect(body.brands[0]).toHaveProperty('monthly');
    expect(body.brands[0]).toHaveProperty('top_categories');
    // KPI totals
    expect(body.kpiTotals).toHaveProperty('gmv');
    expect(body.kpiTotals).toHaveProperty('nsv');
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd otb-automation && npx vitest run tests/integration/dashboardSummary.test.ts`
Expected: FAIL — API doesn't return new shape yet

### Step 3: Rewrite `src/app/api/summary/route.ts`

Replace the entire file content:

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import type {
  EnhancedBrandSummary,
  BrandMonthBreakdown,
  CategoryBreakdown,
  DashboardKpiTotals,
  DashboardSummaryResponse,
} from '@/types/otb';

// GET /api/summary — enhanced cross-brand OTB summary
// Query params:
//   ?quarter=Q1+FY27   — filter by planning quarter
//   ?status=Approved    — filter by cycle status (default: InReview,Approved)
export const GET = withAuth('view_cross_brand_summary', async (req, auth) => {
  const supabase = await createServerClient();
  const url = new URL(req.url);
  const quarter = url.searchParams.get('quarter');
  const statusParam = url.searchParams.get('status');

  // Determine which statuses to fetch
  const statuses = statusParam
    ? [statusParam]
    : ['InReview', 'Approved'];

  // 1. Get cycles
  let cycleQuery = supabase
    .from('otb_cycles')
    .select('id, cycle_name, brand_id, planning_quarter, status, brands(name)')
    .in('status', statuses);

  if (quarter) {
    cycleQuery = cycleQuery.eq('planning_quarter', quarter);
  }

  const { data: cycles, error: cyclesError } = await cycleQuery;
  if (cyclesError) return NextResponse.json({ error: cyclesError.message }, { status: 500 });

  if (!cycles || cycles.length === 0) {
    const emptyResponse: DashboardSummaryResponse = {
      kpiTotals: { gmv: 0, nsv: 0, nsq: 0, inwards_qty: 0, avg_doh: 0, closing_stock_qty: 0 },
      brands: [],
      months: [],
    };
    return NextResponse.json(emptyResponse);
  }

  const cycleIds = cycles.map(c => c.id);

  // 2. Fetch plan rows (need sub_category for category breakdown)
  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('id, cycle_id, sub_category')
    .in('cycle_id', cycleIds);

  const rowIds = (planRows || []).map(r => r.id);
  const rowToCycle: Record<string, string> = {};
  const rowToSubCategory: Record<string, string> = {};
  for (const r of planRows || []) {
    rowToCycle[r.id] = r.cycle_id;
    rowToSubCategory[r.id] = r.sub_category;
  }

  // 3. Fetch plan data
  let planData: any[] = [];
  if (rowIds.length > 0) {
    const { data } = await supabase
      .from('otb_plan_data')
      .select('row_id, month, sales_plan_gmv, nsv, nsq, inwards_qty, closing_stock_qty, fwd_30day_doh')
      .in('row_id', rowIds);
    planData = data || [];
  }

  // 4. Map cycles to brand info
  const cycleToBrand: Record<string, { brand_id: string; brand_name: string; cycle_id: string; cycle_name: string; status: string; planning_quarter: string }> = {};
  for (const c of cycles) {
    cycleToBrand[c.id] = {
      brand_id: c.brand_id,
      brand_name: (c.brands as any)?.name || 'Unknown',
      cycle_id: c.id,
      cycle_name: c.cycle_name,
      status: c.status,
      planning_quarter: c.planning_quarter,
    };
  }

  // 5. Aggregate per brand
  interface BrandAgg {
    brand_id: string;
    brand_name: string;
    cycle_id: string;
    cycle_name: string;
    status: string;
    planning_quarter: string;
    totalGmv: number;
    totalNsv: number;
    totalNsq: number;
    totalInwardsQty: number;
    totalClosingStockQty: number;
    dohSum: number;
    dohCount: number;
    monthData: Record<string, { gmv: number; nsv: number; nsq: number; inwards_qty: number; closing_stock_qty: number; dohSum: number; dohCount: number }>;
    categoryData: Record<string, { gmv: number; nsq: number }>;
  }

  const brandAgg: Record<string, BrandAgg> = {};
  const allMonths = new Set<string>();

  for (const pd of planData) {
    const cycleId = rowToCycle[pd.row_id];
    if (!cycleId) continue;
    const brandInfo = cycleToBrand[cycleId];
    if (!brandInfo) continue;
    const subCategory = rowToSubCategory[pd.row_id] || 'Unknown';

    if (!brandAgg[brandInfo.brand_id]) {
      brandAgg[brandInfo.brand_id] = {
        ...brandInfo,
        totalGmv: 0, totalNsv: 0, totalNsq: 0,
        totalInwardsQty: 0, totalClosingStockQty: 0,
        dohSum: 0, dohCount: 0,
        monthData: {},
        categoryData: {},
      };
    }

    const agg = brandAgg[brandInfo.brand_id];
    agg.totalGmv += pd.sales_plan_gmv || 0;
    agg.totalNsv += pd.nsv || 0;
    agg.totalNsq += pd.nsq || 0;
    agg.totalInwardsQty += pd.inwards_qty || 0;
    agg.totalClosingStockQty += pd.closing_stock_qty || 0;
    if (pd.fwd_30day_doh != null) { agg.dohSum += pd.fwd_30day_doh; agg.dohCount++; }

    // Monthly breakdown
    if (pd.month) {
      allMonths.add(pd.month);
      if (!agg.monthData[pd.month]) {
        agg.monthData[pd.month] = { gmv: 0, nsv: 0, nsq: 0, inwards_qty: 0, closing_stock_qty: 0, dohSum: 0, dohCount: 0 };
      }
      const m = agg.monthData[pd.month];
      m.gmv += pd.sales_plan_gmv || 0;
      m.nsv += pd.nsv || 0;
      m.nsq += pd.nsq || 0;
      m.inwards_qty += pd.inwards_qty || 0;
      m.closing_stock_qty += pd.closing_stock_qty || 0;
      if (pd.fwd_30day_doh != null) { m.dohSum += pd.fwd_30day_doh; m.dohCount++; }
    }

    // Category breakdown
    if (!agg.categoryData[subCategory]) {
      agg.categoryData[subCategory] = { gmv: 0, nsq: 0 };
    }
    agg.categoryData[subCategory].gmv += pd.sales_plan_gmv || 0;
    agg.categoryData[subCategory].nsq += pd.nsq || 0;
  }

  // 6. Build enhanced brand summaries
  const brands: EnhancedBrandSummary[] = Object.values(brandAgg).map(agg => {
    // Monthly breakdown
    const monthly: BrandMonthBreakdown[] = Array.from(allMonths).sort().map(month => {
      const m = agg.monthData[month];
      if (!m) return { month, gmv: 0, nsv: 0, nsq: 0, inwards_qty: 0, closing_stock_qty: 0, avg_doh: 0 };
      return {
        month,
        gmv: m.gmv,
        nsv: m.nsv,
        nsq: m.nsq,
        inwards_qty: m.inwards_qty,
        closing_stock_qty: m.closing_stock_qty,
        avg_doh: m.dohCount > 0 ? m.dohSum / m.dohCount : 0,
      };
    });

    // Top 5 categories by GMV
    const totalBrandGmv = agg.totalGmv || 1; // avoid divide by zero
    const top_categories: CategoryBreakdown[] = Object.entries(agg.categoryData)
      .map(([sub_category, data]) => ({
        sub_category,
        gmv: data.gmv,
        nsq: data.nsq,
        pct_of_total: (data.gmv / totalBrandGmv) * 100,
      }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 5);

    return {
      brand_id: agg.brand_id,
      brand_name: agg.brand_name,
      cycle_id: agg.cycle_id,
      cycle_name: agg.cycle_name,
      status: agg.status,
      planning_quarter: agg.planning_quarter,
      gmv: agg.totalGmv,
      nsv: agg.totalNsv,
      nsq: agg.totalNsq,
      inwards_qty: agg.totalInwardsQty,
      closing_stock_qty: agg.totalClosingStockQty,
      avg_doh: agg.dohCount > 0 ? agg.dohSum / agg.dohCount : 0,
      monthly,
      top_categories,
    };
  });

  // 7. KPI totals (from Approved-only brands)
  const approvedBrands = brands.filter(b => b.status === 'Approved');
  const kpiTotals: DashboardKpiTotals = {
    gmv: approvedBrands.reduce((s, b) => s + b.gmv, 0),
    nsv: approvedBrands.reduce((s, b) => s + b.nsv, 0),
    nsq: approvedBrands.reduce((s, b) => s + b.nsq, 0),
    inwards_qty: approvedBrands.reduce((s, b) => s + b.inwards_qty, 0),
    avg_doh: approvedBrands.length > 0
      ? approvedBrands.reduce((s, b) => s + b.avg_doh, 0) / approvedBrands.length
      : 0,
    closing_stock_qty: approvedBrands.reduce((s, b) => s + b.closing_stock_qty, 0),
  };

  const response: DashboardSummaryResponse = {
    kpiTotals,
    brands,
    months: Array.from(allMonths).sort(),
  };

  return NextResponse.json(response);
});
```

### Step 4: Run test to verify it passes

Run: `cd otb-automation && npx vitest run tests/integration/dashboardSummary.test.ts`
Expected: PASS

### Step 5: Commit

```bash
cd otb-automation
git add src/app/api/summary/route.ts tests/integration/dashboardSummary.test.ts
git commit -m "feat: enhance summary API with status filter, monthly breakdown, and top categories"
```

---

## Task 3: Create BrandPanel Component

**Files:**
- Create: `src/components/ui/BrandPanel.tsx`
- Test: `tests/unit/brandPanel.test.tsx`

### Step 1: Write the rendering test

Create `tests/unit/brandPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrandPanel } from '@/components/ui/BrandPanel';
import type { EnhancedBrandSummary } from '@/types/otb';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockBrand: EnhancedBrandSummary = {
  brand_id: 'b1',
  brand_name: 'Bewakoof',
  cycle_id: 'c1',
  cycle_name: 'Q1 FY27 Plan',
  status: 'InReview',
  planning_quarter: 'Q1 FY27',
  gmv: 5000000,
  nsv: 4000000,
  nsq: 25000,
  inwards_qty: 15000,
  avg_doh: 42,
  closing_stock_qty: 10000,
  monthly: [
    { month: '2026-04-01', gmv: 1700000, nsv: 1350000, nsq: 8500, inwards_qty: 5000, closing_stock_qty: 3300, avg_doh: 41 },
    { month: '2026-05-01', gmv: 1650000, nsv: 1300000, nsq: 8200, inwards_qty: 5000, closing_stock_qty: 3400, avg_doh: 43 },
    { month: '2026-06-01', gmv: 1650000, nsv: 1350000, nsq: 8300, inwards_qty: 5000, closing_stock_qty: 3300, avg_doh: 42 },
  ],
  top_categories: [
    { sub_category: 'T-Shirts', gmv: 2500000, nsq: 12500, pct_of_total: 50 },
    { sub_category: 'Joggers', gmv: 1500000, nsq: 7500, pct_of_total: 30 },
  ],
};

describe('BrandPanel', () => {
  it('renders brand name and cycle in collapsed state', () => {
    render(<BrandPanel brand={mockBrand} zone="review" />);
    expect(screen.getByText('Bewakoof')).toBeDefined();
    expect(screen.getByText('Q1 FY27 Plan')).toBeDefined();
  });

  it('shows InReview tag for review zone', () => {
    render(<BrandPanel brand={mockBrand} zone="review" />);
    expect(screen.getByText('InReview')).toBeDefined();
  });

  it('shows Approved tag for approved zone', () => {
    const approved = { ...mockBrand, status: 'Approved' };
    render(<BrandPanel brand={approved} zone="approved" />);
    expect(screen.getByText('Approved')).toBeDefined();
  });

  it('shows inline metrics in collapsed state', () => {
    render(<BrandPanel brand={mockBrand} zone="review" />);
    // GMV formatted as Crore
    expect(screen.getByText(/0\.50 Cr/)).toBeDefined();
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd otb-automation && npx vitest run tests/unit/brandPanel.test.tsx`
Expected: FAIL — component doesn't exist

### Step 3: Install @testing-library/react if not present

Run: `cd otb-automation && npm ls @testing-library/react 2>/dev/null || npm install -D @testing-library/react @testing-library/jest-dom jsdom`

Also ensure `vitest.config.ts` has `environment: 'jsdom'` for component tests. If not, add it:

```typescript
// vitest.config.ts — add environment: 'jsdom' under test:
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Step 4: Create `src/components/ui/BrandPanel.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Card, Tag, Table, Typography, Space, Button, Row, Col } from 'antd';
import {
  DownOutlined, RightOutlined, LinkOutlined,
  CheckCircleOutlined, UndoOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { VarianceBadge } from '@/components/ui/VarianceBadge';
import { COLORS, CARD_STYLES, SPACING, STATUS_TAG_COLORS } from '@/lib/designTokens';
import { formatCrore, formatQty } from '@/lib/formatting';
import type { EnhancedBrandSummary, VarianceReportData } from '@/types/otb';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

export type BrandPanelZone = 'review' | 'approved' | 'variance';

export interface BrandPanelProps {
  brand: EnhancedBrandSummary;
  zone: BrandPanelZone;
  variance?: VarianceReportData | null;
  onLoadVariance?: (cycleId: string) => void;
  onApprove?: (cycleId: string) => void;
  onRequestRevision?: (cycleId: string) => void;
  approvalProgress?: { approved: number; pending: number; total: number };
}

// Inline metric display for collapsed state
function InlineMetrics({ brand }: { brand: EnhancedBrandSummary }) {
  return (
    <Space size={16} style={{ fontSize: 12 }}>
      <span><Text type="secondary">GMV</Text> <Text strong>{formatCrore(brand.gmv)}</Text></span>
      <span><Text type="secondary">NSV</Text> <Text strong>{formatCrore(brand.nsv)}</Text></span>
      <span><Text type="secondary">NSQ</Text> <Text strong>{formatQty(brand.nsq)}</Text></span>
      <span><Text type="secondary">Inwards</Text> <Text strong>{formatQty(brand.inwards_qty)}</Text></span>
      <span><Text type="secondary">DoH</Text> <Text strong>{Math.round(brand.avg_doh)}</Text></span>
      <span><Text type="secondary">Closing</Text> <Text strong>{formatQty(brand.closing_stock_qty)}</Text></span>
    </Space>
  );
}

// Monthly breakdown table for expanded state
function MonthlyTable({ monthly }: { monthly: EnhancedBrandSummary['monthly'] }) {
  const columns: ColumnsType<EnhancedBrandSummary['monthly'][0]> = [
    { title: 'Month', dataIndex: 'month', key: 'month', width: 110, render: (v: string) => new Date(v).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) },
    { title: 'GMV', dataIndex: 'gmv', key: 'gmv', align: 'right', render: (v: number) => formatCrore(v) },
    { title: 'NSV', dataIndex: 'nsv', key: 'nsv', align: 'right', render: (v: number) => formatCrore(v) },
    { title: 'NSQ', dataIndex: 'nsq', key: 'nsq', align: 'right', render: (v: number) => formatQty(v) },
    { title: 'Inwards', dataIndex: 'inwards_qty', key: 'inw', align: 'right', render: (v: number) => formatQty(v) },
    { title: 'Closing Stock', dataIndex: 'closing_stock_qty', key: 'cs', align: 'right', render: (v: number) => formatQty(v) },
    { title: 'DoH', dataIndex: 'avg_doh', key: 'doh', align: 'right', width: 70, render: (v: number) => Math.round(v) },
  ];

  return <Table dataSource={monthly} columns={columns} rowKey="month" pagination={false} size="small" />;
}

// Top categories list
function TopCategories({ categories }: { categories: EnhancedBrandSummary['top_categories'] }) {
  if (!categories.length) return null;
  return (
    <div>
      <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Top Sub-Categories by GMV</Text>
      {categories.map((cat, i) => (
        <div key={cat.sub_category} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: i < categories.length - 1 ? `1px solid ${COLORS.borderLight}` : 'none' }}>
          <Text>{cat.sub_category}</Text>
          <Space size={16}>
            <Text type="secondary">{formatCrore(cat.gmv)}</Text>
            <Text type="secondary">{cat.pct_of_total.toFixed(0)}%</Text>
          </Space>
        </div>
      ))}
    </div>
  );
}

export function BrandPanel({
  brand,
  zone,
  variance,
  onLoadVariance,
  onApprove,
  onRequestRevision,
  approvalProgress,
}: BrandPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const handleExpand = () => {
    if (!expanded && zone === 'variance' && !variance && onLoadVariance) {
      onLoadVariance(brand.cycle_id);
    }
    setExpanded(!expanded);
  };

  const statusTag = zone === 'approved'
    ? <Tag color="success">Approved</Tag>
    : <Tag color={STATUS_TAG_COLORS[brand.status] || 'default'}>{brand.status}</Tag>;

  return (
    <Card
      style={{ ...CARD_STYLES, marginBottom: SPACING.md, cursor: 'pointer' }}
      styles={{ body: { padding: 0 } }}
    >
      {/* Collapsed header — always visible */}
      <div
        onClick={handleExpand}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${SPACING.lg}px ${SPACING.xl}px`, gap: SPACING.lg,
        }}
      >
        <Space size={12}>
          {expanded ? <DownOutlined style={{ fontSize: 11 }} /> : <RightOutlined style={{ fontSize: 11 }} />}
          <Text strong style={{ fontSize: 15 }}>{brand.brand_name}</Text>
          <Text type="secondary">{brand.cycle_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{brand.planning_quarter}</Text>
          {statusTag}
        </Space>
        <InlineMetrics brand={brand} />
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: `0 ${SPACING.xl}px ${SPACING.xl}px`, borderTop: `1px solid ${COLORS.borderLight}` }}>
          <Row gutter={[24, 16]} style={{ marginTop: SPACING.lg }}>
            <Col xs={24} lg={16}>
              <MonthlyTable monthly={brand.monthly} />
            </Col>
            <Col xs={24} lg={8}>
              <TopCategories categories={brand.top_categories} />
            </Col>
          </Row>

          {/* Zone-specific actions */}
          <div style={{ marginTop: SPACING.lg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {zone === 'review' && (
              <Space>
                {onApprove && (
                  <Button type="primary" icon={<CheckCircleOutlined />} onClick={(e) => { e.stopPropagation(); onApprove(brand.cycle_id); }}>
                    Approve
                  </Button>
                )}
                {onRequestRevision && (
                  <Button icon={<UndoOutlined />} onClick={(e) => { e.stopPropagation(); onRequestRevision(brand.cycle_id); }}>
                    Request Revision
                  </Button>
                )}
                {approvalProgress && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {approvalProgress.approved}/{approvalProgress.total} roles approved
                  </Text>
                )}
              </Space>
            )}

            {zone === 'approved' && (
              <Button
                type="link"
                icon={<LinkOutlined />}
                onClick={(e) => { e.stopPropagation(); router.push(`/cycles/${brand.cycle_id}`); }}
              >
                Open OTB Grid
              </Button>
            )}

            {zone === 'variance' && (
              <Button
                type="link"
                icon={<LinkOutlined />}
                onClick={(e) => { e.stopPropagation(); router.push(`/cycles/${brand.cycle_id}?tab=variance`); }}
              >
                Full Variance Report
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
```

### Step 5: Run test to verify it passes

Run: `cd otb-automation && npx vitest run tests/unit/brandPanel.test.tsx`
Expected: PASS

### Step 6: Commit

```bash
cd otb-automation
git add src/components/ui/BrandPanel.tsx tests/unit/brandPanel.test.tsx vitest.config.ts
git commit -m "feat: create BrandPanel component with review, approved, and variance zones"
```

---

## Task 4: Update useDashboardData Hook

**Files:**
- Modify: `src/hooks/useDashboardData.ts`
- Test: `tests/unit/useDashboardData.test.ts`

### Step 1: Write the hook test

Create `tests/unit/useDashboardData.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { DashboardSummaryResponse, EnhancedBrandSummary } from '@/types/otb';

const mockBrand = (overrides: Partial<EnhancedBrandSummary>): EnhancedBrandSummary => ({
  brand_id: 'b1', brand_name: 'Test', cycle_id: 'c1', cycle_name: 'Q1',
  status: 'Approved', planning_quarter: 'Q1 FY27',
  gmv: 100, nsv: 80, nsq: 50, inwards_qty: 30, avg_doh: 40, closing_stock_qty: 20,
  monthly: [], top_categories: [],
  ...overrides,
});

const mockSummary: DashboardSummaryResponse = {
  kpiTotals: { gmv: 100, nsv: 80, nsq: 50, inwards_qty: 30, avg_doh: 40, closing_stock_qty: 20 },
  brands: [
    mockBrand({ status: 'InReview', cycle_id: 'c1' }),
    mockBrand({ status: 'Approved', brand_id: 'b2', cycle_id: 'c2' }),
  ],
  months: ['2026-04-01'],
};

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn((url: string) => {
    if (url.includes('/api/summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) } as Response);
    }
    if (url.includes('/api/approvals/dashboard')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ summary: { totalCycles: 2, pendingApproval: 1, approved: 1, filling: 0 }, brands: [] }) } as Response);
    }
    if (url.includes('/api/cycles')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
  }) as any;
});

describe('useDashboardData', () => {
  it('separates brands into review and approved zones', async () => {
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.reviewBrands).toHaveLength(1);
    expect(result.current.reviewBrands[0].status).toBe('InReview');
    expect(result.current.approvedBrands).toHaveLength(1);
    expect(result.current.approvedBrands[0].status).toBe('Approved');
  });

  it('provides kpiTotals from API response', async () => {
    const { result } = renderHook(() => useDashboardData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.kpiTotals?.gmv).toBe(100);
    expect(result.current.kpiTotals?.nsv).toBe(80);
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd otb-automation && npx vitest run tests/unit/useDashboardData.test.ts`
Expected: FAIL — hook doesn't have `reviewBrands`, `approvedBrands`, `kpiTotals`

### Step 3: Rewrite `src/hooks/useDashboardData.ts`

Replace the entire file:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  OtbCycle, CycleStatus, EnhancedBrandSummary,
  DashboardKpiTotals, DashboardSummaryResponse,
  VarianceReportData,
} from '@/types/otb';

interface ApprovalProgress {
  approved: number;
  pending: number;
  revision: number;
  total: number;
}

interface BrandApproval {
  cycle_id: string;
  cycle_name: string;
  brand_name: string;
  brand_id: string;
  status: CycleStatus;
  planning_quarter: string;
  approval_progress: ApprovalProgress;
  risk_level: string;
  risk_flags: Array<{ flag: string; level: string }>;
  updated_at: string;
}

interface ApprovalDashboardData {
  summary: {
    totalCycles: number;
    pendingApproval: number;
    approved: number;
    filling: number;
  };
  brands: BrandApproval[];
}

export interface DashboardData {
  loading: boolean;
  error: string | null;
  // Enhanced summary data
  kpiTotals: DashboardKpiTotals | null;
  reviewBrands: EnhancedBrandSummary[];
  approvedBrands: EnhancedBrandSummary[];
  months: string[];
  // Approval data (for progress dots)
  approvals: ApprovalDashboardData | null;
  // Variance data (lazy-loaded per cycle)
  varianceCache: Record<string, VarianceReportData>;
  // Legacy — cycles list for status distribution
  cycles: OtbCycle[] | null;
  statusDistribution: Record<CycleStatus, number>;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    loading: true,
    error: null,
    kpiTotals: null,
    reviewBrands: [],
    approvedBrands: [],
    months: [],
    approvals: null,
    varianceCache: {},
    cycles: null,
    statusDistribution: { Draft: 0, Active: 0, Filling: 0, InReview: 0, Approved: 0 },
  });

  const fetchData = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true, error: null }));

    const results = await Promise.allSettled([
      fetch('/api/summary').then(r => r.ok ? r.json() : null),
      fetch('/api/approvals/dashboard').then(r => r.ok ? r.json() : null),
      fetch('/api/cycles').then(r => r.ok ? r.json() : null),
    ]);

    const summary = results[0].status === 'fulfilled' ? results[0].value as DashboardSummaryResponse : null;
    const approvals = results[1].status === 'fulfilled' ? results[1].value as ApprovalDashboardData : null;
    const cycles = results[2].status === 'fulfilled' ? results[2].value as OtbCycle[] : null;

    // Zone separation
    const allBrands = summary?.brands || [];
    const reviewBrands = allBrands.filter(b => b.status === 'InReview');
    const approvedBrands = allBrands.filter(b => b.status === 'Approved');

    // Status distribution
    const statusDistribution: Record<CycleStatus, number> = { Draft: 0, Active: 0, Filling: 0, InReview: 0, Approved: 0 };
    if (cycles) {
      for (const c of cycles) {
        statusDistribution[c.status] = (statusDistribution[c.status] || 0) + 1;
      }
    }

    const allFailed = results.every(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null));

    setData(prev => ({
      ...prev,
      loading: false,
      error: allFailed ? 'Failed to load dashboard data' : null,
      kpiTotals: summary?.kpiTotals || null,
      reviewBrands,
      approvedBrands,
      months: summary?.months || [],
      approvals,
      cycles,
      statusDistribution,
    }));
  }, []);

  // Lazy-load variance for a specific cycle
  const loadVariance = useCallback(async (cycleId: string) => {
    if (data.varianceCache[cycleId]) return; // already cached

    try {
      const res = await fetch(`/api/cycles/${cycleId}/variance`);
      if (!res.ok) return;
      const variance = await res.json() as VarianceReportData;
      setData(prev => ({
        ...prev,
        varianceCache: { ...prev.varianceCache, [cycleId]: variance },
      }));
    } catch {
      // Silently fail — variance zone shows "no actuals" message
    }
  }, [data.varianceCache]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refresh: fetchData, loadVariance };
}
```

### Step 4: Run test to verify it passes

Run: `cd otb-automation && npx vitest run tests/unit/useDashboardData.test.ts`
Expected: PASS

### Step 5: Commit

```bash
cd otb-automation
git add src/hooks/useDashboardData.ts tests/unit/useDashboardData.test.ts
git commit -m "feat: rewrite useDashboardData hook with zone separation and lazy variance loading"
```

---

## Task 5: Redesign the Executive Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`

### Step 1: Verify existing page renders without errors

Run: `cd otb-automation && npx vitest run tests/unit/brandPanel.test.tsx tests/unit/useDashboardData.test.ts`
Expected: PASS (all prerequisite components work)

### Step 2: Rewrite `src/app/page.tsx`

Replace the entire file:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography, Row, Col, Badge, Button, Empty, Alert, Space,
} from 'antd';
import {
  DollarOutlined, ShoppingCartOutlined, BarChartOutlined,
  InboxOutlined, ClockCircleOutlined, DatabaseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { MetricCard } from '@/components/ui/MetricCard';
import { BrandPanel } from '@/components/ui/BrandPanel';
import { DashboardSkeleton } from '@/components/ui/PageSkeleton';
import { COLORS, SPACING } from '@/lib/designTokens';
import { formatCrore, formatQty } from '@/lib/formatting';

const { Title, Text } = Typography;

function getCurrentQuarter(): string {
  const now = new Date();
  const month = now.getMonth();
  const fyYear = month >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const q = month >= 3 ? Math.ceil((month - 2) / 3) : 4;
  return `Q${q} FY${String(fyYear).slice(-2)}`;
}

export default function CxoDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const dashboard = useDashboardData();

  // GDs redirect to cycles
  useEffect(() => {
    if (profile?.role === 'GD') {
      router.replace('/cycles');
    }
  }, [profile, router]);

  if (profile?.role === 'GD') return null;

  if (dashboard.loading) return <DashboardSkeleton />;

  if (dashboard.error) {
    return (
      <Alert
        type="error"
        message="Failed to load dashboard"
        description={dashboard.error}
        action={<Button onClick={dashboard.refresh}>Retry</Button>}
      />
    );
  }

  const { kpiTotals, reviewBrands, approvedBrands, approvals } = dashboard;
  const hasApprovedData = kpiTotals && kpiTotals.gmv > 0;

  // Match approval progress from approvals API to brand cycle_id
  const getApprovalProgress = (cycleId: string) => {
    const brandApproval = approvals?.brands?.find(b => b.cycle_id === cycleId);
    return brandApproval?.approval_progress;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.xl }}>
        <div>
          <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>Executive Dashboard</Title>
          <Text type="secondary">{getCurrentQuarter()} Overview</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={dashboard.refresh}>Refresh</Button>
      </div>

      {/* KPI Row — Approved cycles only */}
      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xxl }}>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="GMV"
            value={hasApprovedData ? formatCrore(kpiTotals.gmv) : '-'}
            icon={<DollarOutlined />}
            color={COLORS.info}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="NSV"
            value={hasApprovedData ? formatCrore(kpiTotals.nsv) : '-'}
            icon={<ShoppingCartOutlined />}
            color={COLORS.accent}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Total NSQ"
            value={hasApprovedData ? formatQty(kpiTotals.nsq) : '-'}
            icon={<BarChartOutlined />}
            color={COLORS.success}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Total Inwards"
            value={hasApprovedData ? formatQty(kpiTotals.inwards_qty) : '-'}
            icon={<InboxOutlined />}
            color={COLORS.warning}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Avg DoH"
            value={hasApprovedData ? Math.round(kpiTotals.avg_doh) : '-'}
            icon={<ClockCircleOutlined />}
            color={hasApprovedData && kpiTotals.avg_doh <= 45 ? COLORS.success : hasApprovedData && kpiTotals.avg_doh <= 60 ? COLORS.warning : COLORS.danger}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Closing Stock"
            value={hasApprovedData ? formatQty(kpiTotals.closing_stock_qty) : '-'}
            icon={<DatabaseOutlined />}
            color={COLORS.neutral600}
          />
        </Col>
      </Row>

      {!hasApprovedData && (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: SPACING.xl }}>
          No approved plans yet. KPI totals will appear once plans are approved.
        </Text>
      )}

      {/* Zone 1 — Pending Review */}
      <div style={{ marginBottom: SPACING.xxl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
          <Title level={4} style={{ margin: 0, color: COLORS.textPrimary }}>Pending Review</Title>
          <Badge count={reviewBrands.length} style={{ backgroundColor: COLORS.accent }} />
        </div>
        {reviewBrands.length > 0 ? (
          reviewBrands.map(brand => (
            <BrandPanel
              key={brand.cycle_id}
              brand={brand}
              zone="review"
              approvalProgress={getApprovalProgress(brand.cycle_id)}
              onApprove={(cycleId) => router.push(`/cycles/${cycleId}?action=approve`)}
              onRequestRevision={(cycleId) => router.push(`/cycles/${cycleId}?action=revision`)}
            />
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No cycles pending review" />
        )}
      </div>

      {/* Zone 2 — Approved Plans */}
      <div style={{ marginBottom: SPACING.xxl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
          <Title level={4} style={{ margin: 0, color: COLORS.textPrimary }}>Approved Plans</Title>
          <Badge count={approvedBrands.length} style={{ backgroundColor: COLORS.success }} />
        </div>
        {approvedBrands.length > 0 ? (
          approvedBrands.map(brand => (
            <BrandPanel
              key={brand.cycle_id}
              brand={brand}
              zone="approved"
            />
          ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No approved plans" />
        )}
      </div>

      {/* Zone 3 — Actuals vs Plan */}
      <div style={{ marginBottom: SPACING.xxl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
          <Title level={4} style={{ margin: 0, color: COLORS.textPrimary }}>Actuals vs Plan</Title>
        </div>
        {approvedBrands.length > 0 ? (
          approvedBrands.map(brand => (
            <BrandPanel
              key={`var-${brand.cycle_id}`}
              brand={brand}
              zone="variance"
              variance={dashboard.varianceCache[brand.cycle_id] || null}
              onLoadVariance={dashboard.loadVariance}
            />
          ))
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                <Text type="secondary">No actuals uploaded yet.</Text><br />
                <Text type="secondary" style={{ fontSize: 12 }}>Upload actuals in an approved cycle to see variance here.</Text>
              </span>
            }
          />
        )}
      </div>
    </div>
  );
}
```

### Step 3: Verify build compiles

Run: `cd otb-automation && npx tsc --noEmit`
Expected: No type errors

### Step 4: Commit

```bash
cd otb-automation
git add src/app/page.tsx
git commit -m "feat: redesign executive dashboard with three-zone CXO layout"
```

---

## Task 6: Remove Summary Page and Update Navigation

**Files:**
- Delete: `src/app/summary/page.tsx`
- Delete: `src/components/CrossBrandSummary.tsx`
- Modify: `src/components/AppLayout.tsx`

### Step 1: Remove the Cross-Brand Summary nav item from AppLayout

In `src/components/AppLayout.tsx`, remove lines 53-55 (the `/summary` nav item):

```typescript
// REMOVE this block:
  if (hasPermission(role, 'view_cross_brand_summary')) {
    navItems.push({ key: '/summary', icon: <BarChartOutlined />, label: 'Cross-Brand Summary' });
  }
```

Also remove the `BarChartOutlined` import since it's no longer used in this file (check if other icons from the same import are still used — only remove `BarChartOutlined`).

### Step 2: Delete the summary page

Run: `rm otb-automation/src/app/summary/page.tsx && rmdir otb-automation/src/app/summary`

### Step 3: Delete the CrossBrandSummary component

Run: `rm otb-automation/src/components/CrossBrandSummary.tsx`

### Step 4: Remove "View Details" link from old dashboard code

Verify no remaining references to `/summary` in `page.tsx`. The rewrite in Task 5 already removed it, but confirm:

Run: `grep -r '/summary' otb-automation/src/app/page.tsx otb-automation/src/components/AppLayout.tsx`
Expected: No matches

### Step 5: Verify build compiles

Run: `cd otb-automation && npx tsc --noEmit`
Expected: No type errors

### Step 6: Commit

```bash
cd otb-automation
git add -A
git commit -m "refactor: remove /summary page and Cross-Brand Summary nav item"
```

---

## Task 7: Run All Tests and Fix Any Failures

### Step 1: Run full test suite

Run: `cd otb-automation && npx vitest run`

### Step 2: Fix any failing tests

Existing tests may reference old `SummaryData` type or old `useDashboardData` shape. Update imports and assertions as needed.

Check specifically:
- Any test importing from `CrossBrandSummary.tsx` — remove or update
- Any test importing old `SummaryData` interface — switch to `DashboardSummaryResponse`
- Any test that hits `/api/summary` and expects old response shape — update to expect `kpiTotals` and `brands` with new fields

### Step 3: Verify build

Run: `cd otb-automation && npm run build`
Expected: Build succeeds

### Step 4: Commit

```bash
cd otb-automation
git add -A
git commit -m "fix: update tests for enhanced dashboard summary API shape"
```

---

## Task 8: Final Verification and Lint

### Step 1: Run lint

Run: `cd otb-automation && npm run lint`
Expected: No lint errors

### Step 2: Run all tests one final time

Run: `cd otb-automation && npx vitest run`
Expected: All tests pass

### Step 3: Verify dev server renders

Run: `cd otb-automation && npm run dev` — open http://localhost:3000 and verify:
- KPI row shows 6 metrics (or dashes if no approved plans)
- Zone 1 shows InReview cycles with expandable brand panels
- Zone 2 shows Approved cycles with expandable brand panels
- Zone 3 shows Actuals vs Plan (or "no actuals" message)
- `/summary` route returns 404
- Sidebar no longer shows "Cross-Brand Summary" link

### Step 4: Commit if any fixes needed

```bash
cd otb-automation
git add -A
git commit -m "chore: lint fixes and final cleanup for dashboard redesign"
```
