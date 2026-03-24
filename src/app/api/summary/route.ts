import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';

// GET /api/summary — cross-brand OTB summary with aggregated metrics
export const GET = withAuth('view_cross_brand_summary', async (req, auth) => {
  const supabase = await createServerClient();
  const url = new URL(req.url);
  const quarter = url.searchParams.get('quarter');

  // Get cycles with meaningful data (InReview or Approved)
  let cycleQuery = supabase
    .from('otb_cycles')
    .select('id, cycle_name, brand_id, planning_quarter, status, brands(name)')
    .in('status', ['InReview', 'Approved']);

  if (quarter) {
    cycleQuery = cycleQuery.eq('planning_quarter', quarter);
  }

  const { data: cycles, error: cyclesError } = await cycleQuery;
  if (cyclesError) return NextResponse.json({ error: cyclesError.message }, { status: 500 });

  if (!cycles || cycles.length === 0) {
    return NextResponse.json({
      totals: { nsr: 0, cogs: 0, gmPct: 0, inwardsQty: 0, avgDoh: 0 },
      brands: [],
      months: [],
    });
  }

  const cycleIds = cycles.map(c => c.id);

  // Fetch plan rows for these cycles
  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('id, cycle_id')
    .in('cycle_id', cycleIds);

  const rowIds = (planRows || []).map(r => r.id);
  const rowToCycle: Record<string, string> = {};
  for (const r of planRows || []) rowToCycle[r.id] = r.cycle_id;

  let planData: any[] = [];
  if (rowIds.length > 0) {
    const { data } = await supabase
      .from('otb_plan_data')
      .select('row_id, month, nsv, inwards_val_cogs, inwards_qty, fwd_30day_doh, gm_pct, sales_plan_gmv')
      .in('row_id', rowIds);
    planData = data || [];
  }

  // Map cycles to brand info
  const cycleToBrand: Record<string, { brand_id: string; brand_name: string; cycle_name: string; status: string }> = {};
  for (const c of cycles) {
    cycleToBrand[c.id] = {
      brand_id: c.brand_id,
      brand_name: (c.brands as any)?.name || 'Unknown',
      cycle_name: c.cycle_name,
      status: c.status,
    };
  }

  // Aggregate per brand
  interface BrandAgg {
    brand_id: string; brand_name: string; cycle_name: string; status: string;
    totalNsr: number; totalCogs: number; totalInwardsQty: number;
    dohSum: number; dohCount: number; gmPctSum: number; gmPctCount: number;
    monthData: Record<string, { nsr: number; cogs: number; inwardsQty: number }>;
  }

  const brandAgg: Record<string, BrandAgg> = {};
  const allMonths = new Set<string>();

  for (const pd of planData) {
    const cycleId = rowToCycle[pd.row_id];
    if (!cycleId) continue;
    const brandInfo = cycleToBrand[cycleId];
    if (!brandInfo) continue;

    if (!brandAgg[brandInfo.brand_id]) {
      brandAgg[brandInfo.brand_id] = {
        ...brandInfo,
        totalNsr: 0, totalCogs: 0, totalInwardsQty: 0,
        dohSum: 0, dohCount: 0, gmPctSum: 0, gmPctCount: 0,
        monthData: {},
      };
    }

    const agg = brandAgg[brandInfo.brand_id];
    agg.totalNsr += pd.nsv || 0;
    agg.totalCogs += pd.inwards_val_cogs || 0;
    agg.totalInwardsQty += pd.inwards_qty || 0;

    if (pd.fwd_30day_doh != null) { agg.dohSum += pd.fwd_30day_doh; agg.dohCount++; }
    if (pd.gm_pct != null) { agg.gmPctSum += pd.gm_pct; agg.gmPctCount++; }

    if (pd.month) {
      allMonths.add(pd.month);
      if (!agg.monthData[pd.month]) {
        agg.monthData[pd.month] = { nsr: 0, cogs: 0, inwardsQty: 0 };
      }
      agg.monthData[pd.month].nsr += pd.nsv || 0;
      agg.monthData[pd.month].cogs += pd.inwards_val_cogs || 0;
      agg.monthData[pd.month].inwardsQty += pd.inwards_qty || 0;
    }
  }

  // Build brand summaries
  const brands = Object.values(brandAgg).map(agg => ({
    brand_id: agg.brand_id,
    brand_name: agg.brand_name,
    cycle_name: agg.cycle_name,
    status: agg.status,
    nsr: agg.totalNsr,
    cogs: agg.totalCogs,
    gmPct: agg.gmPctCount > 0 ? agg.gmPctSum / agg.gmPctCount : 0,
    inwardsQty: agg.totalInwardsQty,
    avgDoh: agg.dohCount > 0 ? agg.dohSum / agg.dohCount : 0,
    monthData: agg.monthData,
  }));

  // Calculate totals
  const totalNsr = brands.reduce((s, b) => s + b.nsr, 0);
  const totalCogs = brands.reduce((s, b) => s + b.cogs, 0);
  const totalInwardsQty = brands.reduce((s, b) => s + b.inwardsQty, 0);
  const avgGmPct = brands.length > 0 ? brands.reduce((s, b) => s + b.gmPct, 0) / brands.length : 0;
  const avgDoh = brands.length > 0 ? brands.reduce((s, b) => s + b.avgDoh, 0) / brands.length : 0;

  return NextResponse.json({
    totals: { nsr: totalNsr, cogs: totalCogs, gmPct: avgGmPct, inwardsQty: totalInwardsQty, avgDoh },
    brands,
    months: Array.from(allMonths).sort(),
  });
});
