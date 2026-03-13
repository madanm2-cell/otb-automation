import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId — cycle detail
export const GET = withAuth(null, async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('otb_cycles')
    .select('*, brands(name)')
    .eq('id', cycleId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  return NextResponse.json(data);
});

// PUT /api/cycles/:cycleId — update cycle (Draft only)
export const PUT = withAuth('create_cycle', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const body = await req.json();
  const supabase = await createServerClient();

  // Only allow updates to Draft cycles
  const { data: existing } = await supabase
    .from('otb_cycles')
    .select('status')
    .eq('id', cycleId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  if (existing.status !== 'Draft') {
    return NextResponse.json(
      { error: `Cannot update cycle in ${existing.status} status` },
      { status: 400 }
    );
  }

  const allowedFields = ['cycle_name', 'wear_types', 'fill_deadline', 'approval_deadline'];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from('otb_cycles')
    .update(updates)
    .eq('id', cycleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});
