import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

type Params = { params: Promise<{ cycleId: string }> };

// POST /api/cycles/:cycleId/versions/revert — revert plan data to a previous version
export const POST = withAuth('edit_otb', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const { version_number } = await req.json();

  if (!version_number || typeof version_number !== 'number') {
    return NextResponse.json(
      { error: 'version_number is required and must be a number' },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();
  const admin = createAdminClient();

  // Verify cycle exists and is in editable state
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status, cycle_name')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  if (cycle.status === 'Approved') {
    return NextResponse.json(
      { error: 'Cannot revert an approved cycle' },
      { status: 400 }
    );
  }

  // Get the version snapshot
  const { data: version } = await supabase
    .from('version_history')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('version_number', version_number)
    .single();

  if (!version) {
    return NextResponse.json(
      { error: `Version ${version_number} not found` },
      { status: 404 }
    );
  }

  const snapshot = version.snapshot as any;
  if (!snapshot || !snapshot.rows) {
    return NextResponse.json(
      { error: 'Invalid version snapshot' },
      { status: 400 }
    );
  }

  // Delete existing plan data for this cycle, then re-insert from snapshot
  const { data: existingRows } = await admin
    .from('otb_plan_rows')
    .select('id')
    .eq('cycle_id', cycleId);

  const rowIds = (existingRows || []).map((r: { id: string }) => r.id);

  if (rowIds.length > 0) {
    await admin.from('otb_plan_data').delete().in('row_id', rowIds);
    await admin.from('otb_plan_rows').delete().eq('cycle_id', cycleId);
  }

  // Re-insert rows and their monthly data from snapshot
  for (const row of snapshot.rows) {
    const { data: newRow } = await admin
      .from('otb_plan_rows')
      .insert({
        cycle_id: cycleId,
        sub_brand: row.sub_brand,
        wear_type: row.wear_type,
        sub_category: row.sub_category,
        gender: row.gender,
        channel: row.channel,
      })
      .select('id')
      .single();

    if (newRow && row.months) {
      const monthEntries = Object.entries(row.months).map(
        ([month, data]: [string, any]) => ({
          row_id: newRow.id,
          month,
          ...data,
        })
      );

      if (monthEntries.length > 0) {
        await admin.from('otb_plan_data').insert(monthEntries);
      }
    }
  }

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
      reverted_to_version: version_number,
    },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ success: true, reverted_to: version_number });
});
