import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import type { FileType } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string; fileType: string }> };

// Each reference file type maps to one or more columns in otb_plan_data.
// The preview returns those columns alongside the row's dimensions
// (joined from otb_plan_rows) so the user can see the actual values
// that were uploaded for the cycle.
const FILE_TYPE_COLUMNS: Record<string, string[]> = {
  opening_stock: ['opening_stock_qty'],
  ly_sales: ['ly_sales_nsq'],
  recent_sales: ['recent_sales_nsq'],
  asp: ['asp'],
  cogs: ['cogs'],
  return_pct: ['return_pct'],
  tax_pct: ['tax_pct'],
  sellex_pct: ['sellex_pct'],
  standard_doh: ['standard_doh'],
  soft_forecast: ['soft_forecast_nsq'],
};

export const GET = withAuth('view_cycle', async (req, auth, { params }: Params) => {
  const { cycleId, fileType } = await params;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '500'), 2000);
  const cols = FILE_TYPE_COLUMNS[fileType as FileType];
  if (!cols) {
    return NextResponse.json({ error: `No preview available for file type "${fileType}"` }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Fetch plan_data rows joined with plan_rows for the dimension columns.
  const selectCols = `month, ${cols.join(', ')}, otb_plan_rows!inner(cycle_id, sub_brand, wear_type, sub_category, gender, channel)`;
  const { data, error, count } = await supabase
    .from('otb_plan_data')
    .select(selectCols, { count: 'exact' })
    .eq('otb_plan_rows.cycle_id', cycleId)
    .order('month', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the join so the client sees a single object per row.
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const plan = r.otb_plan_rows as { sub_brand: string; wear_type: string; sub_category: string; gender: string; channel: string } | null;
    const out: Record<string, unknown> = {
      month: r.month,
      sub_brand: plan?.sub_brand ?? null,
      wear_type: plan?.wear_type ?? null,
      sub_category: plan?.sub_category ?? null,
      gender: plan?.gender ?? null,
      channel: plan?.channel ?? null,
    };
    for (const col of cols) out[col] = r[col];
    return out;
  });

  return NextResponse.json({
    rows,
    total: count ?? 0,
    columns: cols,
    truncated: (count ?? 0) > rows.length,
    limit,
  });
});
