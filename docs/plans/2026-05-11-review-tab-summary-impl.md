# Review Tab Plan Summary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a plan summary (KPI tiles + monthly breakdown + top categories) above the approval panel in the Review tab so stakeholders have data context before approving.

**Architecture:** New `GET /api/cycles/[cycleId]/summary` endpoint aggregates plan data server-side (same logic as `/api/summary` but scoped to one cycle). New `ReviewSummary` component fetches it and renders the three sections. Wired into `ReviewTabContent` above the existing `ApprovalPanel`.

**Tech Stack:** Next.js App Router API routes, Supabase, Ant Design (Row/Col/Table/MetricCard), TypeScript

---

### Task 1: Create the cycle summary API endpoint

**Files:**
- Create: `src/app/api/cycles/[cycleId]/summary/route.ts`

**Step 1: Create the file**

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import type { BrandMonthBreakdown, CategoryBreakdown } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

export const GET = withAuth(null, async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('id, sub_category')
    .eq('cycle_id', cycleId);

  if (!planRows || planRows.length === 0) {
    return NextResponse.json({
      gmv: 0, nsv: 0, nsq: 0, inwards_qty: 0, avg_doh: 0, closing_stock_qty: 0,
      monthly: [], top_categories: [],
    });
  }

  const rowIds = planRows.map(r => r.id);
  const rowToSubCategory: Record<string, string> = {};
  for (const r of planRows) rowToSubCategory[r.id] = r.sub_category;

  type PlanDataRow = {
    row_id: string; month: string;
    sales_plan_gmv: number; nsv: number; nsq: number;
    inwards_qty: number; closing_stock_qty: number; fwd_30day_doh: number;
  };
  const allPlanData: PlanDataRow[] = [];
  const BATCH = 200;
  for (let i = 0; i < rowIds.length; i += BATCH) {
    const { data } = await supabase
      .from('otb_plan_data')
      .select('row_id, month, sales_plan_gmv, nsv, nsq, inwards_qty, closing_stock_qty, fwd_30day_doh')
      .in('row_id', rowIds.slice(i, i + BATCH));
    if (data) allPlanData.push(...(data as PlanDataRow[]));
  }

  let totalGmv = 0, totalNsv = 0, totalNsq = 0, totalInwards = 0, totalClosing = 0;
  let dohSum = 0, dohCount = 0;
  type MonthAgg = { gmv: number; nsv: number; nsq: number; inwards_qty: number; closing_stock_qty: number; dohSum: number; dohCount: number };
  const monthData: Record<string, MonthAgg> = {};
  const categoryData: Record<string, { gmv: number; nsq: number; inwards_qty: number }> = {};

  for (const pd of allPlanData) {
    totalGmv += pd.sales_plan_gmv || 0;
    totalNsv += pd.nsv || 0;
    totalNsq += pd.nsq || 0;
    totalInwards += pd.inwards_qty || 0;
    totalClosing += pd.closing_stock_qty || 0;
    if (pd.fwd_30day_doh != null) { dohSum += pd.fwd_30day_doh; dohCount++; }

    if (pd.month) {
      if (!monthData[pd.month]) {
        monthData[pd.month] = { gmv: 0, nsv: 0, nsq: 0, inwards_qty: 0, closing_stock_qty: 0, dohSum: 0, dohCount: 0 };
      }
      const m = monthData[pd.month];
      m.gmv += pd.sales_plan_gmv || 0;
      m.nsv += pd.nsv || 0;
      m.nsq += pd.nsq || 0;
      m.inwards_qty += pd.inwards_qty || 0;
      m.closing_stock_qty += pd.closing_stock_qty || 0;
      if (pd.fwd_30day_doh != null) { m.dohSum += pd.fwd_30day_doh; m.dohCount++; }
    }

    const cat = rowToSubCategory[pd.row_id] || 'Unknown';
    if (!categoryData[cat]) categoryData[cat] = { gmv: 0, nsq: 0, inwards_qty: 0 };
    categoryData[cat].gmv += pd.sales_plan_gmv || 0;
    categoryData[cat].nsq += pd.nsq || 0;
    categoryData[cat].inwards_qty += pd.inwards_qty || 0;
  }

  const monthly: BrandMonthBreakdown[] = Object.keys(monthData).sort().map(month => {
    const m = monthData[month];
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

  const top_categories: CategoryBreakdown[] = Object.entries(categoryData)
    .map(([sub_category, data]) => ({
      sub_category,
      gmv: data.gmv,
      nsq: data.nsq,
      inwards_qty: data.inwards_qty,
      pct_of_total: totalGmv > 0 ? (data.gmv / totalGmv) * 100 : 0,
    }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 10);

  return NextResponse.json({
    gmv: totalGmv,
    nsv: totalNsv,
    nsq: totalNsq,
    inwards_qty: totalInwards,
    avg_doh: dohCount > 0 ? dohSum / dohCount : 0,
    closing_stock_qty: totalClosing,
    monthly,
    top_categories,
  });
});
```

**Step 2: Verify the dev server compiles without errors**

Run: `cd otb-automation && npm run build 2>&1 | tail -20`
Expected: No TypeScript errors on the new file.

**Step 3: Commit**

```bash
git add src/app/api/cycles/[cycleId]/summary/route.ts
git commit -m "feat(review): add cycle summary API endpoint"
```

---

### Task 2: Create the ReviewSummary component

**Files:**
- Create: `src/components/cycle-workspace/ReviewSummary.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Row, Col, Table, Typography, Skeleton, Alert } from 'antd';
import {
  DollarOutlined, ShoppingCartOutlined, BarChartOutlined,
  InboxOutlined, ClockCircleOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { MetricCard } from '@/components/ui/MetricCard';
import { COLORS, SPACING } from '@/lib/designTokens';
import { formatCrore, formatQty } from '@/lib/formatting';
import type { BrandMonthBreakdown, CategoryBreakdown } from '@/types/otb';

const { Text } = Typography;

interface CycleSummary {
  gmv: number;
  nsv: number;
  nsq: number;
  inwards_qty: number;
  avg_doh: number;
  closing_stock_qty: number;
  monthly: BrandMonthBreakdown[];
  top_categories: CategoryBreakdown[];
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

const SECTION_LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: COLORS.textMuted,
  marginBottom: SPACING.sm,
};

const monthlyColumns = [
  { title: 'Month', dataIndex: 'month', key: 'month', render: (v: string) => formatMonth(v) },
  { title: 'GMV', dataIndex: 'gmv', key: 'gmv', render: (v: number) => formatCrore(v) },
  { title: 'NSV', dataIndex: 'nsv', key: 'nsv', render: (v: number) => formatCrore(v) },
  { title: 'NSQ', dataIndex: 'nsq', key: 'nsq', render: (v: number) => formatQty(v) },
  { title: 'Inwards', dataIndex: 'inwards_qty', key: 'inwards_qty', render: (v: number) => formatQty(v) },
  { title: 'Closing Stock', dataIndex: 'closing_stock_qty', key: 'closing_stock_qty', render: (v: number) => formatQty(v) },
  { title: 'DoH', dataIndex: 'avg_doh', key: 'avg_doh', render: (v: number) => String(Math.round(v)) },
];

const categoryColumns = [
  { title: 'Sub-Category', dataIndex: 'sub_category', key: 'sub_category' },
  { title: 'GMV', dataIndex: 'gmv', key: 'gmv', render: (v: number) => formatCrore(v) },
  { title: 'NSQ', dataIndex: 'nsq', key: 'nsq', render: (v: number) => formatQty(v) },
  { title: 'Inwards', dataIndex: 'inwards_qty', key: 'inwards_qty', render: (v: number) => formatQty(v) },
  { title: 'GMV Share', dataIndex: 'pct_of_total', key: 'pct_of_total', render: (v: number) => `${v.toFixed(1)}%` },
];

export function ReviewSummary({ cycleId }: { cycleId: string }) {
  const [summary, setSummary] = useState<CycleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cycles/${cycleId}/summary`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `Failed to load summary (${res.status})`);
        }
        return res.json() as Promise<CycleSummary>;
      })
      .then(setSummary)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [cycleId]);

  if (loading) return <Skeleton active paragraph={{ rows: 4 }} style={{ marginBottom: SPACING.xl }} />;
  if (error) return <Alert type="error" message={error} showIcon style={{ marginBottom: SPACING.xl }} />;
  if (!summary) return null;

  const dohColor = !summary.avg_doh ? COLORS.neutral600
    : summary.avg_doh <= 45 ? COLORS.success
    : summary.avg_doh <= 60 ? COLORS.warning
    : COLORS.danger;

  return (
    <div style={{ marginBottom: SPACING.xl }}>
      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xl }}>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="GMV" value={formatCrore(summary.gmv)} icon={<DollarOutlined />} color={COLORS.info} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="NSV" value={formatCrore(summary.nsv)} icon={<ShoppingCartOutlined />} color={COLORS.accent} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="NSQ" value={formatQty(summary.nsq)} icon={<BarChartOutlined />} color={COLORS.success} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="Inwards" value={formatQty(summary.inwards_qty)} icon={<InboxOutlined />} color={COLORS.warning} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="Avg DoH" value={summary.avg_doh ? Math.round(summary.avg_doh) : '-'} icon={<ClockCircleOutlined />} color={dohColor} size="compact" />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard title="Closing Stock" value={formatQty(summary.closing_stock_qty)} icon={<DatabaseOutlined />} color={COLORS.neutral600} size="compact" />
        </Col>
      </Row>

      {summary.monthly.length > 0 && (
        <div style={{ marginBottom: SPACING.xl }}>
          <Text style={SECTION_LABEL}>Monthly Breakdown</Text>
          <Table
            dataSource={summary.monthly}
            columns={monthlyColumns}
            rowKey="month"
            size="small"
            pagination={false}
          />
        </div>
      )}

      {summary.top_categories.length > 0 && (
        <div style={{ marginBottom: SPACING.xl }}>
          <Text style={SECTION_LABEL}>Sub-Categories by GMV</Text>
          <Table
            dataSource={summary.top_categories}
            columns={categoryColumns}
            rowKey="sub_category"
            size="small"
            pagination={false}
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/cycle-workspace/ReviewSummary.tsx
git commit -m "feat(review): add ReviewSummary component with KPI tiles and breakdowns"
```

---

### Task 3: Wire ReviewSummary into ReviewTabContent

**Files:**
- Modify: `src/components/cycle-workspace/ReviewTabContent.tsx`

**Step 1: Add import and insert component**

Replace the entire file contents with:

```tsx
'use client';

import { useState } from 'react';
import { Button, Space } from 'antd';
import { CommentOutlined } from '@ant-design/icons';
import { ApprovalPanel } from '@/components/ApprovalPanel';
import { CommentsPanel } from '@/components/CommentsPanel';
import { ReviewSummary } from './ReviewSummary';
import type { CycleStatus, OtbCycle } from '@/types/otb';

interface ReviewTabContentProps {
  cycleId: string;
  cycleStatus: CycleStatus;
  onCycleUpdated?: (cycle: OtbCycle) => void;
}

export function ReviewTabContent({
  cycleId,
  cycleStatus,
  onCycleUpdated,
}: ReviewTabContentProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);

  const handleStatusChange = async (_newStatus: string) => {
    if (!onCycleUpdated) return;
    try {
      const res = await fetch(`/api/cycles/${cycleId}`);
      if (res.ok) {
        const cycle = (await res.json()) as OtbCycle;
        onCycleUpdated(cycle);
      }
    } catch {
      // Non-fatal: ApprovalPanel already surfaced its own toast on the action.
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <ReviewSummary cycleId={cycleId} />

      <ApprovalPanel
        cycleId={cycleId}
        cycleStatus={cycleStatus}
        onStatusChange={handleStatusChange}
      />

      <div>
        <Button icon={<CommentOutlined />} onClick={() => setCommentsOpen(true)}>
          Comments
        </Button>
        <CommentsPanel
          cycleId={cycleId}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
      </div>
    </Space>
  );
}
```

**Step 2: Run the build to verify no TypeScript errors**

```bash
cd otb-automation && npm run build 2>&1 | tail -30
```
Expected: Clean build, no errors.

**Step 3: Commit**

```bash
git add src/components/cycle-workspace/ReviewTabContent.tsx
git commit -m "feat(review): wire plan summary into Review tab above approval panel"
```

---

### Task 4: Smoke-test in the browser

1. Start the dev server: `npm run dev`
2. Navigate to any cycle in `InReview` status → click the **Review** tab
3. Verify:
   - Six KPI tiles appear (GMV, NSV, NSQ, Inwards, Avg DoH, Closing Stock) with correct values
   - Monthly breakdown table shows one row per quarter month
   - Sub-categories table shows categories ordered by GMV descending
   - Approval panel and Comments button still appear below
   - No console errors
4. If the cycle has no plan data yet: verify a skeleton loader appears then disappears (no crash)
