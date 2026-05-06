import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';
import {
  shouldCycleBeApproved,
  shouldCycleRevertToFilling,
  canUserApprove,
  roleToApproverRole,
} from '@/lib/approvalEngine';

type Params = { params: Promise<{ cycleId: string }> };

// POST /api/cycles/:cycleId/approve — approve or request revision
export const POST = withAuth('approve_otb', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const { action, comment } = await req.json();

  // Validate action
  if (!['approve', 'revision_requested'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid action. Must be "approve" or "revision_requested".' },
      { status: 400 }
    );
  }

  // Revision requires a comment
  if (action === 'revision_requested' && !comment?.trim()) {
    return NextResponse.json(
      { error: 'Comment required for revision request.' },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();

  // Get cycle — must be InReview
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  if (cycle.status !== 'InReview') {
    return NextResponse.json(
      { error: `Cycle must be InReview to approve. Current status: ${cycle.status}` },
      { status: 400 }
    );
  }

  // Map user role to approver role
  const approverRole = roleToApproverRole(auth.profile.role);
  if (!approverRole) {
    return NextResponse.json(
      { error: 'Your role cannot approve cycles.' },
      { status: 403 }
    );
  }

  // Get current approval records
  const { data: records, error: recordsError } = await supabase
    .from('approval_tracking')
    .select('*')
    .eq('cycle_id', cycleId);

  if (recordsError) {
    return NextResponse.json({ error: recordsError.message }, { status: 500 });
  }

  // Check user can still approve (hasn't already decided)
  if (!canUserApprove(auth.profile.role, records ?? [])) {
    return NextResponse.json(
      { error: 'You have already submitted your decision for this cycle.' },
      { status: 400 }
    );
  }

  // Use admin client for updates (RLS might restrict)
  const adminClient = createAdminClient();

  // Update the approval record for this role
  const status = action === 'approve' ? 'Approved' : 'RevisionRequested';
  const now = new Date().toISOString();

  const { error: updateError } = await adminClient
    .from('approval_tracking')
    .update({
      user_id: auth.user.id,
      status,
      comment: comment?.trim() || null,
      decided_at: now,
      updated_at: now,
    })
    .eq('cycle_id', cycleId)
    .eq('role', approverRole);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Mirror revision comment to comments table so it surfaces in CommentsPanel and grid
  if (action === 'revision_requested') {
    await adminClient
      .from('comments')
      .insert({
        cycle_id: cycleId,
        parent_id: null,
        comment_type: 'general',
        row_id: null,
        month: null,
        field: null,
        text: comment.trim(),
        author_id: auth.user.id,
        author_name: auth.profile.full_name,
        author_role: auth.profile.role,
      });
  }

  // Re-fetch all records to check aggregate state
  const { data: updatedRecords } = await adminClient
    .from('approval_tracking')
    .select('*')
    .eq('cycle_id', cycleId);

  let newCycleStatus = cycle.status;

  // Check if cycle should be fully approved (all 4 roles approved)
  if (shouldCycleBeApproved(updatedRecords ?? [])) {
    await adminClient
      .from('otb_cycles')
      .update({ status: 'Approved', updated_at: now })
      .eq('id', cycleId);
    newCycleStatus = 'Approved';
  }
  // Check if cycle should revert to Filling (any revision requested)
  else if (shouldCycleRevertToFilling(updatedRecords ?? [])) {
    // Only revert cycle — existing Approved rows are preserved intentionally
    await adminClient
      .from('otb_cycles')
      .update({ status: 'Filling', updated_at: now })
      .eq('id', cycleId);
    newCycleStatus = 'Filling';
  }

  // Audit log
  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: action === 'approve' ? 'APPROVE' : 'REJECT',
    userId: auth.user.id,
    userEmail: auth.user.email!,
    userRole: auth.profile.role,
    details: {
      cycle_name: cycle.cycle_name,
      approver_role: approverRole,
      comment: comment?.trim() || null,
      resulting_status: newCycleStatus,
    },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({
    status: newCycleStatus,
    approval_action: action,
    role: approverRole,
  });
});
