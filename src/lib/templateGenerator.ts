import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getQuarterDates } from '@/lib/quarterUtils';

interface UploadedData {
  opening_stock: Record<string, unknown>[];
  cogs: Record<string, unknown>[];
  asp: Record<string, unknown>[];
  standard_doh: Record<string, unknown>[];
  ly_sales: Record<string, unknown>[];
  recent_sales: Record<string, unknown>[];
  return_pct: Record<string, unknown>[];
  tax_pct: Record<string, unknown>[];
  sellex_pct: Record<string, unknown>[];
  soft_forecast: Record<string, unknown>[];
}

interface DimensionKey {
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
}

function makeKey(d: DimensionKey): string {
  return `${d.sub_brand}|${d.wear_type}|${d.sub_category}|${d.gender}|${d.channel}`;
}

/**
 * Generate plan rows + monthly data from uploaded reference files.
 * Called after all uploads are validated, when cycle is activated.
 */
export async function generateTemplate(cycleId: string): Promise<{ rowCount: number; warnings?: string[] }> {
  const supabase = await createServerClient();
  const adminDb = createAdminClient(); // bypasses RLS for insert/delete operations

  // Get cycle details
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*')
    .eq('id', cycleId)
    .single();

  if (!cycle) throw new Error('Cycle not found');

  const quarterDates = getQuarterDates(cycle.planning_quarter);
  const months = quarterDates.months;

  // Load all uploaded file data by re-parsing stored files
  // For simplicity, we'll query the upload records and re-download/parse
  // In production, we'd cache parsed data. Here we'll use a simpler approach:
  // store normalized rows in a staging table or re-parse from storage.
  // For MVP, we'll re-parse from storage.
  const uploadedData = await loadAllUploadedData(supabase, cycleId);

  // Load wear_type mappings (sub_brand × sub_category → wear_type)
  const { data: wearTypeMappings } = await adminDb
    .from('wear_type_mappings')
    .select('sub_brand, sub_category, wear_type');

  const wearTypeMap = new Map<string, string>();
  for (const m of wearTypeMappings || []) {
    wearTypeMap.set(`${m.sub_brand}|${m.sub_category}`, m.wear_type);
  }

  // Determine unique dimension combinations from opening_stock (primary source)
  const dimensionCombos: DimensionKey[] = [];
  const seenKeys = new Set<string>();
  const warnings: string[] = [];
  const missingWearTypes = new Set<string>();

  for (const row of uploadedData.opening_stock) {
    const subBrand = String(row.sub_brand || '').toLowerCase();
    const subCategory = String(row.sub_category || '').toLowerCase();
    const wearType = wearTypeMap.get(`${subBrand}|${subCategory}`);

    if (!wearType) {
      missingWearTypes.add(`${subBrand} × ${subCategory}`);
      continue;
    }

    const combo: DimensionKey = {
      sub_brand: subBrand,
      wear_type: wearType,
      sub_category: subCategory,
      gender: String(row.gender || '').toLowerCase(),
      channel: String(row.channel || '').toLowerCase(),
    };
    const key = makeKey(combo);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      dimensionCombos.push(combo);
    }
  }

  if (missingWearTypes.size > 0) {
    warnings.push(`Missing wear_type mapping for: ${[...missingWearTypes].join(', ')}`);
  }

  if (dimensionCombos.length === 0) {
    throw new Error(
      'No dimension combinations found. ' +
      (missingWearTypes.size > 0
        ? `All rows skipped due to missing wear_type mappings: ${[...missingWearTypes].join(', ')}`
        : 'Opening stock data is empty')
    );
  }

  // Build lookup maps for reference data
  const cogsMap = buildLookup(uploadedData.cogs, ['sub_brand', 'sub_category'], 'cogs');
  const aspMap = buildLookup(uploadedData.asp, ['sub_brand', 'sub_category', 'channel'], 'asp');
  const dohMap = buildLookup(uploadedData.standard_doh, ['sub_brand', 'sub_category'], 'doh');
  const returnMap = buildLookup(uploadedData.return_pct, ['sub_category', 'channel'], 'return_pct');
  const taxMap = buildLookup(uploadedData.tax_pct, ['sub_category', 'channel'], 'tax_pct');
  const sellexMap = buildLookup(uploadedData.sellex_pct, ['sub_category', 'channel'], 'sellex_pct');
  const openingStockMap = buildLookup(uploadedData.opening_stock, ['sub_brand', 'sub_category', 'gender', 'channel'], 'quantity');
  const lyMap = buildMonthLookup(uploadedData.ly_sales, ['sub_brand', 'sub_category', 'gender', 'channel'], 'nsq');
  const recentMap = buildLookup(uploadedData.recent_sales, ['sub_brand', 'sub_category', 'gender'], 'nsq');
  const forecastMap = buildLookup(uploadedData.soft_forecast, ['sub_brand', 'sub_category', 'gender'], 'nsq');

  // Delete existing plan rows for this cycle (in case of re-generation)
  const { data: existingRows } = await adminDb
    .from('otb_plan_rows')
    .select('id')
    .eq('cycle_id', cycleId);

  if (existingRows && existingRows.length > 0) {
    const rowIds = existingRows.map(r => r.id);
    await adminDb.from('otb_plan_data').delete().in('row_id', rowIds);
    await adminDb.from('otb_plan_rows').delete().eq('cycle_id', cycleId);
  }

  // Insert plan rows
  const planRowInserts = dimensionCombos.map(combo => ({
    cycle_id: cycleId,
    ...combo,
  }));

  const { data: insertedRows, error: rowError } = await adminDb
    .from('otb_plan_rows')
    .insert(planRowInserts)
    .select('id, sub_brand, wear_type, sub_category, gender, channel');

  if (rowError) throw new Error(`Failed to insert plan rows: ${rowError.message}`);

  // Insert plan data for each row × each month
  const planDataInserts: Record<string, unknown>[] = [];

  for (const row of insertedRows!) {
    for (let mIdx = 0; mIdx < months.length; mIdx++) {
      const month = months[mIdx];
      const sbKey = lookupKey([row.sub_brand, row.sub_category]);
      const sbcKey = lookupKey([row.sub_brand, row.sub_category, row.channel]);
      const scChKey = lookupKey([row.sub_category, row.channel]);
      const fullKey = lookupKey([row.sub_brand, row.sub_category, row.gender, row.channel]);
      const sbgKey = lookupKey([row.sub_brand, row.sub_category, row.gender]);

      planDataInserts.push({
        row_id: row.id,
        month,
        asp: aspMap.get(sbcKey) ?? null,
        cogs: cogsMap.get(sbKey) ?? null,
        opening_stock_qty: mIdx === 0 ? (openingStockMap.get(fullKey) ?? null) : null,
        ly_sales_nsq: lyMap.get(`${fullKey}|${shiftYearBack(month)}`) ?? null,
        recent_sales_nsq: recentMap.get(sbgKey) ?? null,
        soft_forecast_nsq: forecastMap.get(sbgKey) ?? null,
        return_pct: returnMap.get(scChKey) ?? null,
        tax_pct: taxMap.get(scChKey) ?? null,
        sellex_pct: sellexMap.get(scChKey) ?? null,
        standard_doh: dohMap.get(sbKey) ?? null,
      });
    }
  }

  // Batch insert (Supabase supports up to ~1000 rows per insert)
  const BATCH_SIZE = 500;
  for (let i = 0; i < planDataInserts.length; i += BATCH_SIZE) {
    const batch = planDataInserts.slice(i, i + BATCH_SIZE);
    const { error } = await adminDb.from('otb_plan_data').insert(batch);
    if (error) throw new Error(`Failed to insert plan data batch: ${error.message}`);
  }

  return { rowCount: insertedRows!.length, warnings: warnings.length > 0 ? warnings : undefined };
}

