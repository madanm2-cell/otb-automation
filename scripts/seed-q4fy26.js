'use strict';

/**
 * Seed script: Bewakoof Q4 FY26 OTB cycle (Jan–Mar 2026)
 *
 * Creates a fully-approved cycle with:
 *  - 48 plan rows (same dimensions as Q1 FY27 for catalog consistency)
 *  - Plan data for Jan, Feb, Mar 2026 with winter-appropriate numbers
 *  - Actuals for all 3 months (~±15% realistic variance vs plan)
 *  - All 4 approval roles: Approved
 *
 * Enables all 4 workspace tabs: Setup · Plan · Review · Analyze
 *
 * Run:  node scripts/seed-q4fy26.js
 * Safe: idempotent — deletes and recreates the Q4 FY26 cycle each run.
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const CYCLE_NAME = 'Bewakoof Q4 FY 26';
const PLAN_MONTHS = ['2026-01-01', '2026-02-01', '2026-03-01'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function round2(n) { return Math.round(n * 100) / 100; }

function seededRand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Per-dimension bias for actuals: skewed negative (avg ≈ -6%), range [-20%, +8%]
function dimBias(sub_brand, sub_category, gender, channel) {
  const r = seededRand(hashStr(`${sub_brand}|${sub_category}|${gender}|${channel}|q4fy26`));
  return 1 + (r * 0.28 - 0.20);
}
// Per-month noise ±5%
function monthNoise(sub_brand, sub_category, gender, channel, month) {
  const r = seededRand(hashStr(`${sub_brand}|${sub_category}|${gender}|${channel}|${month}|q4fy26_m`));
  return 1 + (r * 0.10 - 0.05);
}
// Inwards variance independently ±12%
function inwardsVar(sub_brand, sub_category, gender, channel, month) {
  const r = seededRand(hashStr(`${sub_brand}|${sub_category}|${gender}|${channel}|${month}|q4fy26_inv`));
  return 1 + (r * 0.24 - 0.12);
}

// ── Formula engine (mirrors formulaEngine.ts) ─────────────────────────────

function computeDerived(d, nextMonthNsq) {
  const { asp = 0, cogs = 0, nsq = 0, inwards_qty = 0, opening_stock_qty = 0,
          ly_sales_nsq = 0, return_pct = 0, tax_pct = 0, sellex_pct, perf_marketing_pct } = d;

  const nsv                = round2(nsq * asp);
  const goly_pct           = ly_sales_nsq > 0 ? round2(((nsq / ly_sales_nsq) - 1) * 100) : null;
  const denom              = (1 - return_pct / 100) * (1 - tax_pct / 100);
  const sales_plan_gmv     = denom > 0 ? round2(nsv / denom) : null;
  const inwards_val_cogs   = round2(inwards_qty * cogs);
  const opening_stock_val  = round2(opening_stock_qty * cogs);
  const closing_stock_qty  = opening_stock_qty + inwards_qty - nsq;
  const next               = nextMonthNsq || nsq;
  const fwd_30day_doh      = next > 0 ? round2((closing_stock_qty * 30) / next) : null;
  const gm_pct             = asp > 0 ? round2(((asp - cogs) / asp) * 100) : null;
  const gross_margin       = (nsv > 0 && gm_pct != null) ? round2(nsv * gm_pct / 100) : null;
  const cm1                = (gm_pct != null && sellex_pct != null) ? round2(gm_pct - sellex_pct) : null;
  const cm2                = (cm1 != null && perf_marketing_pct != null) ? round2(cm1 - perf_marketing_pct) : null;

  return { sales_plan_gmv, goly_pct, nsv, inwards_val_cogs, opening_stock_val,
           closing_stock_qty, fwd_30day_doh, gm_pct, gross_margin, cm1, cm2 };
}

// ── Dimensions: exact same 48 rows as Bewakoof Q1 FY27 ───────────────────

const DIMS = [
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'offline'       },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'others'        },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 't-shirts', gender: 'female', channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 't-shirts', gender: 'female', channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 't-shirts', gender: 'female', channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'jeans',    gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'jeans',    gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'jeans',    gender: 'male',   channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'jeans',    gender: 'male',   channel: 'offline'       },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'jeans',    gender: 'female', channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'jeans',    gender: 'female', channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'joggers',  gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'joggers',  gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'joggers',  gender: 'male',   channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'joggers',  gender: 'female', channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'shorts',   gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'shorts',   gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'shorts',   gender: 'male',   channel: 'offline'       },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'shirts',   gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'shirts',   gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'shirts',   gender: 'male',   channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'pyjamas',  gender: 'unisex', channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'pyjamas',  gender: 'unisex', channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'pyjamas',  gender: 'unisex', channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof',            wear_type: 'NWW', sub_category: 'pyjamas',  gender: 'unisex', channel: 'offline'       },
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 't-shirts', gender: 'female', channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 't-shirts', gender: 'female', channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'jeans',    gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'jeans',    gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'jeans',    gender: 'female', channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'joggers',  gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'joggers',  gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'joggers',  gender: 'female', channel: 'offline'       },
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'shorts',   gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'shorts',   gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof air',        wear_type: 'NWW', sub_category: 'shorts',   gender: 'female', channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'amazon_cocoblu'},
  { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 't-shirts', gender: 'male',   channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 'jeans',    gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 'jeans',    gender: 'male',   channel: 'flipkart_sor'  },
  { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 'joggers',  gender: 'male',   channel: 'myntra_sor'    },
  { sub_brand: 'bewakoof heavy duty', wear_type: 'NWW', sub_category: 'joggers',  gender: 'male',   channel: 'amazon_cocoblu'},
];

// ── Category defaults (winter-adjusted for Q4 FY26) ──────────────────────
// Jan-Mar: post-festival clearance + pre-summer prep
// Joggers/Pyjamas peak in winter; Shorts/T-shirts softer than summer peak.

const CAT = {
  't-shirts': { asp: 599,  cogs: 180, baseNsq: 7500,  returnPct: 18, taxPct: 5,  sellex: 28, doh: 35, perfMktg: null },
  'jeans':    { asp: 1299, cogs: 420, baseNsq: 4800,  returnPct: 22, taxPct: 12, sellex: 25, doh: 45, perfMktg: null },
  'joggers':  { asp: 799,  cogs: 240, baseNsq: 5800,  returnPct: 16, taxPct: 5,  sellex: 22, doh: 38, perfMktg: null },
  'shorts':   { asp: 499,  cogs: 140, baseNsq: 2800,  returnPct: 15, taxPct: 5,  sellex: 20, doh: 30, perfMktg: null },
  'shirts':   { asp: 899,  cogs: 280, baseNsq: 4200,  returnPct: 20, taxPct: 5,  sellex: 24, doh: 40, perfMktg: null },
  'pyjamas':  { asp: 599,  cogs: 170, baseNsq: 3800,  returnPct: 12, taxPct: 5,  sellex: 18, doh: 32, perfMktg: null },
};

// Monthly seasonality for Q4 FY26 (Jan=Republic Day boost, Feb=slowest, Mar=pre-summer)
const SEASONALITY = { '2026-01-01': 1.10, '2026-02-01': 0.85, '2026-03-01': 0.95 };

// Sub-brand volume multipliers
const SB_MULT = { 'bewakoof': 1.0, 'bewakoof air': 0.60, 'bewakoof heavy duty': 0.40 };

// Gender multipliers
const G_MULT = { 'male': 1.0, 'female': 0.75, 'unisex': 0.55 };

// Channel multipliers
const CH_MULT = { 'myntra_sor': 1.0, 'amazon_cocoblu': 0.55, 'flipkart_sor': 0.65, 'offline': 0.30, 'others': 0.20 };

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Connecting to', process.env.NEXT_PUBLIC_SUPABASE_URL);

  // 1. Resolve IDs
  const { data: brand } = await supabase.from('brands').select('id').eq('name', 'Bewakoof').single();
  if (!brand) { console.error('Bewakoof brand not found'); process.exit(1); }
  const bewakoofId = brand.id;

  const { data: profiles } = await supabase.from('profiles').select('id, email, role')
    .in('email', ['planning@bewakoof.com', 'gd.bewakoof@bewakoof.com', 'finance@bewakoof.com', 'cxo@bewakoof.com', 'admin@bewakoof.com']);

  const uMap = Object.fromEntries((profiles || []).map(p => [p.email, p.id]));
  const planningId = uMap['planning@bewakoof.com'];
  const gdId       = uMap['gd.bewakoof@bewakoof.com'];
  const financeId  = uMap['finance@bewakoof.com'];
  const cxoId      = uMap['cxo@bewakoof.com'];
  const adminId    = uMap['admin@bewakoof.com'];

  if (!planningId || !gdId || !financeId || !cxoId) {
    console.error('Required users missing — run seed-demo-data.js first');
    process.exit(1);
  }
  console.log('Users resolved');

  // 2. Delete existing Q4 FY26 cycle (idempotent)
  const { data: existing } = await supabase.from('otb_cycles').select('id').eq('cycle_name', CYCLE_NAME).eq('brand_id', bewakoofId).maybeSingle();
  if (existing) {
    // Delete actuals (not cascade-linked to cycle via plan_rows)
    await supabase.from('otb_actuals').delete().eq('cycle_id', existing.id);
    // Cascade via FK handles plan_rows → plan_data, approval_tracking, comments
    await supabase.from('otb_cycles').delete().eq('id', existing.id);
    console.log('Deleted existing Q4 FY26 cycle');
  }

  // 3. Create cycle
  const { data: cycle, error: cycleErr } = await supabase.from('otb_cycles').insert({
    cycle_name:            CYCLE_NAME,
    brand_id:              bewakoofId,
    planning_quarter:      'Q4-FY26',
    planning_period_start: '2026-01-01',
    planning_period_end:   '2026-03-31',
    fill_deadline:         '2025-12-10',
    approval_deadline:     '2025-12-20',
    assigned_gd_id:        gdId,
    status:                'Approved',
    created_by:            adminId || planningId,
    defaults_confirmed:    true,
  }).select('id').single();

  if (cycleErr || !cycle) { console.error('Cycle create failed:', cycleErr?.message); process.exit(1); }
  const cycleId = cycle.id;
  console.log('Cycle created:', cycleId);

  // 4. Insert plan rows
  const { data: planRows, error: rowErr } = await supabase.from('otb_plan_rows')
    .insert(DIMS.map(d => ({ cycle_id: cycleId, ...d })))
    .select('id, sub_brand, wear_type, sub_category, gender, channel');

  if (rowErr || !planRows) { console.error('Plan rows failed:', rowErr?.message); process.exit(1); }
  console.log(`${planRows.length} plan rows created`);

  // 5. Build plan data (3 months × 48 rows)
  // Group rows by dimension for prev-closing-stock carry-forward
  const planDataInserts = [];

  for (const row of planRows) {
    const cat = CAT[row.sub_category] || CAT['t-shirts'];
    const sbMult = SB_MULT[row.sub_brand] ?? 0.4;
    const gMult  = G_MULT[row.gender]     ?? 0.5;
    const chMult = CH_MULT[row.channel]   ?? 0.3;

    let prevClosing = null;

    const monthData = PLAN_MONTHS.map((month, mi) => {
      const seas    = SEASONALITY[month] ?? 1.0;
      // Deterministic per-row jitter so numbers aren't perfectly uniform
      const jitter  = seededRand(hashStr(`${row.sub_brand}|${row.sub_category}|${row.gender}|${row.channel}|${month}|plan`));
      const nsq     = Math.max(1, Math.round(cat.baseNsq * seas * sbMult * gMult * chMult * (0.88 + jitter * 0.24)));
      const lyNsq   = Math.round(nsq * (0.78 + seededRand(hashStr(`${row.id}|${month}|ly`)) * 0.14)); // LY ≈ 78-92% of plan (growth)
      const recentNsq = Math.round(nsq * 0.30 * (0.9 + seededRand(hashStr(`${row.id}|${month}|rec`)) * 0.2));

      const opening = prevClosing !== null
        ? prevClosing
        : Math.round(nsq * (cat.doh / 30) * (0.85 + seededRand(hashStr(`${row.id}|${month}|open`)) * 0.30));

      // Target closing stock = standard_doh * next_month_nsq / 30
      const nextSeas = mi < 2 ? (SEASONALITY[PLAN_MONTHS[mi + 1]] ?? 1.0) : seas;
      const nextNsq  = Math.max(1, Math.round(cat.baseNsq * nextSeas * sbMult * gMult * chMult));
      const targetClosing = Math.round(cat.doh * nextNsq / 30);
      const inwards  = Math.max(0, Math.round(targetClosing + nsq - opening));

      const closing  = opening + inwards - nsq;
      prevClosing    = Math.max(0, closing);

      const d = {
        row_id:            row.id,
        month,
        asp:               cat.asp,
        cogs:              cat.cogs,
        opening_stock_qty: opening,
        ly_sales_nsq:      lyNsq,
        recent_sales_nsq:  recentNsq,
        soft_forecast_nsq: null,
        return_pct:        cat.returnPct,
        tax_pct:           cat.taxPct,
        sellex_pct:        cat.sellex,
        standard_doh:      cat.doh,
        perf_marketing_pct: cat.perfMktg,
        nsq,
        inwards_qty:       inwards,
      };
      return { d, nextNsq: mi < 2 ? null : nsq }; // nextNsq resolved in second pass
    });

    // Second pass: compute derived fields with proper next-month NSQ
    for (let mi = 0; mi < monthData.length; mi++) {
      const { d } = monthData[mi];
      const nextNsq = mi < monthData.length - 1 ? monthData[mi + 1].d.nsq : d.nsq;
      Object.assign(d, computeDerived(d, nextNsq));
      planDataInserts.push(d);
    }
  }

  const CHUNK = 100;
  for (let i = 0; i < planDataInserts.length; i += CHUNK) {
    const { error } = await supabase.from('otb_plan_data').insert(planDataInserts.slice(i, i + CHUNK));
    if (error) console.error(`Plan data chunk ${i}:`, error.message);
  }
  console.log(`${planDataInserts.length} plan data records inserted (${planRows.length} rows × 3 months)`);

  // 6. Build actuals (same dims, realistic ±15% variance vs plan)
  const actualsInserts = [];

  for (const row of planRows) {
    const rowPlanData = planDataInserts.filter(pd => pd.row_id === row.id).sort((a, b) => a.month.localeCompare(b.month));

    for (let mi = 0; mi < rowPlanData.length; mi++) {
      const pd = rowPlanData[mi];
      const nextPd = rowPlanData[mi + 1];

      const nsqFactor = dimBias(row.sub_brand, row.sub_category, row.gender, row.channel)
                      * monthNoise(row.sub_brand, row.sub_category, row.gender, row.channel, pd.month);
      const invFactor = inwardsVar(row.sub_brand, row.sub_category, row.gender, row.channel, pd.month);

      const actualNsq     = Math.max(1, Math.round(pd.nsq * nsqFactor));
      const actualInwards = pd.inwards_qty > 0 ? Math.max(0, Math.round(pd.inwards_qty * invFactor)) : 0;

      const actualNsv          = round2(actualNsq * pd.asp);
      const actualDenom        = (1 - pd.return_pct / 100) * (1 - pd.tax_pct / 100);
      const actualGmv          = actualDenom > 0 ? round2(actualNsv / actualDenom) : null;
      const actualClosingStock  = pd.opening_stock_qty + actualInwards - actualNsq;
      const gmPct              = pd.asp > 0 ? round2(((pd.asp - pd.cogs) / pd.asp) * 100) : null;

      const nextActualNsq = nextPd
        ? Math.max(1, Math.round(nextPd.nsq
            * dimBias(row.sub_brand, row.sub_category, row.gender, row.channel)
            * monthNoise(row.sub_brand, row.sub_category, row.gender, row.channel, nextPd.month)))
        : actualNsq;
      const actualDoh = nextActualNsq > 0 ? round2((actualClosingStock * 30) / nextActualNsq) : null;

      const actualCm1 = gmPct != null && pd.sellex_pct != null ? round2(gmPct - pd.sellex_pct) : null;
      const actualCm2 = actualCm1 != null && pd.perf_marketing_pct != null ? round2(actualCm1 - pd.perf_marketing_pct) : null;

      actualsInserts.push({
        cycle_id:               cycleId,
        sub_brand:              row.sub_brand,
        wear_type:              row.wear_type,
        sub_category:           row.sub_category,
        gender:                 row.gender,
        channel:                row.channel,
        month:                  pd.month,
        actual_nsq:             actualNsq,
        actual_inwards_qty:     actualInwards,
        actual_gmv:             actualGmv,
        actual_nsv:             actualNsv,
        actual_closing_stock_qty: actualClosingStock,
        actual_doh:             actualDoh,
        actual_gm_pct:          gmPct,
        actual_cm1:             actualCm1,
        actual_cm2:             actualCm2,
        uploaded_by:            planningId,
      });
    }
  }

  for (let i = 0; i < actualsInserts.length; i += CHUNK) {
    const { error } = await supabase.from('otb_actuals').insert(actualsInserts.slice(i, i + CHUNK));
    if (error) console.error(`Actuals chunk ${i}:`, error.message);
  }
  console.log(`${actualsInserts.length} actuals inserted (${planRows.length} rows × 3 months)`);

  // Quick variance summary
  let green = 0, yellow = 0, red = 0;
  for (const act of actualsInserts) {
    const plan = planDataInserts.find(p => p.row_id === act.row_id && p.month === act.month);
    if (!plan || !plan.nsq) continue;
    const v = ((act.actual_nsq - plan.nsq) / plan.nsq) * 100;
    if (v >= 0) green++; else if (Math.abs(v) <= 15) yellow++; else red++;
  }
  console.log(`NSQ RAG preview — On Track: ${green}  At Risk: ${yellow}  Behind Plan: ${red}`);

  // 7. Approval tracking — all 4 roles approved
  const approvalDates = [
    new Date('2025-12-18T10:00:00Z'),
    new Date('2025-12-19T09:30:00Z'),
    new Date('2025-12-19T14:00:00Z'),
    new Date('2025-12-20T11:00:00Z'),
  ];
  const approvals = [
    { role: 'Planning', user_id: planningId, comment: 'Plan reviewed. Numbers align with seasonal forecasts. Approved.' },
    { role: 'GD',       user_id: gdId,       comment: 'Q4 inputs confirmed. Winter range targets look achievable. Approved.' },
    { role: 'Finance',  user_id: financeId,  comment: 'Margins and COGS within budget. Finance approval granted.' },
    { role: 'CXO',      user_id: cxoId,      comment: 'Q4 FY26 plan approved. Monitoring actuals monthly.' },
  ];

  for (let i = 0; i < approvals.length; i++) {
    const { error } = await supabase.from('approval_tracking').insert({
      cycle_id:   cycleId,
      role:       approvals[i].role,
      user_id:    approvals[i].user_id,
      status:     'Approved',
      comment:    approvals[i].comment,
      decided_at: approvalDates[i].toISOString(),
    });
    if (error) console.error(`Approval (${approvals[i].role}):`, error.message);
  }
  console.log('Approval tracking: all 4 roles approved');

  console.log(`\nDone. Cycle ID: ${cycleId}`);
  console.log(`Navigate to: /cycles/${cycleId}`);
  console.log('All 4 tabs enabled: Setup · Plan · Review · Analyze');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
