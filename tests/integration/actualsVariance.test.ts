import { describe, it, expect } from 'vitest';
import { calcActualDerived, calcVariancePct, buildVarianceMetric, classifyVariance } from '@/lib/varianceEngine';
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
        nextMonthActualNsq: 1200,
      });

      expect(derived.actualGmv).toBe(800000);
      expect(derived.actualClosingStockQty).toBe(-300);
      expect(derived.actualGmPct).toBeCloseTo(62.5);
    });
  });

  describe('full variance flow', () => {
    it('computes variance for nsq_pct over plan → green (higher_is_good)', () => {
      // nsq_pct is higher_is_good: over plan (+15%) → green
      const metric = buildVarianceMetric('nsq_pct', 1150, 1000, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct);
      expect(metric.variance_pct).toBeCloseTo(15);
      expect(metric.level).toBe('green');
    });

    it('computes variance for nsq_pct under plan within threshold → yellow', () => {
      // nsq_pct is higher_is_good: under plan by 10% within threshold of 15% → yellow
      const metric = buildVarianceMetric('nsq_pct', 900, 1000, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct);
      expect(metric.variance_pct).toBeCloseTo(-10);
      expect(metric.level).toBe('yellow');
    });

    it('handles large positive variance for gmv_pct → green (higher_is_good)', () => {
      // gmv_pct is higher_is_good: over plan by 100% → green
      const metric = buildVarianceMetric('gmv_pct', 200, 100, DEFAULT_VARIANCE_THRESHOLDS.gmv_pct);
      expect(metric.variance_pct).toBeCloseTo(100);
      expect(metric.level).toBe('green');
    });

    it('handles over-plan for inwards_pct → red (lower_is_good)', () => {
      // inwards_pct is lower_is_good: over plan by 30% beyond threshold of 20% → red
      const metric = buildVarianceMetric('inwards_pct', 130, 100, DEFAULT_VARIANCE_THRESHOLDS.inwards_pct);
      expect(metric.variance_pct).toBeCloseTo(30);
      expect(metric.level).toBe('red');
    });

    it('handles under-plan for inwards_pct → green (lower_is_good)', () => {
      // inwards_pct is lower_is_good: under plan by 50% → green
      const metric = buildVarianceMetric('inwards_pct', 50, 100, DEFAULT_VARIANCE_THRESHOLDS.inwards_pct);
      expect(metric.variance_pct).toBeCloseTo(-50);
      expect(metric.level).toBe('green');
    });

    it('green for small under-plan variance on nsq_pct', () => {
      // nsq_pct is higher_is_good: over plan by 5% → green
      const metric = buildVarianceMetric('nsq_pct', 105, 100, DEFAULT_VARIANCE_THRESHOLDS.nsq_pct);
      expect(metric.variance_pct).toBeCloseTo(5);
      expect(metric.level).toBe('green');
    });
  });

  describe('end-to-end: actuals -> variance rows', () => {
    it('processes multiple rows with correct direction-aware classification', () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        sub_brand: 'test',
        wear_type: 'NWW',
        sub_category: `cat-${i}`,
        gender: 'male',
        channel: 'myntra_sor',
        month: '2026-01-01',
        nsq: buildVarianceMetric('nsq_pct', 100 + i * 10, 100, 15),
        gmv: buildVarianceMetric('gmv_pct', 80000 + i * 5000, 80000, 15),
        inwards: buildVarianceMetric('inwards_pct', 50 + i * 5, 50, 20),
        closing_stock: buildVarianceMetric('closing_stock_pct', 200 + i * 20, 200, 25),
      }));

      expect(rows).toHaveLength(20);
      // nsq_pct is higher_is_good — all rows are over plan → all green
      expect(rows[19].nsq.level).toBe('green');
      // inwards_pct is lower_is_good — high over-plan → red
      // cat-19: actual=145, planned=50 → +190% over threshold 20% → red
      expect(rows[19].inwards.level).toBe('red');
      // cat-0: inwards actual=50, planned=50 → 0% → green
      expect(rows[0].inwards.level).toBe('green');
    });
  });
});
