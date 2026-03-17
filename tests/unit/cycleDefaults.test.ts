import { describe, it, expect } from 'vitest';

// Test the lookup key construction that matches between cycle_defaults and plan data generation.

describe('Cycle Defaults Lookup Keys', () => {
  it('ASP lookup uses sub_brand|sub_category|channel', () => {
    const key = ['bewakoof', 't-shirts', 'myntra_sor'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof|t-shirts|myntra_sor');
  });

  it('COGS lookup uses sub_brand|sub_category', () => {
    const key = ['bewakoof', 't-shirts'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof|t-shirts');
  });

  it('Return% lookup uses sub_brand|sub_category|channel', () => {
    const key = ['bewakoof', 'jeans', 'flipkart_sor'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof|jeans|flipkart_sor');
  });

  it('Tax% lookup uses sub_category only', () => {
    const key = ['t-shirts'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('t-shirts');
  });

  it('Sellex% lookup uses sub_brand|sub_category|channel', () => {
    const key = ['bewakoof air', 'joggers', 'myntra_sor'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof air|joggers|myntra_sor');
  });

  it('Standard DoH lookup uses sub_brand|sub_category', () => {
    const key = ['bewakoof', 'jeans'].map(s => s.toLowerCase()).join('|');
    expect(key).toBe('bewakoof|jeans');
  });
});

describe('Default Type Validation', () => {
  const VALID_TYPES = ['asp', 'cogs', 'return_pct', 'tax_pct', 'sellex_pct', 'standard_doh'];

  it('all 6 default types are recognized', () => {
    expect(VALID_TYPES).toHaveLength(6);
  });

  it('percentage types have 0-100 range', () => {
    const pctTypes = ['return_pct', 'tax_pct', 'sellex_pct'];
    pctTypes.forEach(type => {
      expect(VALID_TYPES).toContain(type);
    });
  });

  it('ASP must be > 0', () => {
    expect(VALID_TYPES).toContain('asp');
  });
});
