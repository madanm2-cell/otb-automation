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
  // otb_plan_data has no direct cycle_id — join via row_id
  const rowIds = planRows.map(r => r.id);
  const { data: planData } = await supabase
    .from('otb_plan_data')
    .select('nsq')
    .in('row_id', rowIds)
    .gt('nsq', 0)
    .limit(1);

  if (!planData || planData.length === 0) {
    return NextResponse.json(
      { error: 'No NSQ values have been entered. Please fill in GD inputs before submitting.' },
      { status: 400 }
    );
  }

  // Transition: Filling → InReview (use admin client — GD role lacks cycle UPDATE via RLS)
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('otb_cycles')
    .update({
      status: 'InReview',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Step 1: Create missing rows as Pending for first-time submit.
  // ignoreDuplicates: true leaves existing Approved rows untouched on resubmit.
  const { error: upsertError } = await adminClient
    .from('approval_tracking')
    .upsert(
      APPROVER_ROLES.map(role => ({
        cycle_id: cycleId,
        role,
        status: 'Pending',
        user_id: null,
        comment: null,
        decided_at: null,
      })),
      { onConflict: 'cycle_id,role', ignoreDuplicates: true }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Step 2: Reset any RevisionRequested rows back to Pending so the requester re-enters the queue.
  const submitNow = new Date().toISOString();
  const { error: resetError } = await adminClient
    .from('approval_tracking')
    .update({
      status: 'Pending',
      user_id: null,
      comment: null,
      decided_at: null,
      updated_at: submitNow,
    })
    .eq('cycle_id', cycleId)
    .eq('status', 'RevisionRequested');

  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 500 });
  }

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
