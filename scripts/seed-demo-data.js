'use strict';

/**
 * Seed script for demo data — populates the remote Supabase with realistic
 * OTB planning data so screenshots can be taken with enriched content.
 *
 * Run:  node scripts/seed-demo-data.js
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function round2(n) { return Math.round(n * 100) / 100; }

// 11-step formula engine (matches src/lib/formulaEngine.ts)
function computeDerived(d, nextMonthNsq) {
  const asp = d.asp || 0;
  const cogs = d.cogs || 0;
  const nsq = d.nsq || 0;
  const inwardsQty = d.inwards_qty || 0;
  const openingStockQty = d.opening_stock_qty || 0;
  const lyNsq = d.ly_sales_nsq || 0;
  const returnPct = d.return_pct || 0;
  const taxPct = d.tax_pct || 0;
  const sellexPct = d.sellex_pct || 0;
  const perfMktgPct = d.perf_marketing_pct || 0;

  const salesPlanGmv = round2(nsq * asp);
  const golyPct = lyNsq > 0 ? round2(((nsq / lyNsq) - 1) * 100) : null;
  const nsv = round2(salesPlanGmv * (1 - returnPct / 100) * (1 - taxPct / 100));
  const inwardsValCogs = round2(inwardsQty * cogs);
  const openingStockVal = round2(openingStockQty * cogs);
  const closingStockQty = openingStockQty + inwardsQty - nsq;
  const nextNsq = nextMonthNsq || nsq;
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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔧  Connecting to Supabase:', supabaseUrl);

  // ── 1. Fetch existing brands ──────────────────────────────────────────────
  const { data: brands, error: bErr } = await supabase.from('brands').select('*');
  if (bErr) throw bErr;
  console.log(`✅  ${brands.length} brands found`);

  const brandMap = {};
  brands.forEach(b => { brandMap[b.name] = b.id; });

  // Ensure we have the key brands
  const requiredBrands = ['Bewakoof', 'TIGC', 'Wrogn'];
  for (const bn of requiredBrands) {
    if (!brandMap[bn]) {
      console.error(`❌  Brand "${bn}" not found. Run seed.sql first.`);
      process.exit(1);
    }
  }

  // ── 2. Ensure sub_brands exist for Bewakoof ───────────────────────────────
  const subBrandNames = ['bewakoof', 'bewakoof air', 'bewakoof heavy duty'];
  const { data: existingSb } = await supabase.from('sub_brands').select('*').eq('brand_id', brandMap['Bewakoof']);
  if (!existingSb || existingSb.length === 0) {
    const { error } = await supabase.from('sub_brands').insert(
      subBrandNames.map(n => ({ name: n, brand_id: brandMap['Bewakoof'] }))
    );
    if (error) console.warn('sub_brands insert:', error.message);
  }
  console.log('✅  Sub-brands OK');

  // ── 3. Create auth users + profiles ────────────────────────────────────────
  const demoUsers = [
    { email: 'admin@bewakoof.com',     full_name: 'Madan Mohan',      role: 'Admin',    assigned_brands: [] },
    { email: 'planning@bewakoof.com',  full_name: 'Priya Sharma',     role: 'Planning', assigned_brands: [] },
    { email: 'gd.bewakoof@bewakoof.com', full_name: 'Rahul Mehta',    role: 'GD',       assigned_brands: [brandMap['Bewakoof']] },
    { email: 'gd.tigc@bewakoof.com',   full_name: 'Anjali Gupta',     role: 'GD',       assigned_brands: [brandMap['TIGC']] },
    { email: 'gd.wrogn@bewakoof.com',  full_name: 'Vikram Singh',     role: 'GD',       assigned_brands: [brandMap['Wrogn']] },
    { email: 'finance@bewakoof.com',   full_name: 'Deepak Reddy',     role: 'Finance',  assigned_brands: [] },
    { email: 'cxo@bewakoof.com',       full_name: 'Arjun Kapoor',     role: 'CXO',      assigned_brands: [] },
    { email: 'readonly@bewakoof.com',  full_name: 'Neha Patel',       role: 'ReadOnly', assigned_brands: [] },
  ];

  const userMap = {}; // email → uuid
  for (const u of demoUsers) {
    // Check if user already exists in profiles
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', u.email)
      .maybeSingle();

    if (existing) {
      userMap[u.email] = existing.id;
      // Update role/brands
      await supabase.from('profiles').update({
        full_name: u.full_name,
        role: u.role,
        assigned_brands: u.assigned_brands,
        is_active: true,
      }).eq('id', existing.id);
      console.log(`  ↺  ${u.email} (existing)`);
    } else {
      // Create auth user (this triggers the profile trigger)
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: 'DemoPassword123!',
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role },
      });
      if (authErr) {
        console.warn(`  ⚠  ${u.email}: ${authErr.message}`);
        // Try to find by email anyway
        const { data: list } = await supabase.auth.admin.listUsers();
        const found = list?.users?.find(x => x.email === u.email);
        if (found) {
          userMap[u.email] = found.id;
          await supabase.from('profiles').upsert({
            id: found.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            assigned_brands: u.assigned_brands,
            is_active: true,
          });
        }
        continue;
      }
      userMap[u.email] = authUser.user.id;
      // Update profile with correct role & brands (trigger may have set defaults)
      await supabase.from('profiles').update({
        full_name: u.full_name,
        role: u.role,
        assigned_brands: u.assigned_brands,
        is_active: true,
      }).eq('id', authUser.user.id);
      console.log(`  ✓  ${u.email} created`);
    }
  }
  console.log(`✅  ${Object.keys(userMap).length} users ready`);

  const adminId = userMap['admin@bewakoof.com'];
  const planningId = userMap['planning@bewakoof.com'];
  const gdBewakoofId = userMap['gd.bewakoof@bewakoof.com'];
  const gdTigcId = userMap['gd.tigc@bewakoof.com'];
  const financeId = userMap['finance@bewakoof.com'];
  const cxoId = userMap['cxo@bewakoof.com'];

  // ── 4. Create OTB cycles in various states ─────────────────────────────────
  const cycleConfigs = [
    {
      cycle_name: 'Bewakoof Q2-FY27 OTB',
      brand: 'Bewakoof',
      quarter: 'Q2-FY27',
      start: '2026-07-01', end: '2026-12-31',
      fill_deadline: '2026-04-15',
      approval_deadline: '2026-04-30',
      status: 'Filling',
      gd: gdBewakoofId,
    },
    {
      cycle_name: 'Bewakoof Q1-FY27 OTB',
      brand: 'Bewakoof',
      quarter: 'Q1-FY27',
      start: '2026-04-01', end: '2026-06-30',
      fill_deadline: '2026-03-10',
      approval_deadline: '2026-03-20',
      status: 'Approved',
      gd: gdBewakoofId,
    },
    {
      cycle_name: 'TIGC Q2-FY27 OTB',
      brand: 'TIGC',
      quarter: 'Q2-FY27',
      start: '2026-07-01', end: '2026-12-31',
      fill_deadline: '2026-04-20',
      approval_deadline: '2026-05-05',
      status: 'InReview',
      gd: gdTigcId,
    },
    {
      cycle_name: 'Wrogn Q2-FY27 OTB',
      brand: 'Wrogn',
      quarter: 'Q2-FY27',
      start: '2026-07-01', end: '2026-12-31',
      fill_deadline: '2026-04-25',
      approval_deadline: '2026-05-10',
      status: 'Draft',
      gd: null,
    },
    {
      cycle_name: 'Bewakoof Q4-FY26 OTB',
      brand: 'Bewakoof',
      quarter: 'Q4-FY26',
      start: '2026-01-01', end: '2026-03-31',
      fill_deadline: '2025-12-10',
      approval_deadline: '2025-12-20',
      status: 'Approved',
      gd: gdBewakoofId,
    },
  ];

  const cycleIds = {};
  for (const cfg of cycleConfigs) {
    // Check if cycle already exists
    const { data: existing } = await supabase
      .from('otb_cycles')
      .select('id')
      .eq('cycle_name', cfg.cycle_name)
      .maybeSingle();

    if (existing) {
      await supabase.from('otb_cycles').update({
        status: cfg.status,
        fill_deadline: cfg.fill_deadline,
        approval_deadline: cfg.approval_deadline,
        assigned_gd_id: cfg.gd,
        defaults_confirmed: cfg.status !== 'Draft',
      }).eq('id', existing.id);
      cycleIds[cfg.cycle_name] = existing.id;
      console.log(`  ↺  Cycle "${cfg.cycle_name}" (existing)`);
    } else {
      const { data, error } = await supabase.from('otb_cycles').insert({
        cycle_name: cfg.cycle_name,
        brand_id: brandMap[cfg.brand],
        planning_quarter: cfg.quarter,
        planning_period_start: cfg.start,
        planning_period_end: cfg.end,
        fill_deadline: cfg.fill_deadline,
        approval_deadline: cfg.approval_deadline,
        assigned_gd_id: cfg.gd,
        status: cfg.status,
        created_by: planningId || adminId,
        defaults_confirmed: cfg.status !== 'Draft',
      }).select('id').single();
      if (error) { console.warn(`  ⚠  Cycle "${cfg.cycle_name}": ${error.message}`); continue; }
      cycleIds[cfg.cycle_name] = data.id;
      console.log(`  ✓  Cycle "${cfg.cycle_name}" created`);
    }
  }
  console.log(`✅  ${Object.keys(cycleIds).length} cycles ready`);

  // ── 5. Create plan rows & data for "Bewakoof Q2-FY27 OTB" (Filling) ──────
  // This is the primary cycle for the OTB grid screenshot

  const fillingCycleId = cycleIds['Bewakoof Q2-FY27 OTB'];
  if (!fillingCycleId) {
    console.error('❌  Cannot find filling cycle');
    process.exit(1);
  }

  // Hierarchy combos for realistic data
  const hierarchyCombos = [
    { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'T-Shirts',    gender: 'Male',   channel: 'myntra_sor' },
    { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'T-Shirts',    gender: 'Female', channel: 'myntra_sor' },
    { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'T-Shirts',    gender: 'Male',   channel: 'flipkart_sor' },
    { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'Jeans',       gender: 'Male',   channel: 'myntra_sor' },
    { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'Jeans',       gender: 'Female', channel: 'myntra_sor' },
    { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'Shorts',      gender: 'Male',   channel: 'myntra_sor' },
    { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'Shirts',      gender: 'Male',   channel: 'flipkart_sor' },
    { sub_brand: 'bewakoof',            wear_type: 'WW',  sub_category: 'Hoodies',     gender: 'Male',   channel: 'myntra_sor' },
    { sub_brand: 'bewakoof',            wear_type: 'WW',  sub_category: 'Joggers',     gender: 'Male',   channel: 'myntra_sor' },
    { sub_brand: 'bewakoof',            wear_type: 'WW',  sub_category: 'Sweatshirts', gender: 'Male',   channel: 'myntra_sor' },
    { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'T-Shirts',    gender: 'Male',   channel: 'myntra_sor' },
    { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'T-Shirts',    gender: 'Female', channel: 'myntra_sor' },
    { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'Shorts',      gender: 'Male',   channel: 'amazon_cocoblu' },
    { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 'Jeans',       gender: 'Male',   channel: 'myntra_sor' },
    { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 'Trousers',    gender: 'Male',   channel: 'myntra_sor' },
    { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 'Jackets',     gender: 'Male',   channel: 'flipkart_sor' },
  ];

  // Plan months: Jul–Dec 2026
  const planMonths = ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'];

  // Category-specific base values for realism
  const catDefaults = {
    'T-Shirts':    { asp: 599,  cogs: 180, baseNsq: 12000, returnPct: 18, taxPct: 5,  sellexPct: 8,  doh: 35, perfMktg: 4 },
    'Jeans':       { asp: 1299, cogs: 420, baseNsq: 6000,  returnPct: 22, taxPct: 12, sellexPct: 12, doh: 45, perfMktg: 5 },
    'Shorts':      { asp: 499,  cogs: 140, baseNsq: 8000,  returnPct: 15, taxPct: 5,  sellexPct: 7,  doh: 30, perfMktg: 3 },
    'Shirts':      { asp: 899,  cogs: 280, baseNsq: 5000,  returnPct: 20, taxPct: 5,  sellexPct: 10, doh: 40, perfMktg: 4.5 },
    'Hoodies':     { asp: 1199, cogs: 380, baseNsq: 3000,  returnPct: 12, taxPct: 12, sellexPct: 9,  doh: 50, perfMktg: 5 },
    'Joggers':     { asp: 799,  cogs: 240, baseNsq: 7000,  returnPct: 16, taxPct: 5,  sellexPct: 8,  doh: 38, perfMktg: 4 },
    'Sweatshirts': { asp: 999,  cogs: 320, baseNsq: 4000,  returnPct: 14, taxPct: 12, sellexPct: 9,  doh: 42, perfMktg: 4.5 },
    'Trousers':    { asp: 1099, cogs: 350, baseNsq: 4500,  returnPct: 20, taxPct: 12, sellexPct: 11, doh: 42, perfMktg: 5 },
    'Jackets':     { asp: 1599, cogs: 520, baseNsq: 2000,  returnPct: 10, taxPct: 12, sellexPct: 10, doh: 55, perfMktg: 6 },
  };

  // Month seasonality multiplier (Jul=1, Aug=0.9, Sep=1.1, Oct=1.3 festival, Nov=1.5 peak, Dec=1.1)
  const seasonality = [1.0, 0.9, 1.1, 1.3, 1.5, 1.1];

  // Channel adjustments
  const channelMult = { 'myntra_sor': 1.0, 'flipkart_sor': 0.7, 'amazon_cocoblu': 0.5, 'Offline': 0.3, 'Others': 0.2 };

  // Delete existing plan data for this cycle
  const { data: existingRows } = await supabase.from('otb_plan_rows').select('id').eq('cycle_id', fillingCycleId);
  if (existingRows && existingRows.length > 0) {
    const rowIds = existingRows.map(r => r.id);
    await supabase.from('otb_plan_data').delete().in('row_id', rowIds);
    await supabase.from('otb_plan_rows').delete().eq('cycle_id', fillingCycleId);
    console.log(`  🗑  Cleared ${existingRows.length} existing plan rows`);
  }

  // Insert plan rows
  const rowInserts = hierarchyCombos.map(c => ({
    cycle_id: fillingCycleId,
    ...c,
  }));

  const { data: insertedRows, error: rowErr } = await supabase
    .from('otb_plan_rows')
    .insert(rowInserts)
    .select('id, sub_brand, wear_type, sub_category, gender, channel');

  if (rowErr) { console.error('Plan rows insert:', rowErr); process.exit(1); }
  console.log(`✅  ${insertedRows.length} plan rows created`);

  // Insert plan data for each row × month
  const planDataInserts = [];
  for (const row of insertedRows) {
    const defaults = catDefaults[row.sub_category] || catDefaults['T-Shirts'];
    const chMult = channelMult[row.channel] || 0.5;
    // Sub-brand adjustment
    const sbMult = row.sub_brand === 'bewakoof' ? 1.0 : row.sub_brand === 'bewakoof air' ? 0.6 : 0.4;
    // Gender adjustment
    const gMult = row.gender === 'Male' ? 1.0 : row.gender === 'Female' ? 0.7 : 0.5;

    let prevClosingStock = null;

    // First pass: compute base NSQ for each month (needed for forward DoH)
    const monthData = planMonths.map((month, mi) => {
      const baseNsq = Math.round(defaults.baseNsq * seasonality[mi] * chMult * sbMult * gMult * (0.85 + Math.random() * 0.3));
      const lyNsq = Math.round(baseNsq * (0.75 + Math.random() * 0.2)); // LY was ~80-95% of planned
      const recentNsq = Math.round(baseNsq * 0.28 * (0.9 + Math.random() * 0.2)); // 3M recent ~28% of monthly
      const openingStock = prevClosingStock !== null ? prevClosingStock : Math.round(baseNsq * (defaults.doh / 30) * (0.8 + Math.random() * 0.4));

      // Suggested inwards: target_doh * next_nsq / 30 + nsq - opening
      const nextNsq = mi < 5 ? Math.round(defaults.baseNsq * seasonality[mi + 1] * chMult * sbMult * gMult) : baseNsq;
      const suggestedInwards = Math.max(0, Math.round((defaults.doh * nextNsq / 30) + baseNsq - openingStock));
      // GD may override slightly
      const inwardsQty = Math.round(suggestedInwards * (0.9 + Math.random() * 0.2));

      const closingStock = openingStock + inwardsQty - baseNsq;
      prevClosingStock = Math.max(0, closingStock);

      return {
        row_id: row.id,
        month,
        asp: defaults.asp + rand(-30, 30),
        cogs: defaults.cogs + rand(-10, 10),
        opening_stock_qty: openingStock,
        ly_sales_nsq: lyNsq,
        recent_sales_nsq: recentNsq,
        soft_forecast_nsq: Math.round(baseNsq * (0.95 + Math.random() * 0.1)),
        return_pct: round2(defaults.returnPct + (Math.random() - 0.5) * 4),
        tax_pct: defaults.taxPct,
        sellex_pct: round2(defaults.sellexPct + (Math.random() - 0.5) * 2),
        standard_doh: defaults.doh,
        nsq: baseNsq,
        inwards_qty: inwardsQty,
        perf_marketing_pct: round2(defaults.perfMktg + (Math.random() - 0.5) * 2),
      };
    });

    // Second pass: compute derived fields with next-month NSQ
    for (let mi = 0; mi < monthData.length; mi++) {
      const d = monthData[mi];
      const nextNsq = mi < monthData.length - 1 ? monthData[mi + 1].nsq : d.nsq;
      const derived = computeDerived(d, nextNsq);
      Object.assign(d, derived);
    }

    planDataInserts.push(...monthData);
  }

  // Batch insert plan data (supabase has a limit, so chunk)
  const chunkSize = 200;
  for (let i = 0; i < planDataInserts.length; i += chunkSize) {
    const chunk = planDataInserts.slice(i, i + chunkSize);
    const { error } = await supabase.from('otb_plan_data').insert(chunk);
    if (error) { console.error(`Plan data chunk ${i}: ${error.message}`); }
  }
  console.log(`✅  ${planDataInserts.length} plan data records inserted (${insertedRows.length} rows × ${planMonths.length} months)`);

  // ── 6. Also seed the Approved Q1-FY27 cycle with data ──────────────────────
  const approvedCycleId = cycleIds['Bewakoof Q1-FY27 OTB'];
  if (approvedCycleId) {
    const approvedMonths = ['2026-04-01', '2026-05-01', '2026-06-01'];
    const approvedCombos = hierarchyCombos.slice(0, 10); // fewer rows for approved cycle

    const { data: existARows } = await supabase.from('otb_plan_rows').select('id').eq('cycle_id', approvedCycleId);
    if (existARows && existARows.length > 0) {
      const rids = existARows.map(r => r.id);
      await supabase.from('otb_plan_data').delete().in('row_id', rids);
      await supabase.from('otb_plan_rows').delete().eq('cycle_id', approvedCycleId);
    }

    const { data: aRows, error: aErr } = await supabase.from('otb_plan_rows').insert(
      approvedCombos.map(c => ({ cycle_id: approvedCycleId, ...c }))
    ).select('id, sub_brand, wear_type, sub_category, gender, channel');

    if (!aErr && aRows) {
      const aData = [];
      for (const row of aRows) {
        const defaults = catDefaults[row.sub_category] || catDefaults['T-Shirts'];
        const chMult = channelMult[row.channel] || 0.5;
        const sbMult = row.sub_brand === 'bewakoof' ? 1.0 : 0.6;
        const gMult = row.gender === 'Male' ? 1.0 : 0.7;
        let prevCS = null;

        for (let mi = 0; mi < approvedMonths.length; mi++) {
          const baseNsq = Math.round(defaults.baseNsq * [1.0, 0.95, 1.05][mi] * chMult * sbMult * gMult * (0.9 + Math.random() * 0.2));
          const openingStock = prevCS !== null ? prevCS : Math.round(baseNsq * defaults.doh / 30);
          const inwardsQty = Math.round(baseNsq * 1.1);
          const closingStock = openingStock + inwardsQty - baseNsq;
          prevCS = Math.max(0, closingStock);

          const d = {
            row_id: row.id,
            month: approvedMonths[mi],
            asp: defaults.asp, cogs: defaults.cogs,
            opening_stock_qty: openingStock,
            ly_sales_nsq: Math.round(baseNsq * 0.85),
            recent_sales_nsq: Math.round(baseNsq * 0.28),
            soft_forecast_nsq: Math.round(baseNsq * 0.98),
            return_pct: defaults.returnPct, tax_pct: defaults.taxPct,
            sellex_pct: defaults.sellexPct, standard_doh: defaults.doh,
            nsq: baseNsq, inwards_qty: inwardsQty,
            perf_marketing_pct: defaults.perfMktg,
          };
          const nextNsq = mi < 2 ? Math.round(defaults.baseNsq * [0.95, 1.05, 1.0][mi + 1] * chMult * sbMult * gMult) : baseNsq;
          Object.assign(d, computeDerived(d, nextNsq));
          aData.push(d);
        }
      }
      const { error: adErr } = await supabase.from('otb_plan_data').insert(aData);
      if (adErr) console.warn('Approved cycle data:', adErr.message);
      else console.log(`✅  ${aData.length} approved cycle data records`);
    }
  }

  // ── 7. Create approval tracking for InReview & Approved cycles ─────────────
  for (const [name, status, records] of [
    ['Bewakoof Q1-FY27 OTB', 'Approved', [
      { role: 'Planning', status: 'Approved', user_id: planningId },
      { role: 'GD',       status: 'Approved', user_id: gdBewakoofId },
      { role: 'Finance',  status: 'Approved', user_id: financeId },
      { role: 'CXO',      status: 'Approved', user_id: cxoId },
    ]],
    ['TIGC Q2-FY27 OTB', 'InReview', [
      { role: 'Planning', status: 'Approved', user_id: planningId },
      { role: 'GD',       status: 'Approved', user_id: gdTigcId },
      { role: 'Finance',  status: 'Pending',  user_id: null },
      { role: 'CXO',      status: 'Pending',  user_id: null },
    ]],
    ['Bewakoof Q4-FY26 OTB', 'Approved', [
      { role: 'Planning', status: 'Approved', user_id: planningId },
      { role: 'GD',       status: 'Approved', user_id: gdBewakoofId },
      { role: 'Finance',  status: 'Approved', user_id: financeId },
      { role: 'CXO',      status: 'Approved', user_id: cxoId },
    ]],
  ]) {
    const cid = cycleIds[name];
    if (!cid) continue;

    // Delete existing
    await supabase.from('approval_tracking').delete().eq('cycle_id', cid);

    for (const r of records) {
      await supabase.from('approval_tracking').insert({
        cycle_id: cid,
        role: r.role,
        user_id: r.user_id,
        status: r.status,
        comment: r.status === 'Approved' ? 'Looks good. Approved.' : null,
        decided_at: r.status !== 'Pending' ? new Date().toISOString() : null,
      });
    }
    console.log(`  ✓  Approval tracking for "${name}"`);
  }

  // ── 8. Create audit logs ────────────────────────────────────────────────────
  const auditActions = [
    { entity_type: 'cycle', action: 'create', user_email: 'planning@bewakoof.com', user_role: 'Planning', details: { cycle_name: 'Bewakoof Q2-FY27 OTB' } },
    { entity_type: 'cycle', action: 'activate', user_email: 'planning@bewakoof.com', user_role: 'Planning', details: { status: 'Active' } },
    { entity_type: 'upload', action: 'upload', user_email: 'finance@bewakoof.com', user_role: 'Finance', details: { file_type: 'opening_stock', rows: 142 } },
    { entity_type: 'upload', action: 'upload', user_email: 'finance@bewakoof.com', user_role: 'Finance', details: { file_type: 'ly_sales', rows: 142 } },
    { entity_type: 'upload', action: 'upload', user_email: 'finance@bewakoof.com', user_role: 'Finance', details: { file_type: 'recent_sales', rows: 142 } },
    { entity_type: 'cycle', action: 'start_filling', user_email: 'planning@bewakoof.com', user_role: 'Planning', details: { status: 'Filling' } },
    { entity_type: 'plan_data', action: 'edit', user_email: 'gd.bewakoof@bewakoof.com', user_role: 'GD', details: { field: 'nsq', sub_category: 'T-Shirts', month: '2026-07-01', old_value: 11500, new_value: 12000 } },
    { entity_type: 'plan_data', action: 'edit', user_email: 'gd.bewakoof@bewakoof.com', user_role: 'GD', details: { field: 'inwards_qty', sub_category: 'Jeans', month: '2026-08-01', old_value: 5800, new_value: 6200 } },
    { entity_type: 'plan_data', action: 'bulk_edit', user_email: 'gd.bewakoof@bewakoof.com', user_role: 'GD', details: { field: 'perf_marketing_pct', rows_affected: 8, value: 4.5 } },
    { entity_type: 'plan_data', action: 'save', user_email: 'gd.bewakoof@bewakoof.com', user_role: 'GD', details: { rows_saved: 16, version: 3 } },
    { entity_type: 'cycle', action: 'submit', user_email: 'gd.bewakoof@bewakoof.com', user_role: 'GD', details: { status: 'InReview' } },
    { entity_type: 'approval', action: 'approve', user_email: 'planning@bewakoof.com', user_role: 'Planning', details: { role: 'Planning', comment: 'Numbers look solid' } },
    { entity_type: 'approval', action: 'approve', user_email: 'finance@bewakoof.com', user_role: 'Finance', details: { role: 'Finance', comment: 'COGS and margins within budget' } },
    { entity_type: 'approval', action: 'approve', user_email: 'cxo@bewakoof.com', user_role: 'CXO', details: { role: 'CXO', comment: 'Approved for Q1' } },
    { entity_type: 'user', action: 'create', user_email: 'admin@bewakoof.com', user_role: 'Admin', details: { email: 'gd.wrogn@bewakoof.com', role: 'GD' } },
    { entity_type: 'master_data', action: 'update', user_email: 'admin@bewakoof.com', user_role: 'Admin', details: { type: 'sub_categories', added: ['Blazers'] } },
  ];

  // Insert audit logs with staggered timestamps
  const now = new Date();
  for (let i = 0; i < auditActions.length; i++) {
    const a = auditActions[i];
    const ts = new Date(now.getTime() - (auditActions.length - i) * 3600000); // 1h apart going back
    await supabase.from('audit_logs').insert({
      entity_type: a.entity_type,
      entity_id: fillingCycleId,
      action: a.action,
      user_id: userMap[a.user_email] || adminId,
      user_email: a.user_email,
      user_role: a.user_role,
      details: a.details,
      created_at: ts.toISOString(),
    });
  }
  console.log(`✅  ${auditActions.length} audit logs created`);

  // ── 9. Create comments on the Filling cycle ─────────────────────────────────
  if (gdBewakoofId && planningId && financeId) {
    await supabase.from('comments').delete().eq('cycle_id', fillingCycleId);

    const comments = [
      { type: 'general', text: 'GD filling in progress for Q2. Please review T-Shirts NSQ — demand seems high for July.', author_id: planningId, author_name: 'Priya Sharma', author_role: 'Planning' },
      { type: 'metric', text: 'Jeans return% on Myntra seems elevated at 22%. Can we validate this with recent actuals?', author_id: financeId, author_name: 'Deepak Reddy', author_role: 'Finance', field: 'return_pct' },
      { type: 'brand', text: 'Bewakoof Air inwards look conservative for festival season (Oct-Nov). Consider increasing by 15-20%.', author_id: cxoId, author_name: 'Arjun Kapoor', author_role: 'CXO' },
      { type: 'general', text: 'Noted. Will revisit Bewakoof Air Oct-Nov inwards. Updating based on soft forecast.', author_id: gdBewakoofId, author_name: 'Rahul Mehta', author_role: 'GD' },
    ];

    for (const c of comments) {
      await supabase.from('comments').insert({
        cycle_id: fillingCycleId,
        comment_type: c.type,
        text: c.text,
        author_id: c.author_id,
        author_name: c.author_name,
        author_role: c.author_role,
        field: c.field || null,
      });
    }
    console.log('✅  4 comments created');
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('\n🎉  Demo data seeded successfully!');
  console.log('\nLogin credentials (all users): DemoPassword123!');
  console.log('Emails:');
  demoUsers.forEach(u => console.log(`  ${u.role.padEnd(10)} ${u.email}`));
  console.log('\nScreenshot targets:');
  console.log('  Admin Dashboard:     /admin/users, /admin/audit-logs, /admin/master-data');
  console.log('  OTB Grid:            /cycles/<filling-cycle-id>/grid');
  console.log('  Approval Dashboard:  /approvals');
  console.log(`  Filling cycle ID:    ${fillingCycleId}`);
}

main().catch(err => { console.error('💥  Fatal:', err); process.exit(1); });
