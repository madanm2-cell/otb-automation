import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';
import { APPROVER_ROLES } from '@/lib/approvalEngine';

type Params = { params: Promise<{ cycleId: string }> };

// POST /api/cycles/:cycleId/submit — transition Filling → InReview
export const POST = withAuth('submit_otb', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  // Get cycle
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  if (cycle.status !== 'Filling') {
    return NextResponse.json(
      { error: `Cannot submit cycle in ${cycle.status} status. Must be in Filling status.` },
      { status: 400 }
    );
  }

  // Pre-submit validation: check that plan data exists and has GD inputs
  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('id')
    .eq('cycle_id', cycleId);

  if (!planRows || planRows.length === 0) {
    return NextResponse.json(
      { error: 'No plan rows found. Generate template first.' },
      { status: 400 }
    );
  }

  // Check at least some NSQ values are filled (not all zero)
  const { data: planData } = await supabase
    .from('otb_plan_data')
    .select('nsq')
    .eq('cycle_id', cycleId)
    .gt('nsq', 0)
    .limit(1);

  if (!planData || planData.length === 0) {
    return NextResponse.json(
      { error: 'No NSQ values have been entered. Please fill in GD inputs before submitting.' },
      { status: 400 }
    );
  }

  // Transition: Filling → InReview
  const { data, error } = await supabase
    .from('otb_cycles')
    .update({
      status: 'InReview',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Initialize approval tracking rows (use admin client — RLS blocks direct inserts)
  const adminClient = createAdminClient();
  const approvalRows = APPROVER_ROLES.map(role => ({
    cycle_id: cycleId,
    role,
    status: 'Pending',
    user_id: null,
    comment: null,
    decided_at: null,
  }));

  await adminClient
    .from('approval_tracking')
    .upsert(approvalRows, { onConflict: 'cycle_id,role' });

  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: 'SUBMIT',
    userId: auth.user.id,
    userEmail: auth.user.email!,
    userRole: auth.profile.role,
    details: { cycle_name: cycle.cycle_name },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json(data);
});
