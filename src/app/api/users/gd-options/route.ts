import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createAdminClient } from '@/lib/supabase/server';

export const GET = withAuth('create_cycle', async (req) => {
  const admin = createAdminClient();
  const brandId = req.nextUrl.searchParams.get('brandId');

  let query = admin
    .from('profiles')
    .select('id, full_name, email, role, assigned_brands, is_active')
    .eq('role', 'GD')
    .eq('is_active', true);

  if (brandId) {
    query = query.contains('assigned_brands', [brandId]);
  }

  const { data, error } = await query.order('full_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});
