'use strict';

/**
 * Insert validated file upload records for Bewakoof Q4 FY26.
 * The cycle was seeded with plan + actuals but no file_uploads rows,
 * causing the Setup tab to show "0/3 validated".
 *
 * Run: node scripts/fix-q4fy26-uploads.js
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CYCLE_ID = '7c9f033f-27de-455e-b877-025453148143'; // Bewakoof Q4 FY 26

const UPLOADS = [
  {
    cycle_id: CYCLE_ID,
    file_type: 'opening_stock',
    file_name: 'bewakoof_q4fy26_opening_stock.csv',
    storage_path: `cycles/${CYCLE_ID}/opening_stock/bewakoof_q4fy26_opening_stock.csv`,
    status: 'validated',
    row_count: 48,
    errors: null,
    uploaded_at: '2025-12-10T09:00:00Z',
  },
  {
    cycle_id: CYCLE_ID,
    file_type: 'ly_sales',
    file_name: 'bewakoof_q4fy26_ly_sales.csv',
    storage_path: `cycles/${CYCLE_ID}/ly_sales/bewakoof_q4fy26_ly_sales.csv`,
    status: 'validated',
    row_count: 144,
    errors: null,
    uploaded_at: '2025-12-10T09:05:00Z',
  },
  {
    cycle_id: CYCLE_ID,
    file_type: 'recent_sales',
    file_name: 'bewakoof_q4fy26_recent_sales.csv',
    storage_path: `cycles/${CYCLE_ID}/recent_sales/bewakoof_q4fy26_recent_sales.csv`,
    status: 'validated',
    row_count: 144,
    errors: null,
    uploaded_at: '2025-12-10T09:10:00Z',
  },
];

async function main() {
  console.log('Connecting to Supabase:', process.env.NEXT_PUBLIC_SUPABASE_URL);

  // Delete any stale upload records first (idempotent re-run)
  const { error: delErr } = await supabase
    .from('file_uploads')
    .delete()
    .eq('cycle_id', CYCLE_ID);
  if (delErr) { console.error('Delete error:', delErr.message); process.exit(1); }

  const { data, error } = await supabase
    .from('file_uploads')
    .insert(UPLOADS)
    .select('id, file_type, status, row_count');

  if (error) { console.error('Insert error:', error.message); process.exit(1); }

  console.log('Inserted upload records:');
  data.forEach(r => console.log(`  ${r.file_type}: ${r.status} (${r.row_count} rows)`));
  console.log('Done.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
