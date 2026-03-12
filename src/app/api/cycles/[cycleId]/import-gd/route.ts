import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import ExcelJS from 'exceljs';

type Params = { params: Promise<{ cycleId: string }> };

interface ParsedGdRow {
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  month: string;
  nsq?: number;
  inwards_qty?: number;
  perf_marketing_pct?: number;
}

// POST /api/cycles/:cycleId/import-gd — parse XLSX with GD values, match to plan rows
export const POST = withAuth('edit_otb', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const supabase = await createServerClient();

  // Verify cycle
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('status')
    .eq('id', cycleId)
    .single();

  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  if (cycle.status !== 'Filling') {
    return NextResponse.json({ error: 'Cycle must be in Filling status' }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  // Parse XLSX
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return NextResponse.json({ error: 'No worksheet found' }, { status: 400 });

  // Parse header row
  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || '').trim().toLowerCase();
  });

  // Required dimension columns
  const requiredCols = ['sub_brand', 'wear_type', 'sub_category', 'gender', 'channel', 'month'];
  const missing = requiredCols.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing columns: ${missing.join(', ')}` }, { status: 400 });
  }

  // Parse data rows
  const parsedRows: ParsedGdRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const record: Record<string, string | number> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) record[header] = cell.value as string | number;
    });

    parsedRows.push({
      sub_brand: String(record.sub_brand || '').trim(),
      wear_type: String(record.wear_type || '').trim(),
      sub_category: String(record.sub_category || '').trim(),
      gender: String(record.gender || '').trim(),
      channel: String(record.channel || '').trim(),
      month: String(record.month || '').trim(),
      nsq: record.nsq != null ? Number(record.nsq) : undefined,
      inwards_qty: record.inwards_qty != null ? Number(record.inwards_qty) : undefined,
      perf_marketing_pct: record.perf_marketing_pct != null ? Number(record.perf_marketing_pct) : undefined,
    });
  });

  // Get existing plan rows for matching
  const { data: planRows } = await supabase
    .from('otb_plan_rows')
    .select('id, sub_brand, wear_type, sub_category, gender, channel')
    .eq('cycle_id', cycleId);

  if (!planRows) return NextResponse.json({ error: 'Failed to fetch plan rows' }, { status: 500 });

  // Build dimension key → row_id map
  const rowMap = new Map<string, string>();
  for (const r of planRows) {
    const key = [r.sub_brand, r.wear_type, r.sub_category, r.gender, r.channel]
      .map(v => String(v).trim().toLowerCase())
      .join('|');
    rowMap.set(key, r.id as string);
  }

  // Match parsed rows to plan rows
  const matched: { rowId: string; month: string; nsq?: number; inwards_qty?: number; perf_marketing_pct?: number }[] = [];
  const unmatched: ParsedGdRow[] = [];

  for (const row of parsedRows) {
    const key = [row.sub_brand, row.wear_type, row.sub_category, row.gender, row.channel]
      .map(v => v.toLowerCase())
      .join('|');
    const rowId = rowMap.get(key);
    if (rowId) {
      matched.push({
        rowId,
        month: row.month,
        nsq: row.nsq,
        inwards_qty: row.inwards_qty,
        perf_marketing_pct: row.perf_marketing_pct,
      });
    } else {
      unmatched.push(row);
    }
  }

  return NextResponse.json({
    totalParsed: parsedRows.length,
    matched: matched.length,
    unmatched: unmatched.length,
    unmatchedRows: unmatched.slice(0, 10),
    updates: matched,
  });
});
