import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId/upload-status
export const GET = withAuth('view_cycle', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('file_uploads')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('uploaded_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});
