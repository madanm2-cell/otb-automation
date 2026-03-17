import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';
import type { DefaultType } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string }> };

// GET: Get all cycle defaults (grouped by default_type)
export const GET = withAuth(null, async (req: NextRequest, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, brand_id, status, defaults_confirmed')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  const { data: defaults, error } = await supabase
    .from('cycle_defaults')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('default_type')
    .order('sub_brand')
    .order('sub_category')
    .order('channel');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    defaults_confirmed: cycle.defaults_confirmed,
    defaults: defaults || [],
  });
});

// POST: Initialize cycle defaults from master defaults for the cycle's brand.
// Called when planning team navigates to the "Review Defaults" step.
// Idempotent: if defaults already exist, returns them without re-initializing.
export const POST = withAuth('create_cycle', async (req: NextRequest, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();
  const adminDb = createAdminClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, brand_id, status, defaults_confirmed')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  if (cycle.status !== 'Draft') {
    return NextResponse.json({ error: 'Can only initialize defaults for Draft cycles' }, { status: 400 });
  }

  // Check if defaults already exist
  const { count } = await supabase
    .from('cycle_defaults')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId);

  if (count && count > 0) {
    // Already initialized — return existing
    const { data: existing } = await supabase
      .from('cycle_defaults')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('default_type');

    return NextResponse.json({
      defaults_confirmed: cycle.defaults_confirmed,
      defaults: existing || [],
      initialized: false,
    });
  }

  // Copy from master defaults
  const brandId = cycle.brand_id;
  const inserts: any[] = [];

  // ASP
  const { data: aspDefaults } = await adminDb
    .from('master_default_asp')
    .select('sub_brand, sub_category, channel, asp')
    .eq('brand_id', brandId);
  for (const row of aspDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'asp',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: row.channel,
      value: row.asp,
    });
  }

  // COGS
  const { data: cogsDefaults } = await adminDb
    .from('master_default_cogs')
    .select('sub_brand, sub_category, cogs')
    .eq('brand_id', brandId);
  for (const row of cogsDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'cogs',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: null,
      value: row.cogs,
    });
  }

  // Return %
  const { data: returnDefaults } = await adminDb
    .from('master_default_return_pct')
    .select('sub_brand, sub_category, channel, return_pct')
    .eq('brand_id', brandId);
  for (const row of returnDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'return_pct',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: row.channel,
      value: row.return_pct,
    });
  }

  // Tax %
  const { data: taxDefaults } = await adminDb
    .from('master_default_tax_pct')
    .select('sub_category, tax_pct')
    .eq('brand_id', brandId);
  for (const row of taxDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'tax_pct',
      sub_brand: null,
      sub_category: row.sub_category,
      channel: null,
      value: row.tax_pct,
    });
  }

  // Sellex %
  const { data: sellexDefaults } = await adminDb
    .from('master_default_sellex_pct')
    .select('sub_brand, sub_category, channel, sellex_pct')
    .eq('brand_id', brandId);
  for (const row of sellexDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'sellex_pct',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: row.channel,
      value: row.sellex_pct,
    });
  }

  // Standard DoH
  const { data: dohDefaults } = await adminDb
    .from('master_default_doh')
    .select('sub_brand, sub_category, doh')
    .eq('brand_id', brandId);
  for (const row of dohDefaults || []) {
    inserts.push({
      cycle_id: cycleId,
      default_type: 'standard_doh',
      sub_brand: row.sub_brand,
      sub_category: row.sub_category,
      channel: null,
      value: row.doh,
    });
  }

  // Batch insert
  if (inserts.length > 0) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
      const batch = inserts.slice(i, i + BATCH_SIZE);
      const { error } = await adminDb.from('cycle_defaults').insert(batch);
      if (error) return NextResponse.json({ error: `Failed to insert defaults: ${error.message}` }, { status: 500 });
    }
  }

  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: 'CREATE',
    userId: auth.user.id,
    userEmail: auth.user.email,
    userRole: auth.profile.role,
    details: { action: 'initialize_defaults', count: inserts.length },
    ipAddress: getClientIp(req.headers),
  });

  // Return the newly inserted defaults
  const { data: allDefaults } = await adminDb
    .from('cycle_defaults')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('default_type');

  return NextResponse.json({
    defaults_confirmed: false,
    defaults: allDefaults || [],
    initialized: true,
  }, { status: 201 });
});

// PUT: Update cycle default values (bulk)
// Body: { updates: Array<{ id: string, value: number }> }
export const PUT = withAuth('create_cycle', async (req: NextRequest, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status, defaults_confirmed')
    .eq('id', cycleId)
    .single();

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }
  if (cycle.status !== 'Draft') {
    return NextResponse.json({ error: 'Can only edit defaults for Draft cycles' }, { status: 400 });
  }
  if (cycle.defaults_confirmed) {
    return NextResponse.json({ error: 'Defaults already confirmed. Un-confirm first to make changes.' }, { status: 400 });
  }

  const { updates } = await req.json();
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates[] is required' }, { status: 400 });
  }

  const adminDb = createAdminClient();

  for (const { id, value } of updates) {
    const { error } = await adminDb
      .from('cycle_defaults')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('cycle_id', cycleId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    entityType: 'cycle',
    entityId: cycleId,
    action: 'UPDATE',
    userId: auth.user.id,
    userEmail: auth.user.email,
    userRole: auth.profile.role,
    details: { action: 'update_defaults', count: updates.length },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ success: true, updated: updates.length });
});
