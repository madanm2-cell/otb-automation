import { describe, it, expect } from 'vitest';
import { calcActualDerived, calcVariancePct, buildVarianceMetric, classifyVariance, getTopVariances } from '@/lib/varianceEngine';
import { DEFAULT_VARIANCE_THRESHOLDS } from '@/types/otb';

describe('Actuals & Variance Integration', () => {
  describe('full actuals recalculation flow', () => {
    it('calculates all derived metrics from actuals', () => {
      const derived = calcActualDerived({
        actualNsq: 1000,
        actualInwardsQty: 500,
        asp: 800,
        cogs: 300,
        openingStockQty: 200,
        returnPct: 15,
        taxPct: 5,
        sellexPct: 10,
        nextMonthActualNsq: 1200,
      });

      expect(derived.actualGmv).toBe(800000);
      expect(derived.actualClosingStockQty).toBe(-300);
      expect(derived.actualGmPct).toBeCloseTo(62.5);
    });
  });

  describe('full variance flow', () => {
    it('computes variance and classifies correctly', () => {
      const metric = buildVarianceMetric('NSQ', 1150, 1000, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct);
      expect(metric.variance_pct).toBeCloseTo(15);
      expect(metric.level).toBe('yellow');
    });

    it('handles large positive variance as red', () => {
      const metric = buildVarianceMetric('GMV', 200, 100, DEFAULT_VARIANCE_THRESHOLDS.gmv_pct);
      expect(metric.variance_pct).toBeCloseTo(100);
      expect(metric.level).toBe('red');
    });

    it('handles negative variance correctly', () => {
      const metric = buildVarianceMetric('Inwards', 50, 100, DEFAULT_VARIANCE_THRESHOLDS.inwards_pct);
      expect(metric.variance_pct).toBeCloseTo(-50);
      expect(metric.level).toBe('red');
    });

    it('green for small variance', () => {
      const metric = buildVarianceMetric('NSQ', 105, 100, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct);
      expect(metric.variance_pct).toBeCloseTo(5);
      expect(metric.level).toBe('green');
    });
  });

  describe('end-to-end: actuals -> variance -> top 10', () => {
    it('processes multiple rows and selects top variances', () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        sub_brand: 'test',
        wear_type: 'NWW',
        sub_category: `cat-${i}`,
        gender: 'male',
        channel: 'myntra_sor',
        month: '2026-01-01',
        nsq: buildVarianceMetric('NSQ', 100 + i * 10, 100, 15),
        gmv: buildVarianceMetric('GMV', 80000 + i * 5000, 80000, 15),
        inwards: buildVarianceMetric('Inwards', 50 + i * 5, 50, 20),
        closing_stock: buildVarianceMetric('Closing Stock', 200 + i * 20, 200, 25),
      }));

      const top = getTopVariances(rows, 10);
      expect(top).toHaveLength(10);
      expect(top[0].sub_category).toBe('cat-19');
    });
  });
});
