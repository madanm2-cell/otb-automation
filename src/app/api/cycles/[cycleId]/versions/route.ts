import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId/versions — list version history
export async function GET(_req: NextRequest, { params }: Params) {
  const { cycleId } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('version_history')
    .select('id, version_number, change_summary, created_by, created_at')
    .eq('cycle_id', cycleId)
    .order('version_number', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
