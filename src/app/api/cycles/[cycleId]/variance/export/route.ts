import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildVarianceMetric } from '@/lib/varianceEngine';
import { buildVariancePdf } from '@/lib/pdfExport';
import {
  DEFAULT_VARIANCE_THRESHOLDS,
  type VarianceRow,
  type VarianceReportData,
  type VarianceLevel,
} from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// Fill colors for status cells
const STATUS_FILLS: Record<VarianceLevel, string> = {
  red: 'FFFCE4EC',
  yellow: 'FFFFF8E1',
  green: 'FFE8F5E9',
};

// GET /api/cycles/:cycleId/variance/export?format=xlsx|pdf
export const GET = withAuth('view_variance', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'xlsx';

  if (format !== 'xlsx' && format !== 'pdf') {
    return NextResponse.json(
      { error: 'Invalid format. Use "xlsx" or "pdf".' },
      { status: 400 }
    );
  }

  // --- Fetch variance data (same logic as variance/route.ts) ---
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

  // Index plan data by dimension key + month
  type PlanDataEntry = Record<string, unknown>;
  const planDataMap = new Map<string, PlanDataEntry>();

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
  const allMonthSet = new Set<string>();
  const actualsMonthSet = new Set<string>();
  const channelSet = new Set<string>();
  const varianceRows: VarianceRow[] = [];

  for (const actual of actuals) {
    const monthStr = actual.month as string;
    actualsMonthSet.add(monthStr);
    channelSet.add(actual.channel as string);

    const key = makeDimensionKey(
      actual.sub_brand,
      actual.wear_type,
      actual.sub_category,
      actual.gender,
      actual.channel,
      monthStr,
    );

    const planned = planDataMap.get(key);

    const row: VarianceRow = {
      sub_brand: actual.sub_brand,
      wear_type: actual.wear_type,
      sub_category: actual.sub_category,
      gender: actual.gender,
      channel: actual.channel,
      month: monthStr,
      nsq: buildVarianceMetric('nsq_pct', actual.actual_nsq, (planned?.nsq as number | null) ?? null, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct),
      gmv: buildVarianceMetric('gmv_pct', actual.actual_gmv, (planned?.sales_plan_gmv as number | null) ?? null, DEFAULT_VARIANCE_THRESHOLDS.gmv_pct),
      nsv: buildVarianceMetric('nsv_pct', actual.actual_nsv, (planned?.nsv as number | null) ?? null, DEFAULT_VARIANCE_THRESHOLDS.nsv_pct),
      inwards: buildVarianceMetric('inwards_pct', actual.actual_inwards_qty, (planned?.inwards_qty as number | null) ?? null, DEFAULT_VARIANCE_THRESHOLDS.inwards_pct),
      closing_stock: buildVarianceMetric('closing_stock_pct', actual.actual_closing_stock_qty, (planned?.closing_stock_qty as number | null) ?? null, DEFAULT_VARIANCE_THRESHOLDS.closing_stock_pct),
      doh: buildVarianceMetric('doh_pct', actual.actual_doh, (planned?.fwd_30day_doh as number | null) ?? null, DEFAULT_VARIANCE_THRESHOLDS.doh_pct),
    };

    varianceRows.push(row);
  }

  // populate allMonthSet from plan data keys
  for (const pd of allPlanData) {
    allMonthSet.add(pd.month as string);
  }

  const topVariances = [...varianceRows]
    .sort((a, b) => {
      const aMax = Math.max(...[a.nsq, a.gmv, a.nsv, a.inwards, a.closing_stock, a.doh].map(m => Math.abs(m.variance_pct ?? 0)));
      const bMax = Math.max(...[b.nsq, b.gmv, b.nsv, b.inwards, b.closing_stock, b.doh].map(m => Math.abs(m.variance_pct ?? 0)));
      return bMax - aMax;
    })
    .slice(0, 10);

  const report: VarianceReportData = {
    cycle_id: cycleId,
    cycle_name: cycle.cycle_name,
    brand_name: brandName,
    brand_id: '',
    planning_quarter: planningQuarter,
    all_months: Array.from(allMonthSet).sort(),
    actuals_months: Array.from(actualsMonthSet).sort(),
    thresholds: DEFAULT_VARIANCE_THRESHOLDS,
    channels: Array.from(channelSet).sort(),
    rows: varianceRows,
  };

  // --- Export based on format ---
  const safeFileName = cycle.cycle_name.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (format === 'pdf') {
    const doc = buildVariancePdf(report);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="variance_${safeFileName}.pdf"`,
      },
    });
  }

  // Excel export
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OTB Automation';
  workbook.created = new Date();

  // --- Sheet 1: Summary ---
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Value', key: 'value', width: 40 },
  ];

  summarySheet.addRow({ field: 'Cycle Name', value: report.cycle_name });
  summarySheet.addRow({ field: 'Brand', value: report.brand_name });
  summarySheet.addRow({ field: 'Planning Quarter', value: report.planning_quarter });
  summarySheet.addRow({ field: 'Generated At', value: new Date().toLocaleString('en-IN') });
  // Derive counts from rows
  const exportRedCount = varianceRows.filter(r => [r.nsq, r.gmv, r.nsv, r.inwards, r.closing_stock, r.doh].some(m => m.level === 'red')).length;
  const exportGreenCount = varianceRows.filter(r => [r.nsq, r.gmv, r.nsv, r.inwards, r.closing_stock, r.doh].every(m => m.level !== 'red' && m.level !== 'yellow')).length;
  const exportYellowCount = varianceRows.length - exportRedCount - exportGreenCount;

  summarySheet.addRow({ field: 'Total Rows', value: varianceRows.length });
  summarySheet.addRow({});

  const redRow = summarySheet.addRow({ field: 'Red (Exceeds Threshold)', value: exportRedCount });
  const yellowRow = summarySheet.addRow({ field: 'Yellow (Near Threshold)', value: exportYellowCount });
  const greenRow = summarySheet.addRow({ field: 'Green (OK)', value: exportGreenCount });

  applyFillToRow(redRow, 'red');
  applyFillToRow(yellowRow, 'yellow');
  applyFillToRow(greenRow, 'green');

  // Bold header row
  summarySheet.getRow(1).font = { bold: true };

  // --- Sheet 2: Variance Detail ---
  buildVarianceSheet(workbook, 'Variance Detail', varianceRows);

  // --- Sheet 3: Top 10 Variances ---
  buildVarianceSheet(workbook, 'Top 10 Variances', topVariances);

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


function applyFillToRow(row: ExcelJS.Row, level: VarianceLevel): void {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: STATUS_FILLS[level] },
    };
  });
}

function buildVarianceSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: VarianceRow[],
): void {
  const sheet = workbook.addWorksheet(sheetName);

  const columns = [
    { header: 'Sub Brand', key: 'sub_brand', width: 15 },
    { header: 'Wear Type', key: 'wear_type', width: 15 },
    { header: 'Sub Category', key: 'sub_category', width: 15 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Channel', key: 'channel', width: 12 },
    { header: 'Month', key: 'month', width: 12 },
    { header: 'NSQ Planned', key: 'nsq_planned', width: 14 },
    { header: 'NSQ Actual', key: 'nsq_actual', width: 14 },
    { header: 'NSQ Var%', key: 'nsq_var', width: 12 },
    { header: 'NSQ Status', key: 'nsq_status', width: 12 },
    { header: 'GMV Planned', key: 'gmv_planned', width: 14 },
    { header: 'GMV Actual', key: 'gmv_actual', width: 14 },
    { header: 'GMV Var%', key: 'gmv_var', width: 12 },
    { header: 'GMV Status', key: 'gmv_status', width: 12 },
    { header: 'Inwards Planned', key: 'inwards_planned', width: 16 },
    { header: 'Inwards Actual', key: 'inwards_actual', width: 16 },
    { header: 'Inwards Var%', key: 'inwards_var', width: 12 },
    { header: 'Inwards Status', key: 'inwards_status', width: 14 },
    { header: 'Closing Stock Planned', key: 'cs_planned', width: 20 },
    { header: 'Closing Stock Actual', key: 'cs_actual', width: 20 },
    { header: 'Closing Stock Var%', key: 'cs_var', width: 16 },
    { header: 'Closing Stock Status', key: 'cs_status', width: 18 },
  ];

  sheet.columns = columns;

  // Bold header row with blue background
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1976D2' },
  };

  // Status column indices (1-based): 10, 14, 18, 22
  const statusColIndices = [10, 14, 18, 22];

  for (const row of rows) {
    const monthLabel = formatMonth(row.month);

    const dataRow = sheet.addRow({
      sub_brand: row.sub_brand,
      wear_type: row.wear_type,
      sub_category: row.sub_category,
      gender: row.gender,
      channel: row.channel,
      month: monthLabel,
      nsq_planned: row.nsq.planned,
      nsq_actual: row.nsq.actual,
      nsq_var: row.nsq.variance_pct != null ? +row.nsq.variance_pct.toFixed(1) : null,
      nsq_status: row.nsq.level,
      gmv_planned: row.gmv.planned,
      gmv_actual: row.gmv.actual,
      gmv_var: row.gmv.variance_pct != null ? +row.gmv.variance_pct.toFixed(1) : null,
      gmv_status: row.gmv.level,
      inwards_planned: row.inwards.planned,
      inwards_actual: row.inwards.actual,
      inwards_var: row.inwards.variance_pct != null ? +row.inwards.variance_pct.toFixed(1) : null,
      inwards_status: row.inwards.level,
      cs_planned: row.closing_stock.planned,
      cs_actual: row.closing_stock.actual,
      cs_var: row.closing_stock.variance_pct != null ? +row.closing_stock.variance_pct.toFixed(1) : null,
      cs_status: row.closing_stock.level,
    });

    // Color-code the status cells
    for (const colIdx of statusColIndices) {
      const cell = dataRow.getCell(colIdx);
      const level = cell.value as VarianceLevel;
      if (level && STATUS_FILLS[level]) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: STATUS_FILLS[level] },
        };
      }
    }
  }
}

function formatMonth(month: string): string {
  try {
    return new Date(month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  } catch {
    return month;
  }
}
