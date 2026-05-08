import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildVarianceMetric } from '@/lib/varianceEngine';
import {
  DEFAULT_VARIANCE_THRESHOLDS,
  type VarianceRow,
  type VarianceLevel,
  type VarianceThresholds,
  type BrandVarianceThreshold,
} from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// Fill colors for variance level cells
const LEVEL_FILLS: Record<VarianceLevel, string> = {
  red: 'FFFCE4EC',
  yellow: 'FFFFF8E1',
  green: 'FFE8F5E9',
};

// GET /api/cycles/:cycleId/variance/export
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
  const planningQuarter = (cycle.planning_quarter as string) ?? '';

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
    return NextResponse.json(
      { error: 'No actuals data found for this cycle.' },
      { status: 404 }
    );
  }

  // 4. Fetch plan rows for this cycle
  const { data: planRows, error: rowError } = await supabase
    .from('otb_plan_rows')
    .select('*')
    .eq('cycle_id', cycleId);

  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }

  // 5. Fetch plan data for all rows
  const rowIds = (planRows ?? []).map((r: Record<string, unknown>) => r.id as string);
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
    if (data) allPlanData.push(...(data as Record<string, unknown>[]));
  }

  // 6. Build indexes
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
      row.sub_brand as string,
      row.wear_type as string,
      row.sub_category as string,
      row.gender as string,
      row.channel as string,
      pd.month as string,
    );
    planDataMap.set(key, pd);
  }

  // 7. Build variance rows
  const varianceRows: VarianceRow[] = [];

  for (const actual of actuals as Record<string, unknown>[]) {
    const month = actual.month as string;

    const planned = planDataMap.get(dimKey(
      actual.sub_brand as string,
      actual.wear_type as string,
      actual.sub_category as string,
      actual.gender as string,
      actual.channel as string,
      month,
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
    });
  }

  const topVariances = [...varianceRows]
    .sort((a, b) => {
      const aMax = Math.max(...[a.nsq, a.gmv, a.nsv, a.inwards, a.closing_stock, a.doh].map(m => Math.abs(m.variance_pct ?? 0)));
      const bMax = Math.max(...[b.nsq, b.gmv, b.nsv, b.inwards, b.closing_stock, b.doh].map(m => Math.abs(m.variance_pct ?? 0)));
      return bMax - aMax;
    })
    .slice(0, 10);

  // --- Build Excel workbook ---
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OTB Automation';
  workbook.created = new Date();

  // Sheet 1: Summary
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Value', key: 'value', width: 40 },
  ];

  summarySheet.addRow({ field: 'Cycle Name', value: cycle.cycle_name });
  summarySheet.addRow({ field: 'Brand', value: brandName });
  summarySheet.addRow({ field: 'Planning Quarter', value: planningQuarter });
  summarySheet.addRow({ field: 'Generated At', value: new Date().toLocaleString('en-IN') });

  summarySheet.getRow(1).font = { bold: true };

  // Sheet 2: Variance Detail
  buildVarianceSheet(workbook, 'Variance Detail', varianceRows);

  // Sheet 3: Top 10 Variances
  buildVarianceSheet(workbook, 'Top 10 Variances', topVariances);

  const safeFileName = cycle.cycle_name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="variance_${safeFileName}.xlsx"`,
    },
  });
});

// --- Helper functions ---

function dimKey(
  subBrand: string,
  wearType: string,
  subCategory: string,
  gender: string,
  channel: string,
  month: string,
): string {
  return `${subBrand}|${wearType}|${subCategory}|${gender}|${channel}|${month}`.toLowerCase();
}

function buildVarianceSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: VarianceRow[],
): void {
  const sheet = workbook.addWorksheet(sheetName);

  // Columns: Sub Brand | Sub Category | Gender | Channel | Month |
  // NSQ Plan | NSQ Actual | NSQ Var% |
  // GMV Plan | GMV Actual | GMV Var% |
  // NSV Plan | NSV Actual | NSV Var% |
  // Inwards Plan | Inwards Actual | Inwards Var% |
  // Closing Stock Plan | Closing Stock Actual | Closing Stock Var% |
  // DOH Plan | DOH Actual | DOH Var%
  sheet.columns = [
    { header: 'Sub Brand', key: 'sub_brand', width: 15 },
    { header: 'Sub Category', key: 'sub_category', width: 15 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Channel', key: 'channel', width: 12 },
    { header: 'Month', key: 'month', width: 12 },
    { header: 'NSQ Plan', key: 'nsq_plan', width: 13 },
    { header: 'NSQ Actual', key: 'nsq_actual', width: 13 },
    { header: 'NSQ Var%', key: 'nsq_var', width: 11 },
    { header: 'GMV Plan', key: 'gmv_plan', width: 14 },
    { header: 'GMV Actual', key: 'gmv_actual', width: 14 },
    { header: 'GMV Var%', key: 'gmv_var', width: 11 },
    { header: 'NSV Plan', key: 'nsv_plan', width: 14 },
    { header: 'NSV Actual', key: 'nsv_actual', width: 14 },
    { header: 'NSV Var%', key: 'nsv_var', width: 11 },
    { header: 'Inwards Plan', key: 'inwards_plan', width: 15 },
    { header: 'Inwards Actual', key: 'inwards_actual', width: 15 },
    { header: 'Inwards Var%', key: 'inwards_var', width: 13 },
    { header: 'Closing Stock Plan', key: 'cs_plan', width: 19 },
    { header: 'Closing Stock Actual', key: 'cs_actual', width: 19 },
    { header: 'Closing Stock Var%', key: 'cs_var', width: 17 },
    { header: 'DOH Plan', key: 'doh_plan', width: 12 },
    { header: 'DOH Actual', key: 'doh_actual', width: 12 },
    { header: 'DOH Var%', key: 'doh_var', width: 11 },
  ];

  // Bold header row with blue background
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1976D2' },
  };

  // Var% column indices (1-based): 8, 11, 14, 17, 20, 23
  const varPctColIndices = [8, 11, 14, 17, 20, 23];
  const varLevels: Array<keyof VarianceRow> = ['nsq', 'gmv', 'nsv', 'inwards', 'closing_stock', 'doh'];

  for (const row of rows) {
    const dataRow = sheet.addRow({
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      gender: row.gender,
      channel: row.channel,
      month: formatMonth(row.month),
      nsq_plan: row.nsq.planned,
      nsq_actual: row.nsq.actual,
      nsq_var: row.nsq.variance_pct != null ? +row.nsq.variance_pct.toFixed(1) : null,
      gmv_plan: row.gmv.planned,
      gmv_actual: row.gmv.actual,
      gmv_var: row.gmv.variance_pct != null ? +row.gmv.variance_pct.toFixed(1) : null,
      nsv_plan: row.nsv.planned,
      nsv_actual: row.nsv.actual,
      nsv_var: row.nsv.variance_pct != null ? +row.nsv.variance_pct.toFixed(1) : null,
      inwards_plan: row.inwards.planned,
      inwards_actual: row.inwards.actual,
      inwards_var: row.inwards.variance_pct != null ? +row.inwards.variance_pct.toFixed(1) : null,
      cs_plan: row.closing_stock.planned,
      cs_actual: row.closing_stock.actual,
      cs_var: row.closing_stock.variance_pct != null ? +row.closing_stock.variance_pct.toFixed(1) : null,
      doh_plan: row.doh.planned,
      doh_actual: row.doh.actual,
      doh_var: row.doh.variance_pct != null ? +row.doh.variance_pct.toFixed(1) : null,
    });

    // Color-code the Var% cells using LEVEL_FILLS
    varPctColIndices.forEach((colIdx, i) => {
      const metricKey = varLevels[i];
      const metric = row[metricKey] as { level: VarianceLevel | null };
      const level = metric.level;
      if (level && LEVEL_FILLS[level]) {
        const cell = dataRow.getCell(colIdx);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: LEVEL_FILLS[level] },
        };
      }
    });
  }
}

function formatMonth(month: string): string {
  try {
    return new Date(month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  } catch {
    return month;
  }
}
