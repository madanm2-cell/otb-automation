import ExcelJS from 'exceljs';
import type { PlanRow, ApprovalRecord, OtbComment } from '@/types/otb';

export interface ExportCycleData {
  cycleName: string;
  brandName: string;
  planningQuarter: string;
  months: string[];
  rows: PlanRow[];
}

const METRICS = ['NSQ', 'ASP', 'GMV', 'NSV', 'COGS', 'GM%', 'Inwards Qty', 'Suggested Inwards', 'DoH'] as const;

/**
 * Build an Excel workbook with 3 sheets:
 * 1. OTB Plan — grid data with hierarchy + monthly metrics
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

  planSheet.addRow(['Cycle:', cycleData.cycleName, 'Brand:', cycleData.brandName, 'Quarter:', cycleData.planningQuarter]);
  planSheet.addRow([]);

  // Build header row
  const headers: string[] = ['Sub Brand', 'Wear Type', 'Sub Category', 'Gender', 'Channel'];
  for (const month of cycleData.months) {
    const d = new Date(month);
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    for (const metric of METRICS) {
      headers.push(`${label} - ${metric}`);
    }
  }

  const hdr = planSheet.addRow(headers);
  hdr.font = { bold: true };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

  // Data rows
  for (const row of cycleData.rows) {
    const cells: (string | number | null)[] = [
      row.sub_brand, row.wear_type, row.sub_category, row.gender, row.channel,
    ];
    for (const month of cycleData.months) {
      const md = row.months[month];
      if (md) {
        cells.push(
          md.nsq, md.asp, md.sales_plan_gmv, md.nsv,
          md.cogs, md.gm_pct, md.inwards_qty, md.inwards_qty_suggested ?? null, md.fwd_30day_doh,
        );
      } else {
        cells.push(null, null, null, null, null, null, null, null, null);
      }
    }
    planSheet.addRow(cells);
  }

  // Column widths
  planSheet.columns.forEach(col => { col.width = 14; });
  for (let i = 0; i < 5 && i < planSheet.columns.length; i++) {
    planSheet.getColumn(i + 1).width = 18;
  }

  // --- Sheet 2: Approval Status ---
  const approvalSheet = workbook.addWorksheet('Approval Status');
  const appHdr = approvalSheet.addRow(['Role', 'Status', 'Approver', 'Comment', 'Decision Date']);
  appHdr.font = { bold: true };
  appHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };

  for (const record of approvalRecords) {
    approvalSheet.addRow([
      record.role,
      record.status,
      record.user_name || '\u2014',
      record.comment || '',
      record.decided_at ? new Date(record.decided_at).toLocaleString() : '\u2014',
    ]);
  }
  approvalSheet.columns.forEach(col => { col.width = 20; });

  // --- Sheet 3: Comments ---
  const commentsSheet = workbook.addWorksheet('Comments');
  const cmtHdr = commentsSheet.addRow(['Author', 'Role', 'Type', 'Comment', 'Date']);
  cmtHdr.font = { bold: true };
  cmtHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };

  for (const comment of comments) {
    commentsSheet.addRow([
      comment.author_name,
      comment.author_role,
      comment.comment_type,
      comment.text,
      new Date(comment.created_at).toLocaleString(),
    ]);
  }
  commentsSheet.columns.forEach(col => { col.width = 20; });
  commentsSheet.getColumn(4).width = 40;

  return workbook;
}
