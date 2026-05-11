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
