import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { REQUIRED_FILE_TYPES } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// POST /api/cycles/:cycleId/activate — transition Draft → Filling
export async function POST(_req: NextRequest, { params }: Params) {
  const { cycleId } = await params;
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
      { error: `Cannot activate cycle in ${cycle.status} status` },
      { status: 400 }
    );
  }

  // Check GD is assigned
  if (!cycle.assigned_gd_id) {
    return NextResponse.json(
      { error: 'GD must be assigned before activation' },
      { status: 400 }
    );
  }

  // Check wear types defined
  if (!cycle.wear_types || cycle.wear_types.length === 0) {
    return NextResponse.json(
      { error: 'At least one wear type must be defined' },
      { status: 400 }
    );
  }

  // Check all 9 required files are uploaded and validated
  const { data: uploads } = await supabase
    .from('file_uploads')
    .select('file_type, status')
    .eq('cycle_id', cycleId);

  const validatedTypes = new Set(
    (uploads || [])
      .filter(u => u.status === 'validated')
      .map(u => u.file_type)
  );

  const missingTypes = REQUIRED_FILE_TYPES.filter(ft => !validatedTypes.has(ft));
  if (missingTypes.length > 0) {
    return NextResponse.json(
      { error: `Missing validated uploads: ${missingTypes.join(', ')}` },
      { status: 400 }
    );
  }

  // Activate: Draft → Filling
  const { data, error } = await supabase
    .from('otb_cycles')
    .update({ status: 'Filling', updated_at: new Date().toISOString() })
    .eq('id', cycleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
