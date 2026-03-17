import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';

const VALID_TYPES = ['brands', 'sub_brands', 'wear_types', 'sub_categories', 'channels', 'genders', 'master_mappings'];
const BRAND_SCOPED_TABLES = ['sub_brands', 'wear_types', 'sub_categories', 'channels', 'genders'];

export const GET = withAuth(null, async (
  req: NextRequest,
  auth,
  { params }: { params: Promise<{ type: string }> }
) => {
  const { type } = await params;

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
  }

  const supabase = await createServerClient();
  let query = supabase.from(type).select('*');

  // Order by name for tables that have it
  if (['brands', 'sub_brands', 'wear_types', 'sub_categories', 'channels', 'genders'].includes(type)) {
    query = query.order('name');
  }

  // Brand-scoped filtering
  if (BRAND_SCOPED_TABLES.includes(type)) {
    const brandId = req.nextUrl.searchParams.get('brandId');
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }
  }

  // For sub_categories, also support ?wearTypeId= filter
  if (type === 'sub_categories') {
    const wearTypeId = req.nextUrl.searchParams.get('wearTypeId');
    if (wearTypeId) {
      query = query.eq('wear_type_id', wearTypeId);
    }
  }

  // For master_mappings: include brand-specific + global fallback
  if (type === 'master_mappings') {
    const brandId = req.nextUrl.searchParams.get('brandId');
    if (brandId) {
      query = query.or(`brand_id.eq.${brandId},brand_id.is.null`);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
});

type Params = { params: Promise<{ type: string }> };

// POST: Create new master data record
export const POST = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  const supabase = await createServerClient();
  const body = await req.json();

  if (BRAND_SCOPED_TABLES.includes(type) && !body.brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase.from(type).insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

// PUT: Update existing master data record
export const PUT = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  const supabase = await createServerClient();
  const body = await req.json();
  const { id, ...updates } = body;

  const { data, error } = await supabase.from(type).update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// DELETE: Remove a master data record
export const DELETE = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  const supabase = await createServerClient();
  const { id } = await req.json();

  const { error } = await supabase.from(type).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});
