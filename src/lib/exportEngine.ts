import ExcelJS from 'exceljs';
import type { PlanRow, ApprovalRecord, OtbComment } from '@/types/otb';

export interface ExportCycleData {
  cycleName: string;
  brandName: string;
  planningQuarter: string;
  months: string[];
  rows: PlanRow[];
}

// Reference fields — light grey background, read-only source data
const REF_FIELDS: Array<{ key: keyof import('@/types/otb').PlanMonthData; label: string }> = [
  { key: 'opening_stock_qty', label: 'Opening Stock Qty' },
  { key: 'asp', label: 'ASP' },
  { key: 'cogs', label: 'COGS' },
  { key: 'ly_sales_nsq', label: 'LY Net Sales Qty' },
  { key: 'recent_sales_nsq', label: 'Recent Sales NSQ' },
  { key: 'soft_forecast_nsq', label: 'Soft Forecast NSQ' },
  { key: 'return_pct', label: 'Return %' },
  { key: 'tax_pct', label: 'Tax %' },
  { key: 'standard_doh', label: 'Standard DoH' },
];

// GD input fields — light blue background, planner-entered values
const INPUT_FIELDS: Array<{ key: keyof import('@/types/otb').PlanMonthData; label: string }> = [
  { key: 'nsq', label: 'Net Sales Qty' },
  { key: 'inwards_qty', label: 'Inwards Qty' },
  { key: 'inwards_qty_suggested', label: 'Suggested Inwards' },
];

// Calculated fields — light green background, formula-derived values
const CALC_FIELDS: Array<{ key: keyof import('@/types/otb').PlanMonthData; label: string }> = [
  { key: 'sales_plan_gmv', label: 'GMV' },
  { key: 'goly_pct', label: 'Growth vs LY %' },
  { key: 'nsv', label: 'NSV' },
  { key: 'inwards_val_cogs', label: 'Inwards Value (COGS)' },
  { key: 'opening_stock_val', label: 'Opening Stock Value' },
  { key: 'closing_stock_qty', label: 'Closing Stock Qty' },
  { key: 'fwd_30day_doh', label: 'Forward DoH' },
  { key: 'gm_pct', label: 'Gross Margin %' },
  { key: 'gross_margin', label: 'Gross Margin' },
];

const FILL_REF: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
const FILL_INPUT: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
const FILL_CALC: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9F0D9' } };
const FILL_HDR: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D4A6B' } };
const FILL_MONTH: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

function monthLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

/**
 * Build an Excel workbook with 3 sheets:
 * 1. OTB Plan — full grid data: hierarchy + all reference, input, and calculated fields per month
 * 2. Approval Status — 4 approval records
 * 3. Comments — all comments
 */
