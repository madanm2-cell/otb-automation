import { describe, it, expect } from 'vitest';
import { validateUpload, MasterDataContext } from '../../src/lib/uploadValidator';

const masterData: MasterDataContext = {
  subBrands: new Set(['bewakoof', 'bewakoof air']),
  subCategories: new Set(['t-shirts', 'jeans', 'hoodies']),
  channels: new Set(['amazon_cocoblu', 'flipkart_sor', 'myntra_sor', 'offline', 'others']),
  genders: new Set(['male', 'female', 'unisex']),
  mappings: new Map([
    ['sub_brand:bob', 'bewakoof'],
    ['sub_brand:BOB', 'bewakoof'],
    ['channel:unicommerce', 'others'],
    ['channel:website', 'others'],
  ]),
};

describe('Upload Validator (V-001 to V-007)', () => {
  it('valid opening_stock data passes', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', quantity: 1500 },
    ];
    const result = validateUpload('opening_stock', rows, masterData);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('V-001: negative quantity fails', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', quantity: -10 },
    ];
    const result = validateUpload('opening_stock', rows, masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-001')).toBe(true);
  });

  it('V-003: unknown sub_brand fails, but mapping resolves it', () => {
    // "bob" should map to "bewakoof" via ly_sales (still an upload type)
    const rows = [
      { sub_brand: 'bob', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', month: '2025-01-01', nsq: 100 },
    ];
    const result = validateUpload('ly_sales', rows, masterData);
    expect(result.valid).toBe(true);
    expect(result.normalizedRows[0].sub_brand).toBe('bewakoof');
  });

  it('V-003: truly unknown sub_brand fails', () => {
    const rows = [
      { sub_brand: 'unknown_brand', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', month: '2025-01-01', nsq: 100 },
    ];
    const result = validateUpload('ly_sales', rows, masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-003' && e.field === 'sub_brand')).toBe(true);
  });

  it('V-005: missing required column fails', () => {
    const rows = [
      { sub_brand: 'bewakoof', quantity: 100 },  // missing sub_category, gender, channel
    ];
    const result = validateUpload('opening_stock', rows, masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-005')).toBe(true);
  });

  it('V-006: duplicate dimension combos are aggregated (summed)', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', quantity: 100 },
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', quantity: 200 },
    ];
    const result = validateUpload('opening_stock', rows, masterData);
    expect(result.valid).toBe(true);
    expect(result.normalizedRows).toHaveLength(1); // Aggregated into 1 row
    expect(result.normalizedRows[0].quantity).toBe(300); // 100 + 200
  });

  it('V-007: empty file fails', () => {
    const result = validateUpload('opening_stock', [], masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-007')).toBe(true);
  });

  it('channel mapping: unicommerce → others (recent_sales)', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'unicommerce', month: '2025-10-01', nsq: 100 },
    ];
    const result = validateUpload('recent_sales', rows, masterData);
    expect(result.valid).toBe(true);
    expect(result.normalizedRows[0].channel).toBe('others');
  });

  it('valid soft_forecast passes', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', nsq: 1100 },
    ];
    const result = validateUpload('soft_forecast', rows, masterData);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('actuals validation', () => {
  const actMasterData: MasterDataContext = {
    subBrands: new Set(['bewakoof']),
    subCategories: new Set(['t-shirts']),
    channels: new Set(['myntra_sor']),
    genders: new Set(['male']),
    mappings: new Map(),
  };

  it('validates valid actuals rows', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 't-shirts', gender: 'male', channel: 'myntra_sor', month: '2026-01-01', actual_nsq: '100', actual_inwards_qty: '50' },
    ];
    const result = validateUpload('actuals', rows, actMasterData);
    expect(result.valid).toBe(true);
    expect(result.normalizedRows).toHaveLength(1);
  });

  it('rejects negative actual_nsq', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 't-shirts', gender: 'male', channel: 'myntra_sor', month: '2026-01-01', actual_nsq: '-5', actual_inwards_qty: '50' },
    ];
    const result = validateUpload('actuals', rows, actMasterData);
    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('V-001');
  });
});
