import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildOtbWorkbook } from '@/lib/exportEngine';
import { APPROVER_ROLES } from '@/lib/approvalEngine';
import { getQuarterDates } from '@/lib/quarterUtils';
import type { ApprovalRecord } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId/export — download OTB plan as Excel or CSV (?format=csv)
export const GET = withAuth('export_otb', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  // Get cycle with brand name
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*, brands(name)')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  // Derive months from the planning quarter so all months are always present
  const sortedMonths = getQuarterDates(cycle.planning_quarter).months;

  // Get plan rows
  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('sub_brand')
    .order('wear_type')
    .order('sub_category')
    .order('gender')
    .order('channel');

  const rowIds = (planRows || []).map(r => r.id);
  let planData: any[] = [];
  if (rowIds.length > 0) {
    // Batch to avoid URL-length issues with large row counts
    const BATCH = 200;
    for (let i = 0; i < rowIds.length; i += BATCH) {
      const batch = rowIds.slice(i, i + BATCH);
      const { data } = await supabase
        .from('otb_plan_data')
        .select('*')
        .in('row_id', batch);
      if (data) planData.push(...data);
    }
  }

  // Build PlanRow format with months map
  const rowDataMap: Record<string, Record<string, any>> = {};
  for (const pd of planData) {
    if (!rowDataMap[pd.row_id]) rowDataMap[pd.row_id] = {};
    rowDataMap[pd.row_id][pd.month] = pd;
  }
  const formattedRows = (planRows || []).map(row => ({
    ...row,
    months: rowDataMap[row.id] || {},
  }));

  // Get approval records with user names
  const { data: approvals } = await supabase
    .from('approval_tracking')
    .select('*')
    .eq('cycle_id', cycleId);

  const userIds = (approvals || []).filter(a => a.user_id).map(a => a.user_id);
  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const admin = createAdminClient();
    const { data: profiles } = await admin.from('profiles').select('id, full_name, email').in('id', userIds);
    profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name || p.email]));
  }

  const approvalRecords: ApprovalRecord[] = APPROVER_ROLES.map(role => {
    const record = (approvals || []).find((a: any) => a.role === role);
    return record
      ? { ...record, user_name: record.user_id ? profileMap[record.user_id] || null : null }
      : { role, status: 'Pending' as const, user_id: null, user_name: null, comment: null, decided_at: null, cycle_id: cycleId };
  });

  // Get comments
  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: true });

  // Check requested format
  const format = req.nextUrl.searchParams.get('format')?.toLowerCase();

  if (format === 'csv') {
    const CSV_FIELDS: Array<{ key: string; label: string }> = [
      // Reference
      { key: 'opening_stock_qty', label: 'Opening Stock Qty' },
      { key: 'asp', label: 'ASP' },
      { key: 'cogs', label: 'COGS' },
      { key: 'ly_sales_nsq', label: 'LY Net Sales Qty' },
      { key: 'recent_sales_nsq', label: 'Recent Sales NSQ' },
      { key: 'soft_forecast_nsq', label: 'Soft Forecast NSQ' },
      { key: 'return_pct', label: 'Return %' },
      { key: 'tax_pct', label: 'Tax %' },
      { key: 'standard_doh', label: 'Standard DoH' },
      // GD Inputs
      { key: 'nsq', label: 'Net Sales Qty' },
      { key: 'inwards_qty', label: 'Inwards Qty' },
      { key: 'inwards_qty_suggested', label: 'Suggested Inwards' },
      // Calculated
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

    const escapeCSV = (val: any): string => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers: string[] = ['Sub Brand', 'Sub Category', 'Wear Type', 'Gender', 'Channel'];
    for (const month of sortedMonths) {
      const d = new Date(month);
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      for (const f of CSV_FIELDS) headers.push(`${label} - ${f.label}`);
    }

    const csvLines: string[] = [headers.map(escapeCSV).join(',')];

    for (const row of formattedRows) {
      const cells: any[] = [
        row.sub_brand, row.sub_category, row.wear_type, row.gender, row.channel,
      ];
      for (const month of sortedMonths) {
        const md = row.months[month] as any;
        for (const f of CSV_FIELDS) cells.push(md ? (md[f.key] ?? null) : null);
      }
      csvLines.push(cells.map(escapeCSV).join(','));
    }

    const csvString = csvLines.join('\n');
    const brandName = ((cycle.brands as any)?.name || 'export').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `OTB_${brandName}_${cycle.planning_quarter}.csv`;

    return new NextResponse(csvString, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // Build workbook
  const workbook = await buildOtbWorkbook(
    {
      cycleName: cycle.cycle_name,
      brandName: (cycle.brands as any)?.name || 'Unknown',
      planningQuarter: cycle.planning_quarter,
      months: sortedMonths,
      rows: formattedRows,
    },
    approvalRecords,
    comments || [],
  );

  // Stream as xlsx
  const buffer = await workbook.xlsx.writeBuffer();
  const brandName = ((cycle.brands as any)?.name || 'export').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `OTB_${brandName}_${cycle.planning_quarter}.xlsx`;

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
