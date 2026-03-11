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

  it('V-002: percentage > 100 fails', () => {
    const rows = [
      { sub_category: 'T-Shirts', channel: 'myntra_sor', return_pct: 150 },
    ];
    const result = validateUpload('return_pct', rows, masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-002')).toBe(true);
  });

  it('V-002: percentage within 0-100 passes', () => {
    const rows = [
      { sub_category: 'T-Shirts', channel: 'myntra_sor', return_pct: 25.5 },
    ];
    const result = validateUpload('return_pct', rows, masterData);
    expect(result.valid).toBe(true);
  });

  it('V-003: unknown sub_brand fails, but mapping resolves it', () => {
    // "bob" should map to "bewakoof"
    const rows = [
      { sub_brand: 'bob', sub_category: 'T-Shirts', cogs: 350 },
    ];
    const result = validateUpload('cogs', rows, masterData);
    expect(result.valid).toBe(true);
    expect(result.normalizedRows[0].sub_brand).toBe('bewakoof');
  });

  it('V-003: truly unknown sub_brand fails', () => {
    const rows = [
      { sub_brand: 'unknown_brand', sub_category: 'T-Shirts', cogs: 350 },
    ];
    const result = validateUpload('cogs', rows, masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-003' && e.field === 'sub_brand')).toBe(true);
  });

  it('V-004: ASP = 0 fails', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', channel: 'myntra_sor', asp: 0 },
    ];
    const result = validateUpload('asp', rows, masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-004')).toBe(true);
  });

  it('V-004: positive ASP passes', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', channel: 'myntra_sor', asp: 849.50 },
    ];
    const result = validateUpload('asp', rows, masterData);
    expect(result.valid).toBe(true);
  });

  it('V-005: missing required column fails', () => {
    const rows = [
      { sub_brand: 'bewakoof', quantity: 100 },  // missing sub_category, gender, channel
    ];
    const result = validateUpload('opening_stock', rows, masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-005')).toBe(true);
  });

  it('V-006: duplicate dimension combo fails', () => {
    const rows = [
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', quantity: 100 },
      { sub_brand: 'bewakoof', sub_category: 'T-Shirts', gender: 'Male', channel: 'myntra_sor', quantity: 200 },
    ];
    const result = validateUpload('opening_stock', rows, masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-006')).toBe(true);
  });

  it('V-007: empty file fails', () => {
    const result = validateUpload('opening_stock', [], masterData);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.rule === 'V-007')).toBe(true);
  });

  it('channel mapping: unicommerce → others', () => {
    const rows = [
      { sub_category: 'T-Shirts', channel: 'unicommerce', return_pct: 20 },
    ];
    const result = validateUpload('return_pct', rows, masterData);
    expect(result.valid).toBe(true);
    expect(result.normalizedRows[0].channel).toBe('others');
  });
});
