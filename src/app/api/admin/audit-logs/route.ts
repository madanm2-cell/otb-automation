import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createAdminClient } from '@/lib/supabase/server';

export const GET = withAuth('view_audit_logs', async (req, auth) => {
  const admin = createAdminClient();
  const url = req.nextUrl;

  let query = admin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  // Filters
  const entityType = url.searchParams.get('entityType');
  const action = url.searchParams.get('action');
  const userId = url.searchParams.get('userId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const page = parseInt(url.searchParams.get('page') ?? '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '50');

  if (entityType) query = query.eq('entity_type', entityType);
  if (action) query = query.eq('action', action);
  if (userId) query = query.eq('user_id', userId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  // Pagination
  const start = (page - 1) * pageSize;
  query = query.range(start, start + pageSize - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count, page, pageSize });
});
