import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createAdminClient } from '@/lib/supabase/server';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

// GET: List all users with profiles
export const GET = withAuth('manage_users', async (req, auth) => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST: Create new user (via Supabase Auth admin API)
export const POST = withAuth('manage_users', async (req, auth) => {
  const admin = createAdminClient();
  const { email, password, full_name, role, assigned_brands } = await req.json();

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  // Update profile with assigned brands (trigger creates basic profile)
  if (assigned_brands?.length) {
    await admin
      .from('profiles')
      .update({ assigned_brands })
      .eq('id', authData.user.id);
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  await logAudit({
    entityType: 'user',
    entityId: authData.user.id,
    action: 'CREATE',
    userId: auth.user.id,
    userEmail: auth.user.email!,
    userRole: auth.profile.role,
    details: { email, role },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json(profile, { status: 201 });
});
