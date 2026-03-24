import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { buildOtbWorkbook } from '@/lib/exportEngine';
import { APPROVER_ROLES } from '@/lib/approvalEngine';
import type { ApprovalRecord } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId/export — download OTB plan as Excel
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

  return new NextResponse(buffer as Buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
