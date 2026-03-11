import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ cycleId: string }> };

// POST /api/cycles/:cycleId/assign-gd — assign GD to a cycle
export async function POST(req: NextRequest, { params }: Params) {
  const { cycleId } = await params;
  const body = await req.json();
  const { gd_name } = body;

  if (!gd_name || typeof gd_name !== 'string' || gd_name.trim().length === 0) {
    return NextResponse.json({ error: 'GD name is required' }, { status: 400 });
  }

  const supabase = createServerClient();

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

  // Update cycle with GD assignment
  const { data, error } = await supabase
    .from('otb_cycles')
    .update({
      assigned_gd_id: gd_name.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
