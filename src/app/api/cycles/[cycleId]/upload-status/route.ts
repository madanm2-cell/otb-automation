import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId/upload-status
export const GET = withAuth('view_cycle', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  const [{ data, error }, { count: actualsCount }] = await Promise.all([
    supabase.from('file_uploads').select('*').eq('cycle_id', cycleId).order('uploaded_at', { ascending: false }),
    supabase.from('otb_actuals').select('*', { count: 'exact', head: true }).eq('cycle_id', cycleId),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const uploads = data ?? [];
  if ((actualsCount ?? 0) > 0 && !uploads.some(u => u.file_type === 'actuals')) {
    uploads.push({
      id: 'actuals-synthetic',
      cycle_id: cycleId,
      file_type: 'actuals',
      status: 'validated',
      row_count: actualsCount,
      uploaded_at: null,
      uploaded_by: null,
      file_name: null,
      error_message: null,
    });
  }

  return NextResponse.json(uploads);
});
