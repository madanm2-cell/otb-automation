import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createAdminClient } from '@/lib/supabase/server';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

type Params = { params: Promise<{ userId: string }> };

// PUT: Update user profile (role, assigned brands, active status)
export const PUT = withAuth('manage_users', async (req, auth, { params }: Params) => {
  const admin = createAdminClient();
  const { userId } = await params;
  const body = await req.json();

  const allowedFields = ['full_name', 'role', 'assigned_brands', 'is_active'];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    entityType: 'user',
    entityId: userId,
    action: 'UPDATE',
    userId: auth.user.id,
    userEmail: auth.user.email!,
    userRole: auth.profile.role,
    details: { changed_fields: Object.keys(updates).filter(k => k !== 'updated_at') },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json(data);
});

// DELETE: Soft-deactivate user (set is_active = false)
export const DELETE = withAuth('manage_users', async (req, auth, { params }: Params) => {
  const admin = createAdminClient();
  const { userId } = await params;

  // Prevent self-deactivation
  if (userId === auth.user.id) {
    return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });
  }

  const { error } = await admin
    .from('profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    entityType: 'user',
    entityId: userId,
    action: 'DELETE',
    userId: auth.user.id,
    userEmail: auth.user.email!,
    userRole: auth.profile.role,
    details: { deactivated: true },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ success: true });
});
