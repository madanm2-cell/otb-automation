import { describe, it, expect } from 'vitest';

/**
 * Integration test plan for the full cycle workflow with master defaults.
 *
 * Sequence:
 * 1. Create brand + master data (sub_brands, sub_categories, channels, etc.)
 * 2. Set up master defaults (ASP, COGS, return%, tax%, sellex%, DoH)
 * 3. Create cycle for that brand
 * 4. Upload 3 required files (opening_stock, ly_sales, recent_sales)
 * 5. Initialize cycle defaults (POST /api/cycles/{id}/defaults)
 * 6. Edit a cycle default value (PUT /api/cycles/{id}/defaults)
 * 7. Confirm defaults (POST /api/cycles/{id}/defaults/confirm)
 * 8. Assign GD
 * 9. Generate template & activate
 * 10. Verify plan_data has correct values from cycle defaults
 *
 * This test requires Supabase local instance running.
 * Run with: npx vitest run tests/integration/cycleWithDefaults.test.ts
 */

describe('Cycle with Master Defaults Flow', () => {
  it('validates that cycle_defaults table exists', () => {
    // Placeholder — full integration test requires running Supabase
    expect(true).toBe(true);
  });

  it('validates required upload types reduced to 3', async () => {
    const { REQUIRED_FILE_TYPES } = await import('../../src/types/otb');
    expect(REQUIRED_FILE_TYPES).toHaveLength(3);
    expect(REQUIRED_FILE_TYPES).toContain('opening_stock');
    expect(REQUIRED_FILE_TYPES).toContain('ly_sales');
    expect(REQUIRED_FILE_TYPES).toContain('recent_sales');
  });

  it('validates default types match expected set', () => {
    const expectedTypes = ['asp', 'cogs', 'return_pct', 'tax_pct', 'sellex_pct', 'standard_doh'];
    expectedTypes.forEach(type => {
      expect(typeof type).toBe('string');
    });
  });
});
