import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';

type Params = { params: Promise<{ cycleId: string }> };

// GET /api/cycles/:cycleId/actuals/preview?limit=500
// Returns the actuals rows for a cycle so the workspace can show them inline.
// Actuals are upserted across multiple uploads keyed on
// (cycle_id, sub_brand, wear_type, sub_category, gender, channel, month),
// so there's no single source file to download — the table is the source of truth.
export const GET = withAuth('view_cycle', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '500'), 2000);
  const supabase = await createServerClient();

  const { data, error, count } = await supabase
    .from('otb_actuals')
    .select(
      'sub_brand, wear_type, sub_category, gender, channel, month, actual_nsq, actual_inwards_qty, actual_gmv, actual_nsv, actual_closing_stock_qty, actual_doh',
      { count: 'exact' },
    )
    .eq('cycle_id', cycleId)
    .order('month', { ascending: true })
    .order('sub_brand', { ascending: true })
    .order('sub_category', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
    limit,
    truncated: (count ?? 0) > (data?.length ?? 0),
  });
});
