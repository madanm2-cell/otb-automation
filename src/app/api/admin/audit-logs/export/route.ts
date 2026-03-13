import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createAdminClient } from '@/lib/supabase/server';

export const GET = withAuth('view_audit_logs', async (req, auth) => {
  const admin = createAdminClient();
  const url = req.nextUrl;

  let query = admin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000);

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build CSV
  const headers = ['timestamp', 'action', 'entity_type', 'entity_id', 'user_email', 'user_role', 'details', 'ip_address'];
  const csvRows = [headers.join(',')];
  for (const row of data ?? []) {
    csvRows.push([
      row.created_at,
      row.action,
      row.entity_type,
      row.entity_id ?? '',
      row.user_email ?? '',
      row.user_role ?? '',
      JSON.stringify(row.details ?? {}),
      row.ip_address ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  }

  return new NextResponse(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