export async function buildOtbWorkbook(
  cycleData: ExportCycleData,
  approvalRecords: ApprovalRecord[],
  comments: OtbComment[],
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OTB Automation';
  workbook.created = new Date();

  // --- Sheet 1: OTB Plan ---
  const planSheet = workbook.addWorksheet('OTB Plan');

  // Metadata row
  const metaRow = planSheet.addRow([
    'Cycle:', cycleData.cycleName,
    'Brand:', cycleData.brandName,
    'Quarter:', cycleData.planningQuarter,
  ]);
  metaRow.font = { bold: true };
  planSheet.addRow([]);

  // Row 1: Month group headers (merged across all fields for that month)
  // Row 2: Section type (Reference / GD Inputs / Calculated)
  // Row 3: Field names
  const DIM_COLS = ['Sub Brand', 'Sub Category', 'Wear Type', 'Gender', 'Channel'];
  const FIELDS_PER_MONTH = REF_FIELDS.length + INPUT_FIELDS.length + CALC_FIELDS.length;

  // Build header rows
  const monthGroupRow: (string | null)[] = [...DIM_COLS.map(() => null)];
  const sectionRow: (string | null)[] = [...DIM_COLS.map(() => null)];
  const fieldRow: string[] = [...DIM_COLS];

  for (const month of cycleData.months) {
    const lbl = monthLabel(month);
    monthGroupRow.push(lbl, ...Array(FIELDS_PER_MONTH - 1).fill(null));
    sectionRow.push(
      ...Array(REF_FIELDS.length).fill('Reference'),
      ...Array(INPUT_FIELDS.length).fill('GD Inputs'),
      ...Array(CALC_FIELDS.length).fill('Calculated'),
    );
    for (const f of REF_FIELDS) fieldRow.push(f.label);
    for (const f of INPUT_FIELDS) fieldRow.push(f.label);
    for (const f of CALC_FIELDS) fieldRow.push(f.label);
  }

  const r1 = planSheet.addRow(monthGroupRow);
  const r2 = planSheet.addRow(sectionRow);
  const r3 = planSheet.addRow(fieldRow);

  // Style header rows
  r1.height = 22;
  r2.height = 18;
  r3.height = 32;

  // Style dim col headers in r3
  for (let i = 1; i <= DIM_COLS.length; i++) {
    const cell = r3.getCell(i);
    cell.fill = FILL_HDR;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    // Also blank r1/r2 for dim cols
    r1.getCell(i).fill = FILL_HDR;
    r2.getCell(i).fill = FILL_HDR;
  }

  // Style month/section/field cells
  let colOffset = DIM_COLS.length + 1;
  for (const month of cycleData.months) {
    const lbl = monthLabel(month);
    const monthStart = colOffset;

    // Month group header — merge across all fields for this month and style
    const monthEnd = colOffset + FIELDS_PER_MONTH - 1;
    const r1c = r1.getCell(monthStart);
    r1c.value = lbl;
    r1c.fill = FILL_MONTH;
    r1c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    r1c.alignment = { horizontal: 'center', vertical: 'middle' };
    planSheet.mergeCells(r1.number, monthStart, r1.number, monthEnd);

    // Null cells get month bg too
    for (let c = monthStart + 1; c <= monthEnd; c++) {
      r1.getCell(c).fill = FILL_MONTH;
    }

    // Section cells
    let c = colOffset;
    for (let i = 0; i < REF_FIELDS.length; i++, c++) {
      const cell = r2.getCell(c);
      cell.value = i === 0 ? 'Reference' : null;
      cell.fill = FILL_REF;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
    }
    if (REF_FIELDS.length > 1) {
      planSheet.mergeCells(r2.number, colOffset, r2.number, colOffset + REF_FIELDS.length - 1);
    }

    const inputStart = colOffset + REF_FIELDS.length;
    for (let i = 0; i < INPUT_FIELDS.length; i++, c++) {
      const cell = r2.getCell(c);
      cell.value = i === 0 ? 'GD Inputs' : null;
      cell.fill = FILL_INPUT;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
    }
    if (INPUT_FIELDS.length > 1) {
      planSheet.mergeCells(r2.number, inputStart, r2.number, inputStart + INPUT_FIELDS.length - 1);
    }

    const calcStart = inputStart + INPUT_FIELDS.length;
    for (let i = 0; i < CALC_FIELDS.length; i++, c++) {
      const cell = r2.getCell(c);
      cell.value = i === 0 ? 'Calculated' : null;
      cell.fill = FILL_CALC;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
    }
    if (CALC_FIELDS.length > 1) {
      planSheet.mergeCells(r2.number, calcStart, r2.number, calcStart + CALC_FIELDS.length - 1);
    }

    // Field name cells in r3
    let fc = colOffset;
    for (const f of REF_FIELDS) {
      const cell = r3.getCell(fc++);
      cell.value = f.label;
      cell.fill = FILL_REF;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    for (const f of INPUT_FIELDS) {
      const cell = r3.getCell(fc++);
      cell.value = f.label;
      cell.fill = FILL_INPUT;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    for (const f of CALC_FIELDS) {
      const cell = r3.getCell(fc++);
      cell.value = f.label;
      cell.fill = FILL_CALC;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }

    colOffset += FIELDS_PER_MONTH;
  }

  // Data rows
  for (const row of cycleData.rows) {
    const cells: (string | number | null)[] = [
      row.sub_brand, row.sub_category, row.wear_type, row.gender, row.channel,
    ];
    for (const month of cycleData.months) {
      const md = row.months[month];
      for (const f of REF_FIELDS) cells.push(md ? (md[f.key] as number | null) : null);
      for (const f of INPUT_FIELDS) cells.push(md ? (md[f.key] as number | null) : null);
      for (const f of CALC_FIELDS) cells.push(md ? (md[f.key] as number | null) : null);
    }
    const dataRow = planSheet.addRow(cells);

    // Apply section fills to data cells
    let dc = DIM_COLS.length + 1;
    for (let _m = 0; _m < cycleData.months.length; _m++) {
      for (let i = 0; i < REF_FIELDS.length; i++, dc++) dataRow.getCell(dc).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
      for (let i = 0; i < INPUT_FIELDS.length; i++, dc++) dataRow.getCell(dc).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7FF' } };
      for (let i = 0; i < CALC_FIELDS.length; i++, dc++) dataRow.getCell(dc).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6FFF0' } };
    }
  }

  // Freeze panes and column widths
  planSheet.views = [{ state: 'frozen', xSplit: DIM_COLS.length, ySplit: 4 }]; // freeze dim cols + 3 header rows (offset by 2 for meta rows)
  planSheet.columns.forEach((col, i) => {
    if (i < DIM_COLS.length) {
      col.width = 18;
    } else {
      col.width = 14;
    }
  });

  // --- Sheet 2: Approval Status ---
  const approvalSheet = workbook.addWorksheet('Approval Status');
  const appHdr = approvalSheet.addRow(['Role', 'Status', 'Approver', 'Comment', 'Decision Date']);
  appHdr.font = { bold: true };
  appHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
  appHdr.alignment = { horizontal: 'center' };

  for (const record of approvalRecords) {
    approvalSheet.addRow([
      record.role,
      record.status,
      record.user_name || '—',
      record.comment || '',
      record.decided_at ? new Date(record.decided_at).toLocaleString('en-IN') : '—',
    ]);
  }
  approvalSheet.columns.forEach(col => { col.width = 22; });
  approvalSheet.getColumn(4).width = 40;

  // --- Sheet 3: Comments ---
  const commentsSheet = workbook.addWorksheet('Comments');
  const cmtHdr = commentsSheet.addRow(['Author', 'Role', 'Type', 'Comment', 'Date']);
  cmtHdr.font = { bold: true };
  cmtHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  cmtHdr.alignment = { horizontal: 'center' };

  for (const comment of comments) {
    commentsSheet.addRow([
      comment.author_name,
      comment.author_role,
      comment.comment_type,
      comment.text,
      new Date(comment.created_at).toLocaleString('en-IN'),
    ]);
  }
  commentsSheet.columns.forEach(col => { col.width = 22; });
  commentsSheet.getColumn(4).width = 50;

  return workbook;
}
