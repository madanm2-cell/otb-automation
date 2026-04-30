import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildOtbWorkbook } from '@/lib/exportEngine';
import { APPROVER_ROLES } from '@/lib/approvalEngine';
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

  // Get plan rows
  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('*')
    .eq('cycle_id', cycleId);

  const rowIds = (planRows || []).map(r => r.id);
  let planData: any[] = [];
  if (rowIds.length > 0) {
    const { data } = await supabase
      .from('otb_plan_data')
      .select('*')
      .in('row_id', rowIds);
    planData = data || [];
  }

  // Build PlanRow format with months map
  const months = new Set<string>();
  const rowDataMap: Record<string, Record<string, any>> = {};
  for (const pd of planData) {
    if (!rowDataMap[pd.row_id]) rowDataMap[pd.row_id] = {};
    rowDataMap[pd.row_id][pd.month] = pd;
    months.add(pd.month);
  }

  const sortedMonths = Array.from(months).sort();
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
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name]));
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
    // Build CSV from the same data
    const METRICS = ['NSQ', 'ASP', 'GMV', 'NSV', 'COGS', 'GM%', 'Inwards Qty', 'Suggested Inwards', 'DoH'] as const;

    const escapeCSV = (val: any): string => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Header row
    const headers: string[] = ['Sub Brand', 'Wear Type', 'Sub Category', 'Gender', 'Channel'];
    for (const month of sortedMonths) {
      const d = new Date(month);
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      for (const metric of METRICS) {
        headers.push(`${label} - ${metric}`);
      }
    }

    const csvLines: string[] = [headers.map(escapeCSV).join(',')];

    // Data rows
    for (const row of formattedRows) {
      const cells: any[] = [
        row.sub_brand, row.wear_type, row.sub_category, row.gender, row.channel,
      ];
      for (const month of sortedMonths) {
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

  if (format === 'pdf') {
    const { buildPlanPdf } = await import('@/lib/pdfExport');
    const doc = buildPlanPdf({
      cycleName: cycle.cycle_name,
      brandName: (cycle.brands as any)?.name || 'Unknown',
      planningQuarter: cycle.planning_quarter,
      months: sortedMonths,
      rows: formattedRows,
    });
    const pdfBuffer = doc.output('arraybuffer');
    const brandName = ((cycle.brands as any)?.name || 'export').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `OTB_${brandName}_${cycle.planning_quarter}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
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
