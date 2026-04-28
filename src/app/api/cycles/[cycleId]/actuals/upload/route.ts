import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { parseUploadedFile } from '@/lib/fileParser';
import { validateUpload, MasterDataContext } from '@/lib/uploadValidator';
import { calcActualDerived, ActualDerivedInputs } from '@/lib/varianceEngine';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

type Params = { params: Promise<{ cycleId: string }> };

export const POST = withAuth('upload_actuals', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;

  const supabase = await createServerClient();

  // Verify cycle exists and is in Approved status
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('id, status, brand_id')
    .eq('id', cycleId)
    .single();

  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  if (cycle.status !== 'Approved') {
    return NextResponse.json(
      { error: 'Actuals can only be uploaded for Approved cycles' },
      { status: 400 },
    );
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
    const masterData = await loadMasterData(supabase, cycle.brand_id);

    // Validate using actuals schema
    const result = validateUpload('actuals', rows, masterData);
    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        rowCount: rows.length,
        errors: result.errors,
      }, { status: 400 });
    }

    // Load sub_categories with wear_type mapping (to resolve wear_type from sub_category)
    const { data: subCatRows } = await supabase
      .from('sub_categories')
      .select('name, wear_types(name)')
      .eq('brand_id', cycle.brand_id);

    const subCatToWearType = new Map<string, string>();
    for (const sc of subCatRows || []) {
      const wearTypeName = (sc.wear_types as any)?.name ?? 'unknown';
      subCatToWearType.set(sc.name.toLowerCase(), wearTypeName.toLowerCase());
    }

    // Load plan rows + plan data for this cycle to get reference data (ASP, COGS, etc.)
    const { data: planRows } = await supabase
      .from('otb_plan_rows')
      .select('id, sub_brand, wear_type, sub_category, gender, channel')
      .eq('cycle_id', cycleId);

    // Build a lookup map for plan rows: dimKey → plan row
    const planRowMap = new Map<string, typeof planRows extends (infer T)[] | null ? T : never>();
    for (const pr of planRows || []) {
      const key = [pr.sub_brand, pr.sub_category, pr.gender, pr.channel]
        .map(v => v.toLowerCase())
        .join('|');
      planRowMap.set(key, pr);
    }

    // Load plan data for reference values (ASP, COGS, opening_stock, return_pct, etc.)
    const planRowIds = (planRows || []).map(pr => pr.id);
    const { data: planDataRows } = planRowIds.length > 0
      ? await supabase
          .from('otb_plan_data')
          .select('plan_row_id, month, asp, cogs, opening_stock_qty, return_pct, tax_pct, nsq')
          .in('plan_row_id', planRowIds)
      : { data: [] };

    // Build plan data lookup: "planRowId|month" → plan data record
    const planDataMap = new Map<string, any>();
    for (const pd of planDataRows || []) {
      const key = `${pd.plan_row_id}|${pd.month}`;
      planDataMap.set(key, pd);
    }

    // Build upsert records with derived calculations
    const upsertRecords = [];

    for (const row of result.normalizedRows) {
      const subBrand = String(row.sub_brand);
      const subCategory = String(row.sub_category);
      const gender = String(row.gender);
      const channel = String(row.channel);
      const month = String(row.month);
      const actualNsq = Number(row.actual_nsq) || 0;
      const actualInwardsQty = Number(row.actual_inwards_qty) || 0;

      // Resolve wear_type from sub_category
      const wearType = subCatToWearType.get(subCategory) ?? 'unknown';

      // Look up the matching plan row for reference data
      const dimKey = [subBrand, subCategory, gender, channel].join('|');
      const planRow = planRowMap.get(dimKey);

      let asp: number | null = null;
      let cogs: number | null = null;
      let openingStockQty: number | null = null;
      let returnPct: number | null = null;
      let taxPct: number | null = null;

      if (planRow) {
        const pdKey = `${planRow.id}|${month}`;
        const pd = planDataMap.get(pdKey);
        if (pd) {
          asp = pd.asp;
          cogs = pd.cogs;
          openingStockQty = pd.opening_stock_qty;
          returnPct = pd.return_pct;
          taxPct = pd.tax_pct;
        }
      }

      // Calculate derived metrics
      const derived = calcActualDerived({
        actualNsq,
        actualInwardsQty,
        asp,
        cogs,
        openingStockQty,
        returnPct,
        taxPct,
        nextMonthActualNsq: null, // Will be recalculated in a second pass if needed
      });

      upsertRecords.push({
        cycle_id: cycleId,
        sub_brand: subBrand,
        wear_type: wearType,
        sub_category: subCategory,
        gender,
        channel,
        month,
        actual_nsq: actualNsq,
        actual_inwards_qty: actualInwardsQty,
        actual_gmv: derived.actualGmv,
        actual_nsv: derived.actualNsv,
        actual_closing_stock_qty: derived.actualClosingStockQty,
        actual_doh: derived.actualDoh,
        actual_gm_pct: derived.actualGmPct,
        uploaded_by: auth.user.id,
      });
    }

    // Second pass: recalculate DOH with next month's actual NSQ where available
    // Group records by dimension key and sort by month
    const dimGroups = new Map<string, typeof upsertRecords>();
    for (const rec of upsertRecords) {
      const key = [rec.sub_brand, rec.sub_category, rec.gender, rec.channel].join('|');
      if (!dimGroups.has(key)) dimGroups.set(key, []);
      dimGroups.get(key)!.push(rec);
    }

    for (const group of dimGroups.values()) {
      group.sort((a, b) => a.month.localeCompare(b.month));
      for (let i = 0; i < group.length; i++) {
        const nextMonthNsq = i + 1 < group.length ? group[i + 1].actual_nsq : null;
        if (nextMonthNsq != null) {
          // Look up plan row for reference data
          const rec = group[i];
          const dimKey = [rec.sub_brand, rec.sub_category, rec.gender, rec.channel].join('|');
          const planRow = planRowMap.get(dimKey);
          let openingStockQty: number | null = null;
          if (planRow) {
            const pd = planDataMap.get(`${planRow.id}|${rec.month}`);
            if (pd) openingStockQty = pd.opening_stock_qty;
          }

          // Recalculate with next month NSQ for DOH
          const derived = calcActualDerived({
            actualNsq: rec.actual_nsq,
            actualInwardsQty: rec.actual_inwards_qty,
            asp: null, // Not needed for DOH recalc — keep existing gmv etc.
            cogs: null,
            openingStockQty,
            returnPct: null,
            taxPct: null,
            nextMonthActualNsq: nextMonthNsq,
          });
          // Only update DOH — keep other derived values from first pass
          rec.actual_doh = derived.actualDoh;
        }
      }
    }

    // Upsert into otb_actuals using admin client to bypass RLS
    const admin = createAdminClient();
    const { error: upsertError } = await admin
      .from('otb_actuals')
      .upsert(upsertRecords, {
        onConflict: 'cycle_id,sub_brand,wear_type,sub_category,gender,channel,month',
      });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Log audit event
    await logAudit({
      entityType: 'actuals',
      entityId: cycleId,
      action: 'UPLOAD',
      userId: auth.user.id,
      userEmail: auth.user.email,
      userRole: auth.profile.role,
      details: {
        file_name: file.name,
        row_count: upsertRecords.length,
      },
      ipAddress: getClientIp(req.headers),
    });

    return NextResponse.json({
      valid: true,
      rowCount: upsertRecords.length,
      errors: [],
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
