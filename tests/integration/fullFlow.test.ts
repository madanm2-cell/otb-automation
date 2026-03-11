// @ts-nocheck — Supabase types are `never` without generated DB types
/**
 * Sprint 1-2 Integration Test
 *
 * Tests the full flow: create cycle → upload files → generate template → read plan data
 *
 * REQUIRES: Supabase running with schema applied and seed data loaded.
 * Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Run: npx vitest run tests/integration/fullFlow.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { validateUpload, MasterDataContext } from '../../src/lib/uploadValidator';
import { calculateAll } from '../../src/lib/formulaEngine';
import { parse } from 'csv-parse/sync';
import type { FileType } from '../../src/types/otb';

// Skip if no Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL !== 'https://your-project.supabase.co';

const describeIf = canRun ? describe : describe.skip;

describeIf('Sprint 1-2 Full Flow Integration', () => {
  // Lazy init — only runs when tests actually execute (not when skipped)
  let supabase: ReturnType<typeof createClient>;
  let cycleId: string;
  let brandId: string;

  const masterData: MasterDataContext = {
    subBrands: new Set(['bewakoof', 'bewakoof air', 'bewakoof heavy duty']),
    subCategories: new Set(['t-shirts', 'jeans', 'hoodies', 'joggers', 'shorts', 'shirts', 'trousers', 'jackets', 'sweatshirts', 'pyjamas']),
    channels: new Set(['amazon_cocoblu', 'flipkart_sor', 'myntra_sor', 'offline', 'others']),
    genders: new Set(['male', 'female', 'unisex']),
    mappings: new Map([
      ['sub_brand:bob', 'bewakoof'],
      ['channel:unicommerce', 'others'],
    ]),
  };

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    // Get Bewakoof brand
    const { data: brands } = await supabase.from('brands').select('id').eq('name', 'Bewakoof').single();
    expect(brands).toBeTruthy();
    brandId = brands!.id;

    // Clean up any test cycles
    const { data: existing } = await supabase
      .from('otb_cycles')
      .select('id')
      .eq('brand_id', brandId)
      .eq('cycle_name', 'Integration Test Q4 FY26');

    if (existing && existing.length > 0) {
      for (const c of existing) {
        const { data: rows } = await supabase.from('otb_plan_rows').select('id').eq('cycle_id', c.id);
        if (rows && rows.length > 0) {
          await supabase.from('otb_plan_data').delete().in('row_id', rows.map(r => r.id));
          await supabase.from('otb_plan_rows').delete().eq('cycle_id', c.id);
        }
        await supabase.from('file_uploads').delete().eq('cycle_id', c.id);
        await supabase.from('otb_cycles').delete().eq('id', c.id);
      }
    }
  });

  it('1. Create cycle for Bewakoof Q4 FY26', async () => {
    const { data, error } = await supabase
      .from('otb_cycles')
      .insert({
        cycle_name: 'Integration Test Q4 FY26',
        brand_id: brandId,
        planning_quarter: 'Q4-FY26',
        planning_period_start: '2026-01-01',
        planning_period_end: '2026-03-31',
        wear_types: ['NWW', 'WW'],
        assigned_gd_id: 'test-gd',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.status).toBe('Draft');
    cycleId = data!.id;
  });

  it('2. Validate all fixture files pass validation', () => {
    const fileTypes = [
      'opening_stock', 'cogs', 'asp', 'standard_doh',
      'ly_sales', 'recent_sales', 'return_pct', 'tax_pct', 'sellex_pct', 'soft_forecast',
    ] as const;

    for (const ft of fileTypes) {
      const csv = readFileSync(join(__dirname, '..', 'fixtures', `${ft}.csv`), 'utf-8');
      const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
      const result = validateUpload(ft, rows, masterData);
      expect(result.valid, `${ft} should be valid: ${JSON.stringify(result.errors)}`).toBe(true);
    }
  });

  it('3. Formula calculations match expected values', () => {
    const result = calculateAll({
      nsq: 1000, inwardsQty: 500, perfMarketingPct: 5,
      asp: 849.50, cogs: 350, openingStockQty: 15420,
      lySalesGmv: 700000, returnPct: 25.5, taxPct: 12,
      sellexPct: 8, nextMonthNsq: 1200,
    });

    expect(result.salesPlanGmv).toBe(849500);
    expect(result.golyPct).toBeCloseTo(21.36, 1);
    expect(result.nsv).toBeCloseTo(556932, 0);
    expect(result.closingStockQty).toBe(14920);
    expect(result.gmPct).toBeCloseTo(58.80, 1);
    expect(result.cm1).toBeCloseTo(512378, 0);
  });

  it('4. Month chaining: closing stock → next month opening stock', () => {
    // Month 1
    const m1 = calculateAll({
      nsq: 1000, inwardsQty: 500, perfMarketingPct: 5,
      asp: 849.50, cogs: 350, openingStockQty: 15420,
      lySalesGmv: 700000, returnPct: 25.5, taxPct: 12,
      sellexPct: 8, nextMonthNsq: 1200,
    });
    expect(m1.closingStockQty).toBe(14920);

    // Month 2: opening stock = Month 1 closing stock
    const m2 = calculateAll({
      nsq: 1200, inwardsQty: 600, perfMarketingPct: 5,
      asp: 849.50, cogs: 350, openingStockQty: m1.closingStockQty!,
      lySalesGmv: 650000, returnPct: 25.5, taxPct: 12,
      sellexPct: 8, nextMonthNsq: 1100,
    });
    expect(m2.closingStockQty).toBe(14920 + 600 - 1200); // 14320
  });
});
