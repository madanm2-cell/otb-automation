import { describe, it, expect } from 'vitest';
import type {
  EnhancedBrandSummary,
  BrandMonthBreakdown,
  CategoryBreakdown,
  DashboardSummaryResponse,
} from '@/types/otb';

describe('Dashboard types', () => {
  it('EnhancedBrandSummary has required shape', () => {
    const brand: EnhancedBrandSummary = {
      brand_id: 'b1',
      brand_name: 'Bewakoof',
      cycle_id: 'c1',
      cycle_name: 'Q1 FY27',
      status: 'Approved',
      planning_quarter: 'Q1 FY27',
      gmv: 100000,
      nsv: 80000,
      nsq: 5000,
      inwards_qty: 3000,
      avg_doh: 45,
      closing_stock_qty: 2000,
      monthly: [
        { month: '2026-04-01', gmv: 33000, nsv: 26000, nsq: 1600, inwards_qty: 1000, closing_stock_qty: 700, avg_doh: 44 },
      ],
      top_categories: [
        { sub_category: 'T-Shirts', gmv: 50000, nsq: 2500, pct_of_total: 50 },
      ],
    };
    expect(brand.brand_id).toBe('b1');
    expect(brand.monthly).toHaveLength(1);
    expect(brand.top_categories).toHaveLength(1);
  });

  it('DashboardSummaryResponse has required shape', () => {
    const resp: DashboardSummaryResponse = {
      kpiTotals: { gmv: 0, nsv: 0, nsq: 0, inwards_qty: 0, avg_doh: 0, closing_stock_qty: 0 },
      brands: [],
      months: [],
    };
    expect(resp.kpiTotals).toBeDefined();
    expect(resp.brands).toEqual([]);
  });
});
