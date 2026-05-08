import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import {
  DEFAULT_VARIANCE_THRESHOLDS,
  type VarianceThresholds,
  type BrandVarianceThreshold,
} from '@/types/otb';

const VALID_METRICS = new Set([
  'gmv_pct', 'nsv_pct', 'nsq_pct',
  'inwards_pct', 'closing_stock_pct', 'doh_pct',
]);

// GET /api/admin/variance-thresholds?brandId=X
export const GET = withAuth('manage_master_data', async (req) => {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('brand_variance_thresholds')
    .select('*')
    .eq('brand_id', brandId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const thresholds: VarianceThresholds = { ...DEFAULT_VARIANCE_THRESHOLDS };
  for (const row of (data ?? []) as BrandVarianceThreshold[]) {
    if (VALID_METRICS.has(row.metric)) {
      (thresholds as unknown as Record<string, number>)[row.metric] = row.threshold_pct;
    }
  }

  return NextResponse.json(thresholds);
});

// PUT /api/admin/variance-thresholds
// Body: { brandId: string, metric: string, threshold_pct: number }
export const PUT = withAuth('manage_master_data', async (req, auth) => {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { brandId, metric, threshold_pct } = body;

  if (!brandId || typeof brandId !== 'string') {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 });
  }
  if (!metric || !VALID_METRICS.has(metric)) {
    return NextResponse.json({ error: `Unknown metric: ${metric}` }, { status: 400 });
  }
  if (typeof threshold_pct !== 'number' || threshold_pct <= 0 || threshold_pct > 100) {
    return NextResponse.json({ error: 'threshold_pct must be a number between 0 and 100' }, { status: 400 });
  }

  // Planning users can only edit their assigned brands
  if (auth.profile.role === 'Planning') {
    const assigned = (auth.profile.assigned_brands ?? []) as string[];
    if (!assigned.includes(brandId)) {
      return NextResponse.json({ error: 'Forbidden: brand not assigned to your account' }, { status: 403 });
    }
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from('brand_variance_thresholds')
    .upsert(
      {
        brand_id: brandId,
        metric,
        threshold_pct,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'brand_id,metric' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
