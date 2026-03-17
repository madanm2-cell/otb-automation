import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getQuarterDates } from '@/lib/quarterUtils';
import type { DefaultType } from '@/types/otb';

interface UploadedData {
  opening_stock: Record<string, unknown>[];
  ly_sales: Record<string, unknown>[];
  recent_sales: Record<string, unknown>[];
  soft_forecast: Record<string, unknown>[];
}

interface CycleDefaultRow {
  default_type: DefaultType;
  sub_brand: string | null;
  sub_category: string;
  channel: string | null;
  value: number;
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
 * Generate plan rows + monthly data from uploaded files + cycle defaults.
 * Called after uploads validated AND defaults confirmed, when cycle is activated.
 */
export async function generateTemplate(cycleId: string): Promise<{ rowCount: number; warnings?: string[] }> {
  const supabase = await createServerClient();
  const adminDb = createAdminClient();

  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('*')
    .eq('id', cycleId)
    .single();

  if (!cycle) throw new Error('Cycle not found');

  const quarterDates = getQuarterDates(cycle.planning_quarter);
  const months = quarterDates.months;

  // Load uploaded file data (only 3 required + 1 optional)
  const uploadedData = await loadAllUploadedData(supabase, cycleId);

  // Load confirmed cycle defaults
  const { data: cycleDefaults } = await adminDb
    .from('cycle_defaults')
    .select('default_type, sub_brand, sub_category, channel, value')
    .eq('cycle_id', cycleId);

  if (!cycleDefaults || cycleDefaults.length === 0) {
    throw new Error('No cycle defaults found. Initialize and confirm defaults before activation.');
  }

  // Build lookup maps from cycle defaults
  const aspMap = buildDefaultLookup(cycleDefaults, 'asp', ['sub_brand', 'sub_category', 'channel']);
  const cogsMap = buildDefaultLookup(cycleDefaults, 'cogs', ['sub_brand', 'sub_category']);
  const returnMap = buildDefaultLookup(cycleDefaults, 'return_pct', ['sub_brand', 'sub_category', 'channel']);
  const taxMap = buildDefaultLookup(cycleDefaults, 'tax_pct', ['sub_category']);
  const sellexMap = buildDefaultLookup(cycleDefaults, 'sellex_pct', ['sub_brand', 'sub_category', 'channel']);
  const dohMap = buildDefaultLookup(cycleDefaults, 'standard_doh', ['sub_brand', 'sub_category']);

  // Load sub_categories with wear_types join
  const { data: subCategoryData } = await adminDb
    .from('sub_categories')
    .select('name, wear_type_id, wear_types(name)')
    .eq('brand_id', cycle.brand_id)
    .not('wear_type_id', 'is', null);

  const subCatWearTypeMap = new Map<string, string>();
  for (const sc of subCategoryData || []) {
    if ((sc.wear_types as any)?.name) {
      subCatWearTypeMap.set(sc.name.toLowerCase(), (sc.wear_types as any).name);
    }
  }

  // Determine unique dimension combinations from opening_stock
  const dimensionCombos: DimensionKey[] = [];
  const seenKeys = new Set<string>();
  const warnings: string[] = [];
  const missingWearTypes = new Set<string>();

  for (const row of uploadedData.opening_stock) {
    const subCategory = String(row.sub_category || '').toLowerCase();
    const wearType = subCatWearTypeMap.get(subCategory);

    if (!wearType) {
      missingWearTypes.add(subCategory);
      continue;
    }

    const combo: DimensionKey = {
      sub_brand: String(row.sub_brand || '').toLowerCase(),
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
    warnings.push(`Missing wear_type for sub_category: ${[...missingWearTypes].join(', ')}`);
  }

  if (dimensionCombos.length === 0) {
    throw new Error(
      'No dimension combinations found. ' +
      (missingWearTypes.size > 0
        ? `All rows skipped due to missing wear_type for sub_categories: ${[...missingWearTypes].join(', ')}`
        : 'Opening stock data is empty')
    );
  }

  // Build lookup maps for uploaded data
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

      // Lookup keys for cycle defaults
      const sbScChKey = lookupKey([row.sub_brand, row.sub_category, row.channel]);
      const sbScKey = lookupKey([row.sub_brand, row.sub_category]);
      const scKey = lookupKey([row.sub_category]);

      // Lookup keys for uploaded data
      const fullKey = lookupKey([row.sub_brand, row.sub_category, row.gender, row.channel]);
      const sbgKey = lookupKey([row.sub_brand, row.sub_category, row.gender]);

      planDataInserts.push({
        row_id: row.id,
        month,
        asp: aspMap.get(sbScChKey) ?? null,
        cogs: cogsMap.get(sbScKey) ?? null,
        opening_stock_qty: mIdx === 0 ? (openingStockMap.get(fullKey) ?? null) : null,
        ly_sales_nsq: lyMap.get(`${fullKey}|${shiftYearBack(month)}`) ?? null,
        recent_sales_nsq: recentMap.get(sbgKey) ?? null,
        soft_forecast_nsq: forecastMap.get(sbgKey) ?? null,
        return_pct: returnMap.get(sbScChKey) ?? null,
        tax_pct: taxMap.get(scKey) ?? null,
        sellex_pct: sellexMap.get(sbScChKey) ?? null,
        standard_doh: dohMap.get(sbScKey) ?? null,
      });
    }
  }

  // Batch insert
  const BATCH_SIZE = 500;
  for (let i = 0; i < planDataInserts.length; i += BATCH_SIZE) {
    const batch = planDataInserts.slice(i, i + BATCH_SIZE);
    const { error } = await adminDb.from('otb_plan_data').insert(batch);
    if (error) throw new Error(`Failed to insert plan data batch: ${error.message}`);
  }

  return { rowCount: insertedRows!.length, warnings: warnings.length > 0 ? warnings : undefined };
}

// --- Helper functions ---

function shiftYearBack(month: string): string {
  const year = parseInt(month.substring(0, 4));
  return `${year - 1}${month.substring(4)}`;
}

function lookupKey(parts: string[]): string {
  return parts.map(p => String(p || '').toLowerCase()).join('|');
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

/**
 * Build a lookup map from cycle_defaults rows for a specific default_type.
 * @param keyFields - which fields to include in the key (sub_brand, sub_category, channel)
 */
function buildDefaultLookup(
  defaults: CycleDefaultRow[],
  type: DefaultType,
  keyFields: ('sub_brand' | 'sub_category' | 'channel')[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of defaults) {
    if (row.default_type !== type) continue;
    const key = lookupKey(keyFields.map(f => String(row[f] || '')));
    map.set(key, row.value);
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
    ly_sales: [],
    recent_sales: [],
    soft_forecast: [],
  };

  if (!uploads) return result;

  for (const upload of uploads) {
    const fileType = upload.file_type as keyof UploadedData;
    if (!(fileType in result)) continue;

    const { data: fileData } = await supabase.storage
      .from('otb-uploads')
      .download(upload.storage_path);

    if (!fileData) continue;

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { parseUploadedFile } = await import('@/lib/fileParser');
    const rows = await parseUploadedFile(buffer, upload.file_name);
    result[fileType] = rows;
  }

  return result;
}
