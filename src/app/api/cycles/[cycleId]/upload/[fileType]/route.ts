import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { parseUploadedFile } from '@/lib/fileParser';
import { validateUpload, MasterDataContext } from '@/lib/uploadValidator';
import { ALL_FILE_TYPES, FileType } from '@/types/otb';

type Params = { params: Promise<{ cycleId: string; fileType: string }> };

export const POST = withAuth('upload_data', async (req, auth, { params }: Params) => {
  const { cycleId, fileType } = await params;

  if (!ALL_FILE_TYPES.includes(fileType as FileType)) {
    return NextResponse.json({ error: `Invalid file type: ${fileType}` }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Verify cycle exists and is in Draft status
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status')
    .eq('id', cycleId)
    .single();

  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  if (cycle.status !== 'Draft') {
    return NextResponse.json({ error: 'Files can only be uploaded in Draft status' }, { status: 400 });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Check file size (50MB max)
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 });
  }

  try {
    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseUploadedFile(buffer, file.name);

    // Load master data for validation context
    const masterData = await loadMasterData(supabase);

    // Validate
    const result = validateUpload(fileType as FileType, rows, masterData);

    // Store file in Supabase Storage
    const storagePath = `${cycleId}/${fileType}/${file.name}`;
    await supabase.storage.from('otb-uploads').upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

    // Delete any previous upload record for this cycle+fileType
    await supabase
      .from('file_uploads')
      .delete()
      .eq('cycle_id', cycleId)
      .eq('file_type', fileType);

    // Create file_uploads record
    const { data: upload, error: insertError } = await supabase
      .from('file_uploads')
      .insert({
        cycle_id: cycleId,
        file_type: fileType,
        file_name: file.name,
        storage_path: storagePath,
        status: result.valid ? 'validated' : 'failed',
        row_count: rows.length,
        errors: result.valid ? null : result.errors,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      valid: result.valid,
      rowCount: rows.length,
      errors: result.errors,
      upload,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
});

async function loadMasterData(supabase: Awaited<ReturnType<typeof createServerClient>>): Promise<MasterDataContext> {
  const [subBrandsRes, subCatsRes, channelsRes, gendersRes, mappingsRes] = await Promise.all([
    supabase.from('sub_brands').select('name'),
    supabase.from('sub_categories').select('name'),
    supabase.from('channels').select('name'),
    supabase.from('genders').select('name'),
    supabase.from('master_mappings').select('*'),
  ]);

  const mappings = new Map<string, string>();
  for (const m of mappingsRes.data || []) {
    mappings.set(`${m.mapping_type}:${m.raw_value.toLowerCase()}`, m.standard_value.toLowerCase());
  }

  return {
    subBrands: new Set((subBrandsRes.data || []).map(r => r.name.toLowerCase())),
    subCategories: new Set((subCatsRes.data || []).map(r => r.name.toLowerCase())),
    channels: new Set((channelsRes.data || []).map(r => r.name.toLowerCase())),
    genders: new Set((gendersRes.data || []).map(r => r.name.toLowerCase())),
    mappings,
  };
}
