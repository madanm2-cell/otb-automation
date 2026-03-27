import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildVarianceMetric, getTopVariances } from '@/lib/varianceEngine';
import {
  DEFAULT_VARIANCE_THRESHOLDS,
  type VarianceRow,
  type VarianceReportData,
  type VarianceSummary,
  type VarianceLevel,
} from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId/variance — variance report (plan vs actuals)
export const GET = withAuth('view_variance', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  // 1. Fetch cycle with brand name
  const { data: cycle, error: cycleError } = await supabase
    .from('otb_cycles')
    .select('*, brands(brand_name)')
    .eq('id', cycleId)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  const brandName = (cycle.brands as any)?.brand_name ?? 'Unknown';
  const planningQuarter = cycle.planning_quarter ?? '';

  // 2. Fetch all actuals for this cycle
  const { data: actuals, error: actualsError } = await supabase
    .from('otb_actuals')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('month');

  if (actualsError) {
    return NextResponse.json({ error: actualsError.message }, { status: 500 });
  }

  if (!actuals || actuals.length === 0) {
    return NextResponse.json(
      { error: 'No actuals data found for this cycle.' },
      { status: 404 }
    );
  }

  // 3. Fetch all plan rows for this cycle
  const { data: planRows, error: rowError } = await supabase
    .from('otb_plan_rows')
    .select('*')
    .eq('cycle_id', cycleId);

  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }

  // 4. Fetch plan data for all rows
  const rowIds = (planRows ?? []).map(r => r.id);
  const allPlanData: Record<string, unknown>[] = [];
  const BATCH = 200;

  for (let i = 0; i < rowIds.length; i += BATCH) {
    const batch = rowIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('otb_plan_data')
      .select('*')
      .in('row_id', batch);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (data) allPlanData.push(...data);
  }

  // Index plan data by dimension key + month for fast lookup
  type PlanDataEntry = Record<string, unknown>;
  const planDataMap = new Map<string, PlanDataEntry>();

  // Also index plan rows by id for dimension lookup
  const planRowById = new Map<string, Record<string, unknown>>();
  for (const row of planRows ?? []) {
    planRowById.set(row.id, row);
  }

  for (const pd of allPlanData) {
    const row = planRowById.get(pd.row_id as string);
    if (!row) continue;
    const key = makeDimensionKey(
      row.sub_brand as string,
      row.wear_type as string,
      row.sub_category as string,
      row.gender as string,
      row.channel as string,
      pd.month as string,
    );
    planDataMap.set(key, pd);
  }

  // 5. Build variance rows
  const monthSet = new Set<string>();
  const varianceRows: VarianceRow[] = [];

  for (const actual of actuals) {
    const monthStr = actual.month as string;
    monthSet.add(monthStr);

    const key = makeDimensionKey(
      actual.sub_brand,
      actual.wear_type,
      actual.sub_category,
      actual.gender,
      actual.channel,
      monthStr,
    );

    const planned = planDataMap.get(key);

    const plannedNsq = (planned?.nsq as number | null) ?? null;
    const plannedGmv = (planned?.sales_plan_gmv as number | null) ?? null;
    const plannedInwards = (planned?.inwards_qty as number | null) ?? null;
    const plannedClosingStock = (planned?.closing_stock_qty as number | null) ?? null;

    const row: VarianceRow = {
      sub_brand: actual.sub_brand,
      wear_type: actual.wear_type,
      sub_category: actual.sub_category,
      gender: actual.gender,
      channel: actual.channel,
      month: monthStr,
      nsq: buildVarianceMetric('nsq', actual.actual_nsq, plannedNsq, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct),
      gmv: buildVarianceMetric('gmv', actual.actual_gmv, plannedGmv, DEFAULT_VARIANCE_THRESHOLDS.gmv_pct),
      inwards: buildVarianceMetric('inwards', actual.actual_inwards_qty, plannedInwards, DEFAULT_VARIANCE_THRESHOLDS.inwards_pct),
      closing_stock: buildVarianceMetric('closing_stock', actual.actual_closing_stock_qty, plannedClosingStock, DEFAULT_VARIANCE_THRESHOLDS.closing_stock_pct),
    };

    varianceRows.push(row);
  }

  // 6. Compute summary
  let redCount = 0;
  let yellowCount = 0;
  let greenCount = 0;

  for (const row of varianceRows) {
    const worstLevel = getWorstLevel([
      row.nsq.level,
      row.gmv.level,
      row.inwards.level,
      row.closing_stock.level,
    ]);

    if (worstLevel === 'red') redCount++;
    else if (worstLevel === 'yellow') yellowCount++;
    else greenCount++;
  }

  const topVariances = getTopVariances(varianceRows, 10);

  const summary: VarianceSummary = {
    total_rows: varianceRows.length,
    red_count: redCount,
    yellow_count: yellowCount,
    green_count: greenCount,
    top_variances: topVariances,
  };

  const months = Array.from(monthSet).sort();

  const report: VarianceReportData = {
    cycle_id: cycleId,
    cycle_name: cycle.cycle_name,
    brand_name: brandName,
    planning_quarter: planningQuarter,
    months,
    rows: varianceRows,
    summary,
  };

  return NextResponse.json(report);
});

// Helper: build a dimension lookup key
function makeDimensionKey(
  subBrand: string,
  wearType: string,
  subCategory: string,
  gender: string,
  channel: string,
  month: string,
): string {
  return `${subBrand}|${wearType}|${subCategory}|${gender}|${channel}|${month}`;
}

// Helper: determine the worst variance level from a set of levels
function getWorstLevel(levels: VarianceLevel[]): VarianceLevel {
  if (levels.includes('red')) return 'red';
  if (levels.includes('yellow')) return 'yellow';
  return 'green';
}
