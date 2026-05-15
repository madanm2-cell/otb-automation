import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import type {
  EnhancedBrandSummary,
  BrandMonthBreakdown,
  CategoryBreakdown,
  DashboardKpiTotals,
  DashboardSummaryResponse,
  BrandVarianceSummary,
  VarianceThresholds,
  VarianceLevel,
} from '@/types/otb';
import { DEFAULT_VARIANCE_THRESHOLDS, METRIC_DIRECTIONS } from '@/types/otb';
import { classifyVariance } from '@/lib/varianceEngine';
import { getCurrentQuarterId, getQuarterDates } from '@/lib/quarterUtils';

// Dimension key used to match an actuals row against the corresponding plan_data row.
// Lowercased to match the variance API's behaviour — uploaded actuals and plan
// dimensions sometimes differ in casing.
function dimKey(
  subBrand: string, wearType: string, subCategory: string,
  gender: string, channel: string, month: string,
): string {
  return `${subBrand}|${wearType}|${subCategory}|${gender}|${channel}|${month}`.toLowerCase();
}

interface MetricAccumulator { planned: number; actual: number; hasData: boolean; }

function aggregatePair(
  planned: number | null | undefined,
  actual: number | null | undefined,
  acc: MetricAccumulator,
) {
  if (planned != null && actual != null) {
    acc.planned += planned;
    acc.actual += actual;
    acc.hasData = true;
  }
}

function finalizeMetric(
  acc: MetricAccumulator,
  metricKey: string,
  threshold: number,
) {
  if (!acc.hasData || acc.planned === 0) {
    return { pct: null, level: 'green' as VarianceLevel };
  }
  const pct = ((acc.actual - acc.planned) / acc.planned) * 100;
  const direction = METRIC_DIRECTIONS[metricKey] ?? 'higher_is_good';
  return { pct, level: classifyVariance(pct, threshold, direction) };
}

