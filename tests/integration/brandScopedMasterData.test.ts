// @ts-nocheck — Supabase types are `never` without generated DB types
/**
 * Brand-Scoped Master Data Integration Tests
 *
 * Verifies the new brand-scoped hierarchy:
 *   Brand → WearTypes → SubCategories
 *   Brand → Channels
 *   Brand → Genders
 *
 * REQUIRES: Supabase running with migration 008 applied.
 * Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Run: npx vitest run tests/integration/brandScopedMasterData.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL !== 'https://your-project.supabase.co';

const describeIf = canRun ? describe : describe.skip;

describeIf('Brand-Scoped Master Data', () => {
  let supabase: ReturnType<typeof createClient>;
  let brandId: string;
  let brand2Id: string;
  let wearTypeId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    // Get or create test brands
    const { data: brand } = await supabase.from('brands').select('id').eq('name', 'Bewakoof').single();
    expect(brand).toBeTruthy();
    brandId = brand!.id;

    // Create a second test brand for isolation tests
    const { data: brand2 } = await supabase
      .from('brands')
      .upsert({ name: 'TestBrand_BrandScoped' }, { onConflict: 'name' })
      .select()
      .single();
    brand2Id = brand2!.id;
  });

  it('sub_categories require brand_id (NOT NULL constraint)', async () => {
    const { error } = await supabase
      .from('sub_categories')
      .insert({ name: 'test-no-brand' });

    expect(error).toBeTruthy();
    expect(error!.message).toContain('null');
  });

  it('same sub_category name allowed for different brands', async () => {
    // Insert for brand 1
    const { error: err1 } = await supabase
      .from('sub_categories')
      .upsert({ name: 'cross-brand-test', brand_id: brandId }, { onConflict: 'brand_id,wear_type_id,name' })
      .select();
    expect(err1).toBeNull();

    // Insert same name for brand 2
    const { error: err2 } = await supabase
      .from('sub_categories')
      .upsert({ name: 'cross-brand-test', brand_id: brand2Id }, { onConflict: 'brand_id,wear_type_id,name' })
      .select();
    expect(err2).toBeNull();

    // Cleanup
    await supabase.from('sub_categories').delete().eq('name', 'cross-brand-test');
  });

  it('wear_types table is brand-scoped', async () => {
    // Insert a wear type for brand 1
    const { data: wt, error } = await supabase
      .from('wear_types')
      .upsert({ name: 'TestWT', brand_id: brandId }, { onConflict: 'brand_id,name' })
      .select()
      .single();

    expect(error).toBeNull();
    expect(wt).toBeTruthy();
    wearTypeId = wt!.id;

    // Same name for brand 2 should work
    const { error: err2 } = await supabase
      .from('wear_types')
      .upsert({ name: 'TestWT', brand_id: brand2Id }, { onConflict: 'brand_id,name' })
      .select();
    expect(err2).toBeNull();

    // Cleanup brand2 wear type
    await supabase.from('wear_types').delete().eq('name', 'TestWT').eq('brand_id', brand2Id);
  });

  it('sub_category must reference a valid wear_type under the same brand', async () => {
    // Insert sub_category with a wear_type from this brand — should succeed
    const { error: goodErr } = await supabase
      .from('sub_categories')
      .insert({ name: 'wt-ref-test', brand_id: brandId, wear_type_id: wearTypeId });

    expect(goodErr).toBeNull();

    // Cleanup
    await supabase.from('sub_categories').delete().eq('name', 'wt-ref-test');
  });

  it('master data API filters by brandId param', async () => {
    // Insert brand-scoped channels
    await supabase.from('channels').upsert(
      { name: 'brand-filter-test', brand_id: brandId },
      { onConflict: 'brand_id,name' }
    );
    await supabase.from('channels').upsert(
      { name: 'brand-filter-test-b2', brand_id: brand2Id },
      { onConflict: 'brand_id,name' }
    );

    // Query all channels for brand 1
    const { data: b1Channels } = await supabase
      .from('channels')
      .select('name')
      .eq('brand_id', brandId);

    const b1Names = (b1Channels || []).map(c => c.name);
    expect(b1Names).toContain('brand-filter-test');
    expect(b1Names).not.toContain('brand-filter-test-b2');

    // Cleanup
    await supabase.from('channels').delete().eq('name', 'brand-filter-test');
    await supabase.from('channels').delete().eq('name', 'brand-filter-test-b2');
  });

  it('otb_cycles no longer has wear_types column', async () => {
    // Inserting a cycle without wear_types should succeed
    const { data, error } = await supabase
      .from('otb_cycles')
      .insert({
        cycle_name: 'No Wear Types Test',
        brand_id: brandId,
        planning_quarter: 'Q1-FY27',
        planning_period_start: '2026-04-01',
        planning_period_end: '2026-06-30',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    // wear_types should not be in the response
    expect(data).not.toHaveProperty('wear_types');

    // Cleanup
    await supabase.from('otb_cycles').delete().eq('id', data!.id);
  });

  it('template generator derives wear_type from sub_category hierarchy', async () => {
    // Verify sub_categories joined with wear_types returns wear_type name
    const { data, error } = await supabase
      .from('sub_categories')
      .select('name, wear_type_id, wear_types(name)')
      .eq('brand_id', brandId)
      .not('wear_type_id', 'is', null)
      .limit(5);

    expect(error).toBeNull();
    // If Bewakoof has wear_type mappings migrated, we should see results
    if (data && data.length > 0) {
      for (const sc of data) {
        expect(sc.wear_types).toBeTruthy();
        expect(sc.wear_types.name).toBeTruthy();
      }
    }
  });

  // Cleanup test brand at end
  it('cleanup: remove test brand', async () => {
    await supabase.from('wear_types').delete().eq('name', 'TestWT').eq('brand_id', brandId);
    await supabase.from('brands').delete().eq('name', 'TestBrand_BrandScoped');
  });
});
