import { describe, it, expect } from 'vitest';
import { buildOtbWorkbook } from '@/lib/exportEngine';
import type { ExportCycleData } from '@/lib/exportEngine';
import type { ApprovalRecord, OtbComment, PlanMonthData } from '@/types/otb';

function makePlanMonth(overrides: Partial<PlanMonthData> = {}): PlanMonthData {
  return {
    id: 'pm-1', month: '2026-04-01',
    asp: 500, cogs: 200, opening_stock_qty: 100, ly_sales_nsq: 80,
    recent_sales_nsq: 90, soft_forecast_nsq: null,
    return_pct: 0.05, tax_pct: 0.18, sellex_pct: 0.1, standard_doh: 45,
    nsq: 100, inwards_qty: 50, inwards_qty_suggested: null,
    sales_plan_gmv: 50000, goly_pct: 0.25, nsv: 42000,
    inwards_val_cogs: 10000, opening_stock_val: 20000,
    closing_stock_qty: 50, fwd_30day_doh: 30, gm_pct: 0.4,
    gross_margin: 20000,
    ...overrides,
  };
}

const sampleCycleData: ExportCycleData = {
  cycleName: 'Q2 FY27',
  brandName: 'Bewakoof',
  planningQuarter: 'Q2-FY27',
  months: ['2026-04-01', '2026-05-01'],
  rows: [
    {
      id: 'row-1', cycle_id: 'c-1',
      sub_brand: 'Bewakoof', wear_type: 'Casual', sub_category: 'T-Shirts',
      gender: 'Men', channel: 'Online',
      months: {
        '2026-04-01': makePlanMonth(),
        '2026-05-01': makePlanMonth({ month: '2026-05-01', nsq: 120 }),
      },
    },
  ],
};

const sampleApprovals: ApprovalRecord[] = [
  { cycle_id: 'c-1', role: 'Planning', user_id: 'u-1', status: 'Approved', comment: null, decided_at: '2026-03-20T10:00:00Z', user_name: 'Alice' },
  { cycle_id: 'c-1', role: 'GD', user_id: 'u-2', status: 'Approved', comment: null, decided_at: '2026-03-20T11:00:00Z', user_name: 'Bob' },
  { cycle_id: 'c-1', role: 'Finance', user_id: null, status: 'Pending', comment: null, decided_at: null },
  { cycle_id: 'c-1', role: 'CXO', user_id: null, status: 'Pending', comment: null, decided_at: null },
];

const sampleComments: OtbComment[] = [
  {
    id: 'cmt-1', cycle_id: 'c-1', parent_id: null,
    comment_type: 'general', row_id: null, month: null, field: null,
    text: 'Looks good overall', author_id: 'u-1', author_name: 'Alice', author_role: 'Planning',
    created_at: '2026-03-20T09:00:00Z',
  },
];

describe('buildOtbWorkbook', () => {
  it('creates a workbook with 3 sheets', async () => {
    const wb = await buildOtbWorkbook(sampleCycleData, sampleApprovals, sampleComments);
    expect(wb.worksheets).toHaveLength(3);
    expect(wb.worksheets[0].name).toBe('OTB Plan');
    expect(wb.worksheets[1].name).toBe('Approval Status');
    expect(wb.worksheets[2].name).toBe('Comments');
  });

  it('OTB Plan sheet has header and data rows', async () => {
    const wb = await buildOtbWorkbook(sampleCycleData, sampleApprovals, sampleComments);
    const sheet = wb.getWorksheet('OTB Plan')!;
    // Row 1: cycle info, Row 2: blank, Row 3: headers, Row 4+: data
    expect(sheet.rowCount).toBeGreaterThanOrEqual(4);
    const headerRow = sheet.getRow(3);
    expect(headerRow.getCell(1).value).toBe('Sub Brand');
    // Data row
    const dataRow = sheet.getRow(4);
    expect(dataRow.getCell(1).value).toBe('Bewakoof');
  });

  it('Approval Status sheet has 4 role rows', async () => {
    const wb = await buildOtbWorkbook(sampleCycleData, sampleApprovals, sampleComments);
    const sheet = wb.getWorksheet('Approval Status')!;
    // Row 1: header, Rows 2-5: 4 approval records
    expect(sheet.rowCount).toBe(5);
    expect(sheet.getRow(2).getCell(1).value).toBe('Planning');
    expect(sheet.getRow(2).getCell(2).value).toBe('Approved');
  });

  it('Comments sheet has comment rows', async () => {
    const wb = await buildOtbWorkbook(sampleCycleData, sampleApprovals, sampleComments);
    const sheet = wb.getWorksheet('Comments')!;
    // Row 1: header, Row 2: comment
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getRow(2).getCell(1).value).toBe('Alice');
    expect(sheet.getRow(2).getCell(4).value).toBe('Looks good overall');
  });

  it('handles empty data gracefully', async () => {
    const wb = await buildOtbWorkbook(
      { cycleName: 'Empty', brandName: 'Test', planningQuarter: 'Q1', months: [], rows: [] },
      [],
      [],
    );
    expect(wb.worksheets).toHaveLength(3);
    const planSheet = wb.getWorksheet('OTB Plan')!;
    // 3 rows: info, blank, headers — no data rows
    expect(planSheet.rowCount).toBe(3);
  });
});
