import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import type { PlanRow, PlanMonthData } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId/plan-data — all plan rows with monthly data
export const GET = withAuth(null, async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  // Get cycle to know the months
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('planning_period_start, planning_period_end')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  // Get all plan rows for this cycle
  const { data: rows, error: rowError } = await supabase
    .from('otb_plan_rows')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('sub_brand')
    .order('wear_type')
    .order('sub_category')
    .order('gender')
    .order('channel');

  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ months: [], rows: [] });
  }

  // Get all plan data for these rows
  const rowIds = rows.map(r => r.id);

  // Batch fetch (Supabase `in` filter has a limit, batch if needed)
  const allPlanData: Record<string, unknown>[] = [];
  const BATCH = 200;
  for (let i = 0; i < rowIds.length; i += BATCH) {
    const batch = rowIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('otb_plan_data')
      .select('*')
      .in('row_id', batch)
      .order('month');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (data) allPlanData.push(...data);
  }

  // Group plan data by row_id
  const dataByRow = new Map<string, Record<string, PlanMonthData>>();
  const monthSet = new Set<string>();

  for (const d of allPlanData) {
    const rowId = d.row_id as string;
    const month = d.month as string;
    monthSet.add(month);

    if (!dataByRow.has(rowId)) {
      dataByRow.set(rowId, {});
    }

    dataByRow.get(rowId)![month] = {
      id: d.id as string,
      month,
      asp: d.asp as number | null,
      cogs: d.cogs as number | null,
      opening_stock_qty: d.opening_stock_qty as number | null,
      ly_sales_nsq: d.ly_sales_nsq as number | null,
      recent_sales_nsq: d.recent_sales_nsq as number | null,
      soft_forecast_nsq: d.soft_forecast_nsq as number | null,
      return_pct: d.return_pct as number | null,
      tax_pct: d.tax_pct as number | null,
      sellex_pct: d.sellex_pct as number | null,
      standard_doh: d.standard_doh as number | null,
      nsq: d.nsq as number | null,
      inwards_qty: d.inwards_qty as number | null,
      perf_marketing_pct: d.perf_marketing_pct as number | null,
      sales_plan_gmv: d.sales_plan_gmv as number | null,
      goly_pct: d.goly_pct as number | null,
      nsv: d.nsv as number | null,
      inwards_val_cogs: d.inwards_val_cogs as number | null,
      opening_stock_val: d.opening_stock_val as number | null,
      closing_stock_qty: d.closing_stock_qty as number | null,
      fwd_30day_doh: d.fwd_30day_doh as number | null,
      gm_pct: d.gm_pct as number | null,
      gross_margin: d.gross_margin as number | null,
      cm1: d.cm1 as number | null,
      cm2: d.cm2 as number | null,
    };
  }

  // Build response
  const months = Array.from(monthSet).sort();
  const planRows: PlanRow[] = rows.map(r => ({
    id: r.id,
    cycle_id: r.cycle_id,
    sub_brand: r.sub_brand,
    wear_type: r.wear_type,
    sub_category: r.sub_category,
    gender: r.gender,
    channel: r.channel,
    months: dataByRow.get(r.id) || {},
  }));

  return NextResponse.json({ months, rows: planRows });
});
