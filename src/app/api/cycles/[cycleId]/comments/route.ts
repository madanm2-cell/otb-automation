import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';
import type { CommentType } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

const VALID_COMMENT_TYPES: CommentType[] = ['general', 'metric'];

// GET /api/cycles/:cycleId/comments — fetch all comments for a cycle
export const GET = withAuth('view_cycle', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(comments ?? []);
});

// POST /api/cycles/:cycleId/comments — create a new comment
export const POST = withAuth('view_cycle', async (req: NextRequest, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  let body: {
    text?: string;
    comment_type?: string;
    parent_id?: string | null;
    row_id?: string | null;
    month?: string | null;
    field?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { text, comment_type, parent_id, row_id, month, field } = body;

  // Validate text
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
  }

  // Validate comment_type
  if (!comment_type || !VALID_COMMENT_TYPES.includes(comment_type as CommentType)) {
    return NextResponse.json(
      { error: `comment_type must be one of: ${VALID_COMMENT_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  // For metric comments, month and field are required; row_id is optional (brand-level metric)
  if (comment_type === 'metric') {
    if (!month || !field) {
      return NextResponse.json(
        { error: 'Metric comments require month and field' },
        { status: 400 }
      );
    }
  }

  // Verify cycle exists
  const { data: cycle, error: cycleError } = await supabase
    .from('otb_cycles')
    .select('id')
    .eq('id', cycleId)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  // If parent_id is provided, verify the parent comment exists and belongs to this cycle
  if (parent_id) {
    const { data: parentComment, error: parentError } = await supabase
      .from('comments')
      .select('id')
      .eq('id', parent_id)
      .eq('cycle_id', cycleId)
      .single();

    if (parentError || !parentComment) {
      return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
    }
  }

  const { data: comment, error: insertError } = await supabase
    .from('comments')
    .insert({
      cycle_id: cycleId,
      parent_id: parent_id ?? null,
      comment_type: comment_type as CommentType,
      row_id: row_id ?? null,
      month: month ?? null,
      field: field ?? null,
      text: text.trim(),
      author_id: auth.user.id,
      author_name: auth.profile.full_name,
      author_role: auth.profile.role,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Audit log (fire-and-forget)
  logAudit({
    entityType: 'comment',
    entityId: comment.id,
    action: 'CREATE',
    userId: auth.user.id,
    userEmail: auth.user.email,
    userRole: auth.profile.role,
    details: {
      cycle_id: cycleId,
      comment_type,
      parent_id: parent_id ?? null,
    },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json(comment, { status: 201 });
});