// GET /api/summary — enhanced cross-brand OTB summary
// Query params:
//   ?quarter=Q1-FY27   — filter by quarter (canonical, hyphenated); defaults to current quarter
//   ?status=Approved   — filter by cycle status (default: InReview,Approved)
//   ?brandId=<uuid>    — restrict to a single brand
//
// Quarter filtering is applied via planning_period_start so it tolerates the
// "Q1-FY27" / "Q1 FY27" string variants present in legacy data.
export const GET = withAuth('view_all_otbs', async (req, auth) => {
  const supabase = await createServerClient();
  const url = new URL(req.url);
  const quarterParam = url.searchParams.get('quarter');
  const statusParam = url.searchParams.get('status');

  // Determine which statuses to fetch
  const statuses = statusParam
    ? [statusParam]
    : ['InReview', 'Approved'];

  // 1. Get cycles
  let cycleQuery = supabase
    .from('otb_cycles')
    .select('id, cycle_name, brand_id, planning_quarter, planning_period_start, status, brands(name)')
    .in('status', statuses);

  // Default to current quarter when not specified — the dashboard surfaces this
  // as "Q1 FY27 Overview", so multi-quarter sums in KPIs would be misleading.
  // Exception: InReview cycles are shown regardless of quarter so that plans
  // submitted for future quarters appear in "Pending Review".
  const effectiveQuarter = quarterParam ?? getCurrentQuarterId();
  let currentQuarterStart: string | null = null;
  try {
    const quarterStart = getQuarterDates(effectiveQuarter).start;
    if (!quarterParam && statuses.includes('InReview') && statuses.includes('Approved')) {
      // Previous quarter start — included so that approved cycles with actuals appear
      // in the Actuals vs Plan section even after the quarter has closed.
      const prevDate = new Date(quarterStart);
      prevDate.setMonth(prevDate.getMonth() - 3);
      const prevQuarterStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`;
      // Default dashboard: all InReview (any quarter) + current-quarter + previous-quarter Approved.
      cycleQuery = cycleQuery.or(
        `planning_period_start.eq.${quarterStart},status.eq.InReview,and(status.eq.Approved,planning_period_start.eq.${prevQuarterStart})`
      );
      currentQuarterStart = quarterStart;
    } else {
      cycleQuery = cycleQuery.eq('planning_period_start', quarterStart);
    }
  } catch {
    // Caller passed a non-canonical string — fall back to direct match.
    cycleQuery = cycleQuery.eq('planning_quarter', effectiveQuarter);
  }

  if (auth.profile.role !== 'Admin' && auth.profile.assigned_brands?.length > 0) {
    cycleQuery = cycleQuery.in('brand_id', auth.profile.assigned_brands);
  }

  const brandId = url.searchParams.get('brandId');
  if (brandId) {
    cycleQuery = cycleQuery.eq('brand_id', brandId);
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
  // Maps cycle_id → planning_period_start for current-quarter checks used in brand building and KPI totals.
  const cycleStartById = new Map(cycles.map(c => [c.id, c.planning_period_start]));

  // Determine which cycles have actuals uploaded
  const cyclesWithActuals = new Set<string>();
  if (cycleIds.length > 0) {
    const { data: actualsCheck } = await supabase
      .from('otb_actuals')
      .select('cycle_id')
      .in('cycle_id', cycleIds);
    for (const row of actualsCheck || []) {
      cyclesWithActuals.add(row.cycle_id);
    }
  }

  // 2. Fetch plan rows. Dimension fields (sub_brand .. channel) are needed
  // to match actuals rows against plan_data for variance aggregation below.
  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('id, cycle_id, sub_brand, wear_type, sub_category, gender, channel')
    .in('cycle_id', cycleIds);

  const rowIds = (planRows || []).map(r => r.id);
  const rowToCycle: Record<string, string> = {};
  const rowToSubCategory: Record<string, string> = {};
  const rowToDims: Record<string, { sub_brand: string; wear_type: string; sub_category: string; gender: string; channel: string }> = {};
  for (const r of planRows || []) {
    rowToCycle[r.id] = r.cycle_id;
    rowToSubCategory[r.id] = r.sub_category;
    rowToDims[r.id] = {
      sub_brand: r.sub_brand,
      wear_type: r.wear_type,
      sub_category: r.sub_category,
      gender: r.gender,
      channel: r.channel,
    };
  }

  // 3. Fetch plan data
  let planData: { row_id: string; month: string; sales_plan_gmv: number; nsv: number; nsq: number; inwards_qty: number; closing_stock_qty: number; fwd_30day_doh: number }[] = [];
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

  // 5. Aggregate per cycle. Keyed by cycle_id (not brand_id) so a brand with
  // multiple cycles in scope — e.g. a revision sitting in InReview alongside a
  // prior Approved plan — produces distinct rows rather than silently summing.
  interface CycleAgg {
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
    categoryData: Record<string, { gmv: number; nsv: number; nsq: number; inwards_qty: number; closing_stock_qty: number; dohSum: number; dohCount: number }>;
  }

  const cycleAgg: Record<string, CycleAgg> = {};
  const allMonths = new Set<string>();
  // Per-cycle dim-key → planned values lookup, used below for variance aggregation.
  const cyclePlanLookup: Record<string, Map<string, typeof planData[number]>> = {};
  // Per-cycle set of months for which a plan exists, used to surface
  // total_months_count alongside actuals_months_count.
  const cyclePlanMonths: Record<string, Set<string>> = {};

  for (const pd of planData) {
    const cycleId = rowToCycle[pd.row_id];
    if (!cycleId) continue;
    const brandInfo = cycleToBrand[cycleId];
    if (!brandInfo) continue;
    const subCategory = rowToSubCategory[pd.row_id] || 'Unknown';

    // Build per-cycle lookup for variance matching (cycles with actuals only).
    if (cyclesWithActuals.has(cycleId)) {
      const dims = rowToDims[pd.row_id];
      if (dims) {
        if (!cyclePlanLookup[cycleId]) cyclePlanLookup[cycleId] = new Map();
        cyclePlanLookup[cycleId].set(
          dimKey(dims.sub_brand, dims.wear_type, dims.sub_category, dims.gender, dims.channel, pd.month),
          pd,
        );
        if (!cyclePlanMonths[cycleId]) cyclePlanMonths[cycleId] = new Set();
        cyclePlanMonths[cycleId].add(pd.month);
      }
    }

    if (!cycleAgg[cycleId]) {
      cycleAgg[cycleId] = {
        ...brandInfo,
        totalGmv: 0, totalNsv: 0, totalNsq: 0,
        totalInwardsQty: 0, totalClosingStockQty: 0,
        dohSum: 0, dohCount: 0,
        monthData: {},
        categoryData: {},
      };
    }

    const agg = cycleAgg[cycleId];
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
      agg.categoryData[subCategory] = { gmv: 0, nsv: 0, nsq: 0, inwards_qty: 0, closing_stock_qty: 0, dohSum: 0, dohCount: 0 };
    }
    agg.categoryData[subCategory].gmv += pd.sales_plan_gmv || 0;
    agg.categoryData[subCategory].nsv += pd.nsv || 0;
    agg.categoryData[subCategory].nsq += pd.nsq || 0;
    agg.categoryData[subCategory].inwards_qty += pd.inwards_qty || 0;
    agg.categoryData[subCategory].closing_stock_qty += pd.closing_stock_qty || 0;
    if (pd.fwd_30day_doh != null) { agg.categoryData[subCategory].dohSum += pd.fwd_30day_doh; agg.categoryData[subCategory].dohCount++; }
  }

  // 6. Build enhanced cycle summaries (one entry per cycle)
  const brands: EnhancedBrandSummary[] = Object.values(cycleAgg).map(agg => {
    // Monthly breakdown — use this cycle's own months only, not the global set
    const monthly: BrandMonthBreakdown[] = Object.keys(agg.monthData).sort().map(month => {
      const m = agg.monthData[month];
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
        nsv: data.nsv,
        nsq: data.nsq,
        inwards_qty: data.inwards_qty,
        closing_stock_qty: data.closing_stock_qty,
        avg_doh: data.dohCount > 0 ? data.dohSum / data.dohCount : 0,
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
      has_actuals: cyclesWithActuals.has(agg.cycle_id),
      is_current_quarter: currentQuarterStart === null || cycleStartById.get(agg.cycle_id) === currentQuarterStart,
    };
  });

  // 6b. Compute variance summaries server-side for has_actuals brands.
  // This pre-aggregation lets the dashboard render the "Actuals vs Plan"
  // row without per-panel /api/cycles/<id>/variance round-trips.
  const cyclesWithActualsArr = Array.from(cyclesWithActuals);
  const varianceByCycle: Record<string, BrandVarianceSummary> = {};

  if (cyclesWithActualsArr.length > 0) {
    // Fetch actuals + per-brand thresholds in parallel.
    const brandIdsForThresholds = brands
      .filter(b => cyclesWithActuals.has(b.cycle_id))
      .map(b => b.brand_id);

    const [{ data: actualsRows }, { data: thresholdRows }] = await Promise.all([
      supabase
        .from('otb_actuals')
        .select('cycle_id, sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_gmv, actual_nsv, actual_inwards_qty, actual_closing_stock_qty, actual_doh')
        .in('cycle_id', cyclesWithActualsArr),
      brandIdsForThresholds.length > 0
        ? supabase
            .from('brand_variance_thresholds')
            .select('brand_id, metric, threshold_pct')
            .in('brand_id', brandIdsForThresholds)
        : Promise.resolve({ data: [] as { brand_id: string; metric: string; threshold_pct: number }[] }),
    ]);

    // Per-brand threshold lookup (fall back to defaults).
    const thresholdsByBrand: Record<string, VarianceThresholds> = {};
    for (const t of thresholdRows || []) {
      if (!thresholdsByBrand[t.brand_id]) {
        thresholdsByBrand[t.brand_id] = { ...DEFAULT_VARIANCE_THRESHOLDS };
      }
      const key = t.metric as keyof VarianceThresholds;
      if (key in thresholdsByBrand[t.brand_id]) {
        thresholdsByBrand[t.brand_id][key] = t.threshold_pct;
      }
    }

    // Aggregate per cycle.
    interface CycleAgg {
      gmv: MetricAccumulator; nsv: MetricAccumulator; nsq: MetricAccumulator;
      inwards: MetricAccumulator; closing_stock: MetricAccumulator; doh: MetricAccumulator;
      actualsMonths: Set<string>;
    }
    const newAcc = (): MetricAccumulator => ({ planned: 0, actual: 0, hasData: false });
    const newCycleAgg = (): CycleAgg => ({
      gmv: newAcc(), nsv: newAcc(), nsq: newAcc(),
      inwards: newAcc(), closing_stock: newAcc(), doh: newAcc(),
      actualsMonths: new Set(),
    });
    const aggByCycle: Record<string, CycleAgg> = {};

    for (const a of actualsRows || []) {
      const cycleId = a.cycle_id as string;
      const lookup = cyclePlanLookup[cycleId];
      if (!lookup) continue;
      const planned = lookup.get(dimKey(
        a.sub_brand as string, a.wear_type as string, a.sub_category as string,
        a.gender as string, a.channel as string, a.month as string,
      ));
      if (!planned) continue;
      if (!aggByCycle[cycleId]) aggByCycle[cycleId] = newCycleAgg();
      const agg = aggByCycle[cycleId];
      agg.actualsMonths.add(a.month as string);
      aggregatePair(planned.sales_plan_gmv, a.actual_gmv as number | null, agg.gmv);
      aggregatePair(planned.nsv, a.actual_nsv as number | null, agg.nsv);
      aggregatePair(planned.nsq, a.actual_nsq as number | null, agg.nsq);
      aggregatePair(planned.inwards_qty, a.actual_inwards_qty as number | null, agg.inwards);
      aggregatePair(planned.closing_stock_qty, a.actual_closing_stock_qty as number | null, agg.closing_stock);
      aggregatePair(planned.fwd_30day_doh, a.actual_doh as number | null, agg.doh);
    }

    for (const brand of brands) {
      if (!cyclesWithActuals.has(brand.cycle_id)) continue;
      const agg = aggByCycle[brand.cycle_id];
      const thresholds = thresholdsByBrand[brand.brand_id] ?? DEFAULT_VARIANCE_THRESHOLDS;
      const planMonths = cyclePlanMonths[brand.cycle_id]?.size ?? 0;
      if (!agg) {
        // Brand has actuals rows but none matched plan data — surface a zero-state
        // summary so the dashboard still renders the row consistently.
        varianceByCycle[brand.cycle_id] = {
          gmv: { pct: null, level: 'green' },
          nsv: { pct: null, level: 'green' },
          nsq: { pct: null, level: 'green' },
          inwards: { pct: null, level: 'green' },
          closing_stock: { pct: null, level: 'green' },
          doh: { pct: null, level: 'green' },
          actuals_months_count: 0,
          total_months_count: planMonths,
        };
        continue;
      }
      varianceByCycle[brand.cycle_id] = {
        gmv: finalizeMetric(agg.gmv, 'gmv_pct', thresholds.gmv_pct),
        nsv: finalizeMetric(agg.nsv, 'nsv_pct', thresholds.nsv_pct),
        nsq: finalizeMetric(agg.nsq, 'nsq_pct', thresholds.nsq_pct),
        inwards: finalizeMetric(agg.inwards, 'inwards_pct', thresholds.inwards_pct),
        closing_stock: finalizeMetric(agg.closing_stock, 'closing_stock_pct', thresholds.closing_stock_pct),
        doh: finalizeMetric(agg.doh, 'doh_pct', thresholds.doh_pct),
        actuals_months_count: agg.actualsMonths.size,
        total_months_count: planMonths,
      };
    }

    // Attach variance_summary to brand entries.
    for (const brand of brands) {
      if (varianceByCycle[brand.cycle_id]) {
        brand.variance_summary = varianceByCycle[brand.cycle_id];
      }
    }
  }

  // 7. KPI totals — current-quarter Approved only.
  // Previous-quarter cycles are included in the brands list for the Actuals vs Plan
  // zone but must not inflate the KPI numbers shown in the header.
  const approvedBrands = brands.filter(b =>
    b.status === 'Approved' &&
    (currentQuarterStart === null || cycleStartById.get(b.cycle_id) === currentQuarterStart)
  );
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
