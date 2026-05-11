import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';

type Params = { params: Promise<{ cycleId: string; fileType: string }> };

// GET /api/cycles/:cycleId/upload/:fileType/download
// Streams the originally uploaded reference file back to the user so they can
// inspect what was uploaded. Reference files are stored in the otb-uploads
// Storage bucket at `${cycleId}/${fileType}/${file_name}`.
export const GET = withAuth('view_cycle', async (req, auth, { params }: Params) => {
  const { cycleId, fileType } = await params;
  const supabase = await createServerClient();

  const { data: upload, error } = await supabase
    .from('file_uploads')
    .select('storage_path, file_name')
    .eq('cycle_id', cycleId)
    .eq('file_type', fileType)
    .single();

  if (error || !upload) {
    return NextResponse.json({ error: 'No file found for this type' }, { status: 404 });
  }

  const { data: blob, error: dlError } = await supabase
    .storage
    .from('otb-uploads')
    .download(upload.storage_path);

  if (dlError || !blob) {
    return NextResponse.json({ error: dlError?.message || 'File not found in storage' }, { status: 404 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const fileName = upload.file_name || `${fileType}.csv`;
  const contentType = fileName.toLowerCase().endsWith('.xlsx')
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : fileName.toLowerCase().endsWith('.xls')
      ? 'application/vnd.ms-excel'
      : 'text/csv';

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
});
