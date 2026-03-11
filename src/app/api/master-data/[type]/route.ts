import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const VALID_TYPES = ['brands', 'sub_brands', 'sub_categories', 'channels', 'genders', 'master_mappings'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid type: ${type}` }, { status: 400 });
  }

  const supabase = createServerClient();
  let query = supabase.from(type).select('*');

  // Order by name for tables that have it
  if (['brands', 'sub_brands', 'sub_categories', 'channels', 'genders'].includes(type)) {
    query = query.order('name');
  }

  // For sub_brands, support ?brandId= filter
  if (type === 'sub_brands') {
    const brandId = req.nextUrl.searchParams.get('brandId');
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
