'use strict';

/**
 * Cleanup: delete all "Bewakoof Q4 FY 26" cycles (seeded by seed-q4fy26.js).
 * Run: node scripts/delete-q4fy26.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function deleteCycle(cycleId) {
  // Delete plan data first (no cascade from plan_rows)
  const { data: planRows } = await supabase.from('otb_plan_rows').select('id').eq('cycle_id', cycleId);
  const rowIds = (planRows || []).map(r => r.id);
  if (rowIds.length > 0) {
    const { error } = await supabase.from('otb_plan_data').delete().in('row_id', rowIds);
    if (error) throw new Error(`otb_plan_data: ${error.message}`);
  }

  // Delete plan rows explicitly (no cascade from cycle)
  await supabase.from('otb_plan_rows').delete().eq('cycle_id', cycleId);

  // Delete actuals (not cascade-linked via plan_rows)
  await supabase.from('otb_actuals').delete().eq('cycle_id', cycleId);

  // Delete file_uploads
  await supabase.from('file_uploads').delete().eq('cycle_id', cycleId);

  // Delete the cycle — cascades to: cycle_defaults, approval_tracking, comments, version_history
  const { error } = await supabase.from('otb_cycles').delete().eq('id', cycleId);
  if (error) throw new Error(`otb_cycles: ${error.message}`);
  console.log(`  deleted cycle ${cycleId}`);
}

async function main() {
  const { data: brand } = await supabase.from('brands').select('id').eq('name', 'Bewakoof').single();
  if (!brand) { console.error('Bewakoof brand not found'); process.exit(1); }

  const { data: cycles } = await supabase
    .from('otb_cycles')
    .select('id, cycle_name, status')
    .eq('brand_id', brand.id)
    .eq('cycle_name', 'Bewakoof Q4 FY 26');

  if (!cycles || cycles.length === 0) {
    console.log('No Bewakoof Q4 FY 26 cycles found — nothing to delete.');
    return;
  }

  console.log(`Found ${cycles.length} cycle(s) to delete:`);
  for (const c of cycles) {
    console.log(`  ${c.id}  [${c.status}]`);
    await deleteCycle(c.id);
  }
  console.log('Done.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
