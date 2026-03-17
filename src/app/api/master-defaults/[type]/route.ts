import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import type { DefaultType } from '@/types/otb';

const TABLE_MAP: Record<DefaultType, string> = {
  asp: 'master_default_asp',
  cogs: 'master_default_cogs',
  return_pct: 'master_default_return_pct',
  tax_pct: 'master_default_tax_pct',
  sellex_pct: 'master_default_sellex_pct',
  standard_doh: 'master_default_doh',
};

// Value column name per type
const VALUE_COL: Record<DefaultType, string> = {
  asp: 'asp',
  cogs: 'cogs',
  return_pct: 'return_pct',
  tax_pct: 'tax_pct',
  sellex_pct: 'sellex_pct',
  standard_doh: 'doh',
};

type Params = { params: Promise<{ type: string }> };

// GET: List master defaults for a brand
export const GET = withAuth(null, async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  if (!TABLE_MAP[type as DefaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const brandId = req.nextUrl.searchParams.get('brandId');
  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from(TABLE_MAP[type as DefaultType])
    .select('*')
    .eq('brand_id', brandId)
    .order('sub_category');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// POST: Create or upsert master defaults (bulk)
// Body: { brandId: string, rows: Array<{ sub_brand?, sub_category, channel?, value }> }
export const POST = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  const defaultType = type as DefaultType;
  if (!TABLE_MAP[defaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { brandId, rows } = await req.json();

  if (!brandId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'brandId and rows[] are required' }, { status: 400 });
  }

  const valueCol = VALUE_COL[defaultType];
  const inserts = rows.map((r: any) => ({
    brand_id: brandId,
    ...(r.sub_brand !== undefined ? { sub_brand: r.sub_brand } : {}),
    sub_category: r.sub_category,
    ...(r.channel !== undefined ? { channel: r.channel } : {}),
    [valueCol]: r.value,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from(TABLE_MAP[defaultType])
    .upsert(inserts, {
      onConflict: getConflictColumns(defaultType),
    })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});

// PUT: Update a single master default row
export const PUT = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  const defaultType = type as DefaultType;
  if (!TABLE_MAP[defaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { id, value } = await req.json();

  if (!id || value === undefined) {
    return NextResponse.json({ error: 'id and value are required' }, { status: 400 });
  }

  const valueCol = VALUE_COL[defaultType];
  const { data, error } = await supabase
    .from(TABLE_MAP[defaultType])
    .update({ [valueCol]: value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

// DELETE: Remove a master default row
export const DELETE = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  const defaultType = type as DefaultType;
  if (!TABLE_MAP[defaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { id } = await req.json();

  const { error } = await supabase
    .from(TABLE_MAP[defaultType])
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});

function getConflictColumns(type: DefaultType): string {
  switch (type) {
    case 'asp':
    case 'return_pct':
    case 'sellex_pct':
      return 'brand_id,sub_brand,sub_category,channel';
    case 'cogs':
    case 'standard_doh':
      return 'brand_id,sub_brand,sub_category';
    case 'tax_pct':
      return 'brand_id,sub_category';
  }
}
