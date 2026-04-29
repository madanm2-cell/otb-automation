import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getQuarterDates } from '@/lib/quarterUtils';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

// GET /api/cycles — list all cycles (RLS handles visibility per role)
export const GET = withAuth(null, async (req, auth) => {
  const supabase = await createServerClient();
  let query = supabase
    .from('otb_cycles')
    .select('*, brands(name)')
    .order('created_at', { ascending: false });

  if (auth.profile.role !== 'Admin' && auth.profile.assigned_brands?.length > 0) {
    query = query.in('brand_id', auth.profile.assigned_brands);
  }

  const brandId = req.nextUrl.searchParams.get('brandId');
  if (brandId) {
    query = query.eq('brand_id', brandId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST /api/cycles — create a new cycle
export const POST = withAuth('create_cycle', async (req, auth) => {
  const body = await req.json();
  const { cycle_name, brand_id, planning_quarter, fill_deadline, approval_deadline, assigned_gd_id } = body;

  if (!cycle_name || !brand_id || !planning_quarter || !assigned_gd_id) {
    return NextResponse.json(
      { error: 'cycle_name, brand_id, planning_quarter, and assigned_gd_id are required' },
      { status: 400 }
    );
  }

  let quarterDates;
  try {
    quarterDates = getQuarterDates(planning_quarter);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }

  const supabase = await createServerClient();

  // Validate brand exists
  const { data: brand } = await supabase.from('brands').select('id').eq('id', brand_id).single();
  if (!brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
  }

  // Validate that assigned_gd_id is an active GD assigned to this brand
  const adminClient = createAdminClient();
  const { data: gdProfile } = await adminClient
    .from('profiles')
    .select('id, role, is_active, assigned_brands')
    .eq('id', assigned_gd_id.trim())
    .single();

  if (!gdProfile || gdProfile.role !== 'GD' || !gdProfile.is_active) {
    return NextResponse.json({ error: 'Invalid GD user' }, { status: 400 });
  }
  if (!Array.isArray(gdProfile.assigned_brands) || !gdProfile.assigned_brands.includes(brand_id)) {
    return NextResponse.json({ error: 'Selected GD is not assigned to this brand' }, { status: 400 });
  }

  // Check no other non-Approved cycle exists for this brand
  const { data: existing } = await supabase
    .from('otb_cycles')
    .select('id, status')
    .eq('brand_id', brand_id)
    .neq('status', 'Approved')
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'An active cycle already exists for this brand. Complete or approve it first.' },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('otb_cycles')
    .insert({
      cycle_name,
      brand_id,
      planning_quarter,
      planning_period_start: quarterDates.start,
      planning_period_end: quarterDates.end,
      fill_deadline: fill_deadline || null,
      approval_deadline: approval_deadline || null,
      assigned_gd_id: assigned_gd_id.trim(),
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    entityType: 'cycle',
    entityId: data.id,
    action: 'CREATE',
    userId: auth.user.id,
    userEmail: auth.user.email!,
    userRole: auth.profile.role,
    details: { cycle_name, brand_id },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json(data, { status: 201 });
});
