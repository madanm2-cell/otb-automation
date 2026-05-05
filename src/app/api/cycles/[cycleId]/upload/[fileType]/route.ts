import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { parseUploadedFile } from '@/lib/fileParser';
import { validateUpload, MasterDataContext } from '@/lib/uploadValidator';
import { ALL_FILE_TYPES, FileType } from '@/types/otb';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';
import { refreshReferenceData, checkLySalesMonthAlignment } from '@/lib/templateGenerator';

type Params = { params: Promise<{ cycleId: string; fileType: string }> };

// Reference data files that can be re-uploaded in Filling status
const REFILLABLE_TYPES: FileType[] = ['ly_sales', 'recent_sales', 'soft_forecast'];

export const POST = withAuth('upload_data', async (req, auth, { params }: Params) => {
  const { cycleId, fileType } = await params;

  if (!ALL_FILE_TYPES.includes(fileType as FileType)) {
    return NextResponse.json({ error: `Invalid file type: ${fileType}` }, { status: 400 });
  }

  const supabase = await createServerClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status, brand_id, planning_quarter')
    .eq('id', cycleId)
    .single();

  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });

  const isRefillable = REFILLABLE_TYPES.includes(fileType as FileType);
  const isAllowedStatus = cycle.status === 'Draft' || (cycle.status === 'Filling' && isRefillable);

  if (!isAllowedStatus) {
    const msg = isRefillable
      ? 'Reference data files can only be re-uploaded in Draft or Filling status'
      : 'Opening stock can only be uploaded in Draft status';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseUploadedFile(buffer, file.name);

    const masterData = await loadMasterData(supabase, cycle.brand_id);
    const result = validateUpload(fileType as FileType, rows, masterData);

    // Warn if LY sales months don't cover the planning quarter
    const uploadWarnings: string[] = [];
    if (fileType === 'ly_sales' && result.valid && cycle.planning_quarter) {
      const monthWarning = checkLySalesMonthAlignment(rows, cycle.planning_quarter);
      if (monthWarning) uploadWarnings.push(monthWarning);
    }

    const storagePath = `${cycleId}/${fileType}/${file.name}`;
    await supabase.storage.from('otb-uploads').upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

    await supabase
      .from('file_uploads')
      .delete()
      .eq('cycle_id', cycleId)
      .eq('file_type', fileType);

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

    // In Filling status, refresh reference data in existing plan rows
    let refreshedCount: number | undefined;
    if (result.valid && cycle.status === 'Filling' && isRefillable) {
      const refreshResult = await refreshReferenceData(
        cycleId,
        fileType as 'ly_sales' | 'recent_sales' | 'soft_forecast',
        rows,
        cycle.planning_quarter
      );
      refreshedCount = refreshResult.updatedCount;
      uploadWarnings.push(...refreshResult.warnings);
    }

    await logAudit({
      entityType: 'file_upload',
      entityId: cycleId,
      action: 'UPLOAD',
      userId: auth.user.id,
      userEmail: auth.user.email!,
      userRole: auth.profile.role,
      details: { file_type: fileType, file_name: file.name, row_count: rows.length, valid: result.valid },
      ipAddress: getClientIp(req.headers),
    });

    return NextResponse.json({
      valid: result.valid,
      rowCount: rows.length,
      errors: result.errors,
      warnings: uploadWarnings.length > 0 ? uploadWarnings : undefined,
      refreshedCount,
      upload,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
});

async function loadMasterData(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  brandId: string
): Promise<MasterDataContext> {
  const [subBrandsRes, subCatsRes, channelsRes, gendersRes] = await Promise.all([
    supabase.from('sub_brands').select('name').eq('brand_id', brandId),
    supabase.from('sub_categories').select('name').eq('brand_id', brandId),
    supabase.from('channels').select('name').eq('brand_id', brandId),
    supabase.from('genders').select('name').eq('brand_id', brandId),
  ]);

  return {
    subBrands: new Set((subBrandsRes.data || []).map(r => r.name.toLowerCase())),
    subCategories: new Set((subCatsRes.data || []).map(r => r.name.toLowerCase())),
    channels: new Set((channelsRes.data || []).map(r => r.name.toLowerCase())),
    genders: new Set((gendersRes.data || []).map(r => r.name.toLowerCase())),
  };
}
