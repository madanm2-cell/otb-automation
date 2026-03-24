import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

type Params = { params: Promise<{ cycleId: string }> };

export const POST = withAuth('request_reopen', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const { comment } = await req.json();

  // Reopen requires a comment
  if (!comment?.trim()) {
    return NextResponse.json(
      { error: 'Comment is required when reopening a cycle' },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();

  // Get cycle - must be Approved
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  if (cycle.status !== 'Approved') {
    return NextResponse.json(
      { error: `Cannot reopen cycle in ${cycle.status} status. Must be Approved.` },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Transition: Approved → InReview
  await adminClient
    .from('otb_cycles')
    .update({
      status: 'InReview',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId);

  // Reset all approval_tracking rows to Pending
  await adminClient
    .from('approval_tracking')
    .update({
      status: 'Pending',
      user_id: null,
      comment: null,
      decided_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('cycle_id', cycleId);

  // Audit log
  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: 'REVERT',
    userId: auth.user.id,
    userEmail: auth.user.email,
    userRole: auth.profile.role,
    details: {
      cycle_name: cycle.cycle_name,
      comment: comment.trim(),
      previous_status: 'Approved',
      new_status: 'InReview',
    },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({
    status: 'InReview',
    message: 'Cycle reopened for review',
  });
});
