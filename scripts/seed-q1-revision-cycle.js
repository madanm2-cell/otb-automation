'use strict';

/**
 * One-off demo seed: creates "Bewakoof Q1-FY27 Revision OTB" in InReview state.
 *
 * Story: GD submitted a mid-quarter revision after April actuals came in.
 * Planning and GD have signed off; Finance and CXO approval is pending.
 * Plan numbers are ~6% higher than the original approved plan (bullish revision).
 *
 * Run:  node scripts/seed-q1-revision-cycle.js
 * Safe: idempotent — deletes and recreates the revision cycle each run.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REVISION_UPLIFT = 1.06; // +6% on NSQ and inwards
const REVISION_CYCLE_NAME = 'Bewakoof Q1-FY27 Revision OTB';
const SOURCE_CYCLE_NAME = 'Bewakoof Q1-FY27 OTB';

function round2(n) { return Math.round(n * 100) / 100; }

// Mirrors the formula engine — recomputes derived fields after NSQ uplift.
function recomputeDerived(d) {
  const asp = d.asp || 0;
  const cogs = d.cogs || 0;
  const nsq = d.nsq || 0;
  const inwards = d.inwards_qty || 0;
  const opening = d.opening_stock_qty || 0;
  const lyNsq = d.ly_sales_nsq || 0;
  const returnPct = d.return_pct || 0;
  const taxPct = d.tax_pct || 0;
  const sellexPct = d.sellex_pct || 0;
  const perfMktgPct = d.perf_marketing_pct || 0;
  const nextNsq = d._next_nsq || nsq;

  const salesPlanGmv = round2(nsq * asp);
  const golyPct = lyNsq > 0 ? round2(((nsq / lyNsq) - 1) * 100) : null;
  const nsv = round2(salesPlanGmv * (1 - returnPct / 100) * (1 - taxPct / 100));
  const inwardsValCogs = round2(inwards * cogs);
  const openingStockVal = round2(opening * cogs);
  const closingStockQty = opening + inwards - nsq;
  const fwd30dayDoh = nextNsq > 0 ? round2((closingStockQty * 30) / nextNsq) : null;
  const gmPct = asp > 0 ? round2(((asp - cogs) / asp) * 100) : null;
  const grossMargin = nsv > 0 && gmPct != null ? round2(nsv * gmPct / 100) : null;
  const cm1 = gmPct != null ? round2(gmPct - sellexPct) : null;
  const cm2 = cm1 != null ? round2(cm1 - perfMktgPct) : null;

  return {
    sales_plan_gmv: salesPlanGmv,
    goly_pct: golyPct,
    nsv,
    inwards_val_cogs: inwardsValCogs,
    opening_stock_val: openingStockVal,
    closing_stock_qty: closingStockQty,
    fwd_30day_doh: fwd30dayDoh,
    gm_pct: gmPct,
    gross_margin: grossMargin,
    cm1,
    cm2,
  };
}

async function main() {
  console.log('🔧  Connecting to Supabase:', supabaseUrl);

  // 1. Find Bewakoof brand
  const { data: brand, error: bErr } = await supabase
    .from('brands')
    .select('id')
    .eq('name', 'Bewakoof')
    .single();
  if (bErr || !brand) { console.error('❌  Bewakoof brand not found:', bErr?.message); process.exit(1); }
  const bewakoofId = brand.id;
  console.log('✅  Bewakoof brand ID:', bewakoofId);

  // 2. Find user IDs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, role')
    .in('email', [
      'planning@bewakoof.com',
      'gd.bewakoof@bewakoof.com',
      'finance@bewakoof.com',
      'cxo@bewakoof.com',
      'admin@bewakoof.com',
    ]);

  const userMap = {};
  for (const p of profiles || []) userMap[p.email] = p.id;

  const planningId = userMap['planning@bewakoof.com'];
  const gdId = userMap['gd.bewakoof@bewakoof.com'];
  const createdById = userMap['admin@bewakoof.com'] || userMap['planning@bewakoof.com'];

  if (!planningId || !gdId) {
    console.error('❌  Required users not found. Run seed-demo-data.js first.');
    process.exit(1);
  }
  console.log('✅  Users found');

  // 3. Find source (approved) Q1-FY27 cycle
  const { data: sourceCycle, error: scErr } = await supabase
    .from('otb_cycles')
    .select('id, assigned_gd_id')
    .eq('cycle_name', SOURCE_CYCLE_NAME)
    .eq('brand_id', bewakoofId)
    .maybeSingle();

  if (scErr || !sourceCycle) {
    console.error(`❌  Source cycle "${SOURCE_CYCLE_NAME}" not found:`, scErr?.message);
    console.error('    Run seed-demo-data.js first to create the approved Q1-FY27 cycle.');
    process.exit(1);
  }
  console.log('✅  Source cycle found:', sourceCycle.id);

  // 4. Fetch source plan rows
  const { data: sourceRows, error: srErr } = await supabase
    .from('otb_plan_rows')
    .select('sub_brand, wear_type, sub_category, gender, channel')
    .eq('cycle_id', sourceCycle.id);

  if (srErr || !sourceRows || sourceRows.length === 0) {
    console.error('❌  No plan rows on source cycle:', srErr?.message);
    process.exit(1);
  }
  console.log(`✅  ${sourceRows.length} plan rows found on source cycle`);

  // 5. Fetch source plan data (keyed by row dimension tuple for matching)
  const { data: allSourceRows } = await supabase
    .from('otb_plan_rows')
    .select('id, sub_brand, wear_type, sub_category, gender, channel')
    .eq('cycle_id', sourceCycle.id);

  const rowIds = (allSourceRows || []).map(r => r.id);
  const rowDims = {};
  for (const r of allSourceRows || []) {
    rowDims[r.id] = `${r.sub_brand}|${r.wear_type}|${r.sub_category}|${r.gender}|${r.channel}`;
  }

  const { data: sourcePlanData } = await supabase
    .from('otb_plan_data')
    .select('*')
    .in('row_id', rowIds);

  if (!sourcePlanData || sourcePlanData.length === 0) {
    console.error('❌  No plan data on source cycle. Run seed-demo-data.js first.');
    process.exit(1);
  }
  console.log(`✅  ${sourcePlanData.length} plan data records found`);

  // 6. Delete existing revision cycle if it exists
  const { data: existingRevision } = await supabase
    .from('otb_cycles')
    .select('id')
    .eq('cycle_name', REVISION_CYCLE_NAME)
    .eq('brand_id', bewakoofId)
    .maybeSingle();

  if (existingRevision) {
    // Cascade deletes plan rows, plan data, approval_tracking via FK constraints
    await supabase.from('otb_cycles').delete().eq('id', existingRevision.id);
    console.log('  ↺  Deleted existing revision cycle');
  }

  // 7. Create the revision cycle
  const { data: revCycle, error: rcErr } = await supabase
    .from('otb_cycles')
    .insert({
      cycle_name: REVISION_CYCLE_NAME,
      brand_id: bewakoofId,
      planning_quarter: 'Q1-FY27',
      planning_period_start: '2026-04-01',
      planning_period_end: '2026-06-30',
      fill_deadline: '2026-03-10',
      approval_deadline: '2026-05-20',
      assigned_gd_id: sourceCycle.assigned_gd_id || gdId,
      status: 'InReview',
      created_by: createdById,
      defaults_confirmed: true,
    })
    .select('id')
    .single();

  if (rcErr || !revCycle) {
    console.error('❌  Failed to create revision cycle:', rcErr?.message);
    process.exit(1);
  }
  const revCycleId = revCycle.id;
  console.log('✅  Revision cycle created:', revCycleId);

  // 8. Clone plan rows into revision cycle
  const { data: newRows, error: nrErr } = await supabase
    .from('otb_plan_rows')
    .insert(
      sourceRows.map(r => ({
        cycle_id: revCycleId,
        sub_brand: r.sub_brand,
        wear_type: r.wear_type,
        sub_category: r.sub_category,
        gender: r.gender,
        channel: r.channel,
      }))
    )
    .select('id, sub_brand, wear_type, sub_category, gender, channel');

  if (nrErr || !newRows) {
    console.error('❌  Failed to insert plan rows:', nrErr?.message);
    process.exit(1);
  }
  console.log(`✅  ${newRows.length} plan rows cloned`);

  // Build dim-key → new row id map
  const dimToNewRowId = {};
  for (const r of newRows) {
    dimToNewRowId[`${r.sub_brand}|${r.wear_type}|${r.sub_category}|${r.gender}|${r.channel}`] = r.id;
  }

  // Group source plan data by month per dimension so we can compute next-month NSQ
  // for DoH calculation (same logic as seed-demo-data.js)
  const byDimMonth = {};
  for (const pd of sourcePlanData) {
    const dim = rowDims[pd.row_id];
    if (!dim) continue;
    if (!byDimMonth[dim]) byDimMonth[dim] = [];
    byDimMonth[dim].push(pd);
  }

  // 9. Build revised plan data (+6% uplift on NSQ and inwards)
  const revisedPlanData = [];

  for (const [dim, months] of Object.entries(byDimMonth)) {
    const newRowId = dimToNewRowId[dim];
    if (!newRowId) continue;

    const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));

    for (let mi = 0; mi < sorted.length; mi++) {
      const src = sorted[mi];
      const nextSrc = sorted[mi + 1];

      const newNsq = Math.round((src.nsq || 0) * REVISION_UPLIFT);
      const newInwards = Math.round((src.inwards_qty || 0) * REVISION_UPLIFT);
      const nextNsq = nextSrc ? Math.round((nextSrc.nsq || 0) * REVISION_UPLIFT) : newNsq;

      const d = {
        row_id: newRowId,
        month: src.month,
        asp: src.asp,
        cogs: src.cogs,
        opening_stock_qty: src.opening_stock_qty,
        ly_sales_nsq: src.ly_sales_nsq,
        recent_sales_nsq: src.recent_sales_nsq,
        soft_forecast_nsq: src.soft_forecast_nsq,
        return_pct: src.return_pct,
        tax_pct: src.tax_pct,
        sellex_pct: src.sellex_pct,
        standard_doh: src.standard_doh,
        perf_marketing_pct: src.perf_marketing_pct,
        nsq: newNsq,
        inwards_qty: newInwards,
        _next_nsq: nextNsq,
      };

      Object.assign(d, recomputeDerived(d));
      delete d._next_nsq;
      revisedPlanData.push(d);
    }
  }

  // Insert in chunks
  const CHUNK = 200;
  for (let i = 0; i < revisedPlanData.length; i += CHUNK) {
    const { error } = await supabase.from('otb_plan_data').insert(revisedPlanData.slice(i, i + CHUNK));
    if (error) console.error(`  ⚠  Plan data chunk ${i}: ${error.message}`);
  }
  console.log(`✅  ${revisedPlanData.length} revised plan data records inserted`);

  // 10. Create approval tracking — Planning ✓, GD ✓, Finance pending, CXO pending
  const approvalRecords = [
    {
      cycle_id: revCycleId,
      role: 'Planning',
      user_id: planningId,
      status: 'Approved',
      comment: 'Numbers reviewed. Revision aligns with April demand signals. Approved.',
      decided_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    },
    {
      cycle_id: revCycleId,
      role: 'GD',
      user_id: gdId,
      status: 'Approved',
      comment: 'Bullish on Q1 given strong April performance. Approved.',
      decided_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    },
    {
      cycle_id: revCycleId,
      role: 'Finance',
      user_id: null,
      status: 'Pending',
      comment: null,
      decided_at: null,
    },
    {
      cycle_id: revCycleId,
      role: 'CXO',
      user_id: null,
      status: 'Pending',
      comment: null,
      decided_at: null,
    },
  ];

  for (const r of approvalRecords) {
    const { error } = await supabase.from('approval_tracking').insert(r);
    if (error) console.error(`  ⚠  Approval tracking (${r.role}): ${error.message}`);
  }
  console.log('✅  Approval tracking created (Planning ✓, GD ✓, Finance pending, CXO pending)');

  console.log('\n🎉  Done. Dashboard should now show:');
  console.log(`    Pending Review (1): "${REVISION_CYCLE_NAME}" — 2/4 roles approved`);
  console.log(`    Approved Plans: "${SOURCE_CYCLE_NAME}" — fully approved`);
  console.log('\n    Run: node scripts/seed-q1-revision-cycle.js to reset at any time.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
