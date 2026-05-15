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

export const GET = withAuth('view_variance', async (req, _auth, { params }: Params) => {
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

  const brandId = (cycle.brands as { id: string } | null)?.id ?? '';
  const brandName = (cycle.brands as { id: string; name?: string } | null)?.name ?? 'Unknown';

  // 2. Fetch brand thresholds (merge with defaults)
  const { data: thresholdRows } = await supabase
    .from('brand_variance_thresholds')
    .select('*')
    .eq('brand_id', brandId);

  const thresholds: VarianceThresholds = { ...DEFAULT_VARIANCE_THRESHOLDS };
  for (const row of (thresholdRows ?? []) as BrandVarianceThreshold[]) {
    if (row.metric in thresholds) {
      (thresholds as unknown as Record<string, number>)[row.metric] = row.threshold_pct;
    }
  }

  // 3. Fetch actuals for this cycle
  const { data: actuals, error: actualsError } = await supabase
    .from('otb_actuals')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('month');

  if (actualsError) {
    return NextResponse.json({ error: actualsError.message }, { status: 500 });
  }
  if (!actuals || actuals.length === 0) {
    return NextResponse.json({ error: 'No actuals data found for this cycle.' }, { status: 404 });
  }

  // 4. Fetch plan rows + plan data
  const { data: planRows, error: rowError } = await supabase
    .from('otb_plan_rows')
    .select('*')
    .eq('cycle_id', cycleId);

  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }

  const rowIds = (planRows ?? []).map((r: Record<string, unknown>) => r.id as string);
  const allPlanData: Record<string, unknown>[] = [];
  const BATCH = 200;

  for (let i = 0; i < rowIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from('otb_plan_data')
      .select('*')
      .in('row_id', rowIds.slice(i, i + BATCH));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data) allPlanData.push(...(data as Record<string, unknown>[]));
  }

  // 5. Build indexes
  const planRowById = new Map<string, Record<string, unknown>>();
  for (const row of planRows ?? []) {
    planRowById.set(row.id as string, row as Record<string, unknown>);
  }

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

  // 6. Build variance rows
  const actualsMonthSet = new Set<string>();
  const channelSet = new Set<string>();
  const varianceRows: VarianceRow[] = [];

  for (const actual of actuals as Record<string, unknown>[]) {
    const month = actual.month as string;
    actualsMonthSet.add(month);
    channelSet.add(actual.channel as string);

    const planned = planDataMap.get(dimKey(
      actual.sub_brand as string, actual.wear_type as string,
      actual.sub_category as string, actual.gender as string,
      actual.channel as string, month,
    ));

    const nextPlanned = planDataMap.get(dimKey(
      actual.sub_brand as string, actual.wear_type as string,
      actual.sub_category as string, actual.gender as string,
      actual.channel as string, nextMonthIso(month),
    ));

    varianceRows.push({
      sub_brand: actual.sub_brand as string,
      wear_type: actual.wear_type as string,
      sub_category: actual.sub_category as string,
      gender: actual.gender as string,
      channel: actual.channel as string,
      month,
      nsq: buildVarianceMetric('nsq_pct', actual.actual_nsq as number | null, (planned?.nsq as number | null) ?? null, thresholds.nsq_pct),
      gmv: buildVarianceMetric('gmv_pct', actual.actual_gmv as number | null, (planned?.sales_plan_gmv as number | null) ?? null, thresholds.gmv_pct),
      nsv: buildVarianceMetric('nsv_pct', actual.actual_nsv as number | null, (planned?.nsv as number | null) ?? null, thresholds.nsv_pct),
      inwards: buildVarianceMetric('inwards_pct', actual.actual_inwards_qty as number | null, (planned?.inwards_qty as number | null) ?? null, thresholds.inwards_pct),
      closing_stock: buildVarianceMetric('closing_stock_pct', actual.actual_closing_stock_qty as number | null, (planned?.closing_stock_qty as number | null) ?? null, thresholds.closing_stock_pct),
      doh: buildVarianceMetric('doh_pct', actual.actual_doh as number | null, (planned?.fwd_30day_doh as number | null) ?? null, thresholds.doh_pct),
      nextMonthPlannedNsq: (nextPlanned?.nsq as number | null) ?? null,
    });
  }

  const report: VarianceReportData = {
    cycle_id: cycleId,
    cycle_name: cycle.cycle_name as string,
    brand_name: brandName,
    brand_id: brandId,
    planning_quarter: (cycle.planning_quarter as string) ?? '',
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

function nextMonthIso(month: string): string {
  const d = new Date(month);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
