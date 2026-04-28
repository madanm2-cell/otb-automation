import { describe, it, expect } from 'vitest';
import { hasPermission } from '@/lib/auth/roles';

describe('Brand-scoped permissions', () => {
  it('Admin has view_cross_brand_summary', () => {
    expect(hasPermission('Admin', 'view_cross_brand_summary')).toBe(true);
  });

  it('Planning does NOT have view_cross_brand_summary', () => {
    expect(hasPermission('Planning', 'view_cross_brand_summary')).toBe(false);
  });

  it('Finance does NOT have view_cross_brand_summary', () => {
    expect(hasPermission('Finance', 'view_cross_brand_summary')).toBe(false);
  });

  it('CXO does NOT have view_cross_brand_summary', () => {
    expect(hasPermission('CXO', 'view_cross_brand_summary')).toBe(false);
  });

  it('GD does NOT have view_cross_brand_summary', () => {
    expect(hasPermission('GD', 'view_cross_brand_summary')).toBe(false);
  });
});
