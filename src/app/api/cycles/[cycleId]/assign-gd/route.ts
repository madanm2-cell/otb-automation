import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

type Params = { params: Promise<{ cycleId: string }> };

// POST /api/cycles/:cycleId/assign-gd — assign GD to a cycle
export const POST = withAuth('assign_gd', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const body = await req.json();
  const { gd_id } = body;

  if (!gd_id || typeof gd_id !== 'string' || gd_id.trim().length === 0) {
    return NextResponse.json({ error: 'gd_id (UUID) is required' }, { status: 400 });
  }

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

  if (cycle.status !== 'Draft') {
    return NextResponse.json(
      { error: `Cannot assign GD when cycle is in ${cycle.status} status` },
      { status: 400 }
    );
  }

  // Update cycle with GD assignment (UUID)
  const { data, error } = await supabase
    .from('otb_cycles')
    .update({
      assigned_gd_id: gd_id.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: 'ASSIGN',
    userId: auth.user.id,
    userEmail: auth.user.email!,
    userRole: auth.profile.role,
    details: { gd_id: gd_id.trim() },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json(data);
});
