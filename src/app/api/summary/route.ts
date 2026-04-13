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
  let planData: Record<string, unknown>[] = [];
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
      brand_name: (c.brands as { name?: string } | null)?.name || 'Unknown',
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