// --- Helper functions ---

/** Shift a "YYYY-MM-DD" date string back by 1 year (for LY lookup). */
function shiftYearBack(month: string): string {
  const year = parseInt(month.substring(0, 4));
  return `${year - 1}${month.substring(4)}`;
}

function lookupKey(parts: string[]): string {
  return parts.map(p => String(p).toLowerCase()).join('|');
}

function buildLookup(
  rows: Record<string, unknown>[],
  keyColumns: string[],
  valueColumn: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = lookupKey(keyColumns.map(c => String(row[c] || '')));
    const val = Number(row[valueColumn]);
    if (!isNaN(val)) map.set(key, val);
  }
  return map;
}

function buildMonthLookup(
  rows: Record<string, unknown>[],
  keyColumns: string[],
  valueColumn: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const dimKey = lookupKey(keyColumns.map(c => String(row[c] || '')));
    const month = String(row.month || '');
    const val = Number(row[valueColumn]);
    if (!isNaN(val)) map.set(`${dimKey}|${month}`, val);
  }
  return map;
}

async function loadAllUploadedData(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  cycleId: string
): Promise<UploadedData> {
  const { data: uploads } = await supabase
    .from('file_uploads')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('status', 'validated');

  const result: UploadedData = {
    opening_stock: [],
    cogs: [],
    asp: [],
    standard_doh: [],
    ly_sales: [],
    recent_sales: [],
    return_pct: [],
    tax_pct: [],
    sellex_pct: [],
    soft_forecast: [],
  };

  if (!uploads) {
    console.log('[generateTemplate] No validated uploads found for cycle', cycleId);
    return result;
  }

  console.log('[generateTemplate] Found', uploads.length, 'validated uploads:', uploads.map(u => `${u.file_type}(${u.storage_path})`));

  for (const upload of uploads) {
    const fileType = upload.file_type as keyof UploadedData;
    if (!(fileType in result)) {
      console.log('[generateTemplate] Skipping unknown file type:', fileType);
      continue;
    }

    // Download file from storage and re-parse
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('otb-uploads')
      .download(upload.storage_path);

    if (!fileData) {
      console.error('[generateTemplate] Failed to download', upload.storage_path, 'error:', downloadError);
      continue;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { parseUploadedFile } = await import('@/lib/fileParser');
    const rows = await parseUploadedFile(buffer, upload.file_name);
    console.log('[generateTemplate]', fileType, ':', rows.length, 'rows parsed');
    result[fileType] = rows;
  }

  return result;
}
