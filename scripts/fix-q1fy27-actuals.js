'use strict';

/**
 * Fix Q1 FY27 actuals for Bewakoof:
 *  1. Delete stale Jan-2026 actuals (wrong months loaded into Q1 FY27 cycle)
 *  2. Rewrite Apr-Jun 2026 actuals so variance vs plan is realistic (±5-12%)
 *
 * Run:  node scripts/fix-q1fy27-actuals.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CYCLE_ID = 'dbf5fc73-7e86-4256-9425-9a5feafcd89e'; // Bewakoof Q1 FY 27

function round2(n) { return Math.round(n * 100) / 100; }

// Seeded pseudo-random to get deterministic but varied output per dimension.
function seededRand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x); // 0..1
}

// Hash a string to a stable integer seed.
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Per-dimension bias: some combos consistently over/under perform vs plan.
// Skewed negative (avg ≈ -6%) so the quarter shows realistic mild underperformance.
// Range [-20%, +8%] → produces a mix of RED / YELLOW / GREEN rows after threshold.
function dimBias(sub_brand, sub_category, gender, channel) {
  const key = `${sub_brand}|${sub_category}|${gender}|${channel}`;
  const r = seededRand(hashStr(key));
  // Map [0,1] → [-0.20, +0.08]
  return 1 + (r * 0.28 - 0.20);
}

// Per-month noise on top of the dimension bias. Range ±5%.
function monthNoise(sub_brand, sub_category, gender, channel, month) {
  const key = `${sub_brand}|${sub_category}|${gender}|${channel}|${month}`;
  const r = seededRand(hashStr(key + '_m'));
  return 1 + (r * 0.10 - 0.05);
}

// Inwards variance — independently seeded, range [-18%, +10%].
// Inwards can deviate more than NSQ as supply-side mismatches are common.
function inwardsVariance(sub_brand, sub_category, gender, channel, month) {
  const key = `${sub_brand}|${sub_category}|${gender}|${channel}|${month}`;
  const r = seededRand(hashStr(key + '_inv'));
  return 1 + (r * 0.28 - 0.18);
}

async function main() {
  console.log('Connecting to Supabase:', process.env.NEXT_PUBLIC_SUPABASE_URL);

  // 1. Delete stale Jan-2026 actuals
  const { error: delErr, count: delCount } = await supabase
    .from('otb_actuals')
    .delete({ count: 'exact' })
    .eq('cycle_id', CYCLE_ID)
    .lt('month', '2026-04-01');

  if (delErr) { console.error('Delete error:', delErr.message); process.exit(1); }
  console.log(`Deleted ${delCount} stale Jan-2026 actuals`);

  // 2. Fetch plan rows
  const { data: rows, error: rowErr } = await supabase
    .from('otb_plan_rows')
    .select('id, sub_brand, wear_type, sub_category, gender, channel')
    .eq('cycle_id', CYCLE_ID);

  if (rowErr) { console.error(rowErr.message); process.exit(1); }
  const rowMap = Object.fromEntries(rows.map(r => [r.id, r]));
  const rowIds = rows.map(r => r.id);

  // 3. Fetch plan data for Apr-Jun
  const { data: planData, error: pdErr } = await supabase
    .from('otb_plan_data')
    .select('row_id, month, asp, cogs, opening_stock_qty, nsq, inwards_qty, return_pct, tax_pct, sellex_pct, perf_marketing_pct')
    .in('row_id', rowIds)
    .gte('month', '2026-04-01')
    .lte('month', '2026-06-30')
    .order('month');

  if (pdErr) { console.error(pdErr.message); process.exit(1); }
  console.log(`Fetched ${planData.length} plan data records`);

  // Group plan data by dimension key → sorted months array (for next-month DoH lookup)
  const byDim = {};
  for (const pd of planData) {
    const r = rowMap[pd.row_id];
    const key = `${r.sub_brand}|${r.wear_type}|${r.sub_category}|${r.gender}|${r.channel}`;
    if (!byDim[key]) byDim[key] = [];
    byDim[key].push({ ...pd, ...r });
  }
  for (const k of Object.keys(byDim)) {
    byDim[k].sort((a, b) => a.month.localeCompare(b.month));
  }

  // 4. Build updated actuals
  const updates = [];
  for (const [, months] of Object.entries(byDim)) {
    for (let mi = 0; mi < months.length; mi++) {
      const pd = months[mi];
      const nextPd = months[mi + 1];

      const planNsq = pd.nsq || 0;
      const planInwards = pd.inwards_qty || 0;
      const asp = pd.asp || 0;
      const cogs = pd.cogs || 0;
      const opening = pd.opening_stock_qty || 0;
      const returnPct = pd.return_pct || 0;
      const taxPct = pd.tax_pct || 0;
      const sellex = pd.sellex_pct;
      const perfMktg = pd.perf_marketing_pct;

      const nsqFactor = dimBias(pd.sub_brand, pd.sub_category, pd.gender, pd.channel)
                      * monthNoise(pd.sub_brand, pd.sub_category, pd.gender, pd.channel, pd.month);
      const invFactor = inwardsVariance(pd.sub_brand, pd.sub_category, pd.gender, pd.channel, pd.month);

      const actualNsq = Math.max(1, Math.round(planNsq * nsqFactor));
      const actualInwards = planInwards > 0 ? Math.max(0, Math.round(planInwards * invFactor)) : 0;

      const actualGmv = round2(actualNsq * asp);
      const actualNsv = round2(actualGmv * (1 - returnPct / 100) * (1 - taxPct / 100));
      const actualClosingStock = opening + actualInwards - actualNsq;
      const gmPct = asp > 0 ? round2(((asp - cogs) / asp) * 100) : null;

      // Forward DoH: closing stock / next month's actual NSQ * 30
      const nextNsq = nextPd
        ? Math.max(1, Math.round((nextPd.nsq || 0) *
            dimBias(nextPd.sub_brand, nextPd.sub_category, nextPd.gender, nextPd.channel) *
            monthNoise(nextPd.sub_brand, nextPd.sub_category, nextPd.gender, nextPd.channel, nextPd.month)))
        : actualNsq;
      const actualDoh = nextNsq > 0 ? round2((actualClosingStock * 30) / nextNsq) : null;

      const actualCm1 = gmPct != null && sellex != null ? round2(gmPct - sellex) : null;
      const actualCm2 = actualCm1 != null && perfMktg != null ? round2(actualCm1 - perfMktg) : null;

      updates.push({
        cycle_id: CYCLE_ID,
        sub_brand: pd.sub_brand,
        wear_type: pd.wear_type,
        sub_category: pd.sub_category,
        gender: pd.gender,
        channel: pd.channel,
        month: pd.month,
        actual_nsq: actualNsq,
        actual_inwards_qty: actualInwards,
        actual_gmv: actualGmv,
        actual_nsv: actualNsv,
        actual_closing_stock_qty: actualClosingStock,
        actual_doh: actualDoh,
        actual_gm_pct: gmPct,
        actual_cm1: actualCm1,
        actual_cm2: actualCm2,
      });
    }
  }

  // Preview variance range
  const samplePairs = planData.slice(0, 5).map(pd => {
    const r = rowMap[pd.row_id];
    const upd = updates.find(u =>
      u.sub_brand === r.sub_brand && u.sub_category === r.sub_category &&
      u.gender === r.gender && u.channel === r.channel && u.month === pd.month
    );
    const varPct = pd.nsq > 0 ? Math.round(((upd.actual_nsq - pd.nsq) / pd.nsq) * 100) : null;
    return `${r.sub_category} ${r.gender} ${r.channel} ${pd.month.slice(0,7)}: plan=${pd.nsq} actual=${upd?.actual_nsq} var=${varPct}%`;
  });
  console.log('\nSample variance preview:');
  samplePairs.forEach(s => console.log(' ', s));

  // 5. Delete all existing Apr-Jun actuals, then insert fresh correct ones
  const { error: delAprJunErr } = await supabase
    .from('otb_actuals')
    .delete()
    .eq('cycle_id', CYCLE_ID)
    .gte('month', '2026-04-01')
    .lte('month', '2026-06-30');
  if (delAprJunErr) { console.error('Delete Apr-Jun actuals error:', delAprJunErr.message); process.exit(1); }
  console.log('Deleted existing Apr-Jun actuals');

  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const { error } = await supabase.from('otb_actuals').insert(chunk);
    if (error) { console.error(`Chunk ${i} error:`, error.message); }
    else inserted += chunk.length;
  }

  console.log(`\nInserted ${inserted} actuals with realistic variance (±5-12% of plan)`);
  console.log('Done.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
