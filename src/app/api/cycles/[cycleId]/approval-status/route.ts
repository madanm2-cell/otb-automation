import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { APPROVER_ROLES } from '@/lib/approvalEngine';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId/approval-status — fetch approval tracking records
export const GET = withAuth('view_cycle', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  // Verify cycle exists
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  // Fetch approval records
  const { data: records, error } = await supabase
    .from('approval_tracking')
    .select('*')
    .eq('cycle_id', cycleId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with user names from profiles
  const userIds = (records || [])
    .filter(r => r.user_id)
    .map(r => r.user_id);

  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    profileMap = (profiles || []).reduce((acc, p) => {
      acc[p.id] = p.full_name;
      return acc;
    }, {} as Record<string, string>);
  }

  // Sort by standard role order and add user_name
  const sortedRecords = APPROVER_ROLES.map(role => {
    const record = (records || []).find(r => r.role === role);
    return record
      ? { ...record, user_name: record.user_id ? profileMap[record.user_id] || null : null }
      : { role, status: 'Pending', user_id: null, user_name: null, comment: null, decided_at: null };
  });

  return NextResponse.json({
    cycle_id: cycleId,
    cycle_status: cycle.status,
    records: sortedRecords,
  });
});
