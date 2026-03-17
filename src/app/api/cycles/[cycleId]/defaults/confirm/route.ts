import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

type Params = { params: Promise<{ cycleId: string }> };

// POST: Confirm (lock) or un-confirm cycle defaults
// Body: { confirmed: boolean }
export const POST = withAuth('create_cycle', async (req: NextRequest, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();
  const { confirmed } = await req.json();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status, defaults_confirmed')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  if (cycle.status !== 'Draft') {
    return NextResponse.json({ error: 'Can only confirm defaults for Draft cycles' }, { status: 400 });
  }

  // Validate: must have at least some defaults before confirming
  if (confirmed) {
    const { count } = await supabase
      .from('cycle_defaults')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId);

    if (!count || count === 0) {
      return NextResponse.json({ error: 'No defaults to confirm. Initialize defaults first.' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('otb_cycles')
    .update({
      defaults_confirmed: confirmed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: 'UPDATE',
    userId: auth.user.id,
    userEmail: auth.user.email,
    userRole: auth.profile.role,
    details: { action: confirmed ? 'confirm_defaults' : 'unconfirm_defaults' },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json(data);
});
