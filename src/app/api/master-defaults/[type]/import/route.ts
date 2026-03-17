import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { parseUploadedFile } from '@/lib/fileParser';
import { createServerClient } from '@/lib/supabase/server';
import type { DefaultType } from '@/types/otb';

const TABLE_MAP: Record<DefaultType, string> = {
  asp: 'master_default_asp',
  cogs: 'master_default_cogs',
  return_pct: 'master_default_return_pct',
  tax_pct: 'master_default_tax_pct',
  sellex_pct: 'master_default_sellex_pct',
  standard_doh: 'master_default_doh',
};

const VALUE_COL: Record<DefaultType, string> = {
  asp: 'asp',
  cogs: 'cogs',
  return_pct: 'return_pct',
  tax_pct: 'tax_pct',
  sellex_pct: 'sellex_pct',
  standard_doh: 'doh',
};

const REQUIRED_COLS: Record<DefaultType, string[]> = {
  asp: ['sub_brand', 'sub_category', 'channel', 'asp'],
  cogs: ['sub_brand', 'sub_category', 'cogs'],
  return_pct: ['sub_brand', 'sub_category', 'channel', 'return_pct'],
  tax_pct: ['sub_category', 'tax_pct'],
  sellex_pct: ['sub_brand', 'sub_category', 'channel', 'sellex_pct'],
  standard_doh: ['sub_brand', 'sub_category', 'doh'],
};

type Params = { params: Promise<{ type: string }> };

export const POST = withAuth('manage_master_data', async (req: NextRequest, auth, { params }: Params) => {
  const { type } = await params;
  const defaultType = type as DefaultType;
  if (!TABLE_MAP[defaultType]) {
    return NextResponse.json({ error: `Invalid default type: ${type}` }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const brandId = formData.get('brandId') as string | null;

  if (!file || !brandId) {
    return NextResponse.json({ error: 'file and brandId are required' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = await parseUploadedFile(buffer, file.name);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }

  // Validate required columns
  const cols = Object.keys(rows[0]).map(k => k.toLowerCase().trim());
  const requiredCols = REQUIRED_COLS[defaultType];
  const missingCols = requiredCols.filter(c => !cols.includes(c));
  if (missingCols.length > 0) {
    return NextResponse.json({ error: `Missing columns: ${missingCols.join(', ')}` }, { status: 400 });
  }

  const valueCol = VALUE_COL[defaultType];
  const inserts = rows.map((r: any) => {
    const insert: any = {
      brand_id: brandId,
      sub_category: String(r.sub_category || '').trim().toLowerCase(),
      [valueCol]: Number(r[valueCol]),
      updated_at: new Date().toISOString(),
    };
    if (requiredCols.includes('sub_brand')) {
      insert.sub_brand = String(r.sub_brand || '').trim().toLowerCase();
    }
    if (requiredCols.includes('channel')) {
      insert.channel = String(r.channel || '').trim().toLowerCase();
    }
    return insert;
  }).filter((r: any) => !isNaN(r[valueCol]));

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from(TABLE_MAP[defaultType])
    .upsert(inserts, {
      onConflict: getConflictColumns(defaultType),
    })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length || 0 }, { status: 201 });
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
