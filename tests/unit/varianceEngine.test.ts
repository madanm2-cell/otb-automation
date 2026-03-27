import { describe, it, expect } from 'vitest';
import {
  calcVariancePct,
  classifyVariance,
  buildVarianceMetric,
  calcActualDerived,
  getTopVariances,
} from '@/lib/varianceEngine';
import type { VarianceRow } from '@/types/otb';

describe('calcVariancePct', () => {
  it('returns percentage variance', () => {
    expect(calcVariancePct(115, 100)).toBeCloseTo(15);
  });
  it('returns negative variance', () => {
    expect(calcVariancePct(85, 100)).toBeCloseTo(-15);
  });
  it('returns null when planned is 0', () => {
    expect(calcVariancePct(10, 0)).toBeNull();
  });
  it('returns null when planned is null', () => {
    expect(calcVariancePct(10, null)).toBeNull();
  });
  it('returns null when actual is null', () => {
    expect(calcVariancePct(null, 100)).toBeNull();
  });
});

describe('classifyVariance', () => {
  it('green when within threshold', () => {
    expect(classifyVariance(10, 15)).toBe('green');
  });
  it('yellow when at threshold boundary', () => {
    expect(classifyVariance(15, 15)).toBe('yellow');
  });
  it('red when exceeds threshold', () => {
    expect(classifyVariance(20, 15)).toBe('red');
  });
  it('handles negative variance', () => {
    expect(classifyVariance(-20, 15)).toBe('red');
  });
  it('green when variance is null', () => {
    expect(classifyVariance(null, 15)).toBe('green');
  });
});

describe('buildVarianceMetric', () => {
  it('builds a complete variance metric', () => {
    const result = buildVarianceMetric('NSQ', 115, 100, 15);
    expect(result.metric).toBe('NSQ');
    expect(result.planned).toBe(100);
    expect(result.actual).toBe(115);
    expect(result.variance_pct).toBeCloseTo(15);
    expect(result.level).toBe('yellow');
  });
});

describe('calcActualDerived', () => {
  it('calculates actual GMV from actual NSQ and ASP', () => {
    const result = calcActualDerived({
      actualNsq: 100,
      actualInwardsQty: 50,
      asp: 500,
      cogs: 200,
      openingStockQty: 80,
      returnPct: 10,
      taxPct: 5,
      sellexPct: 8,
      nextMonthActualNsq: 120,
    });
    expect(result.actualGmv).toBe(50000);
    expect(result.actualClosingStockQty).toBe(30);
    expect(result.actualGmPct).toBeCloseTo(60);
  });

  it('returns nulls when inputs are null', () => {
    const result = calcActualDerived({
      actualNsq: null,
      actualInwardsQty: null,
      asp: null,
      cogs: null,
      openingStockQty: null,
      returnPct: null,
      taxPct: null,
      sellexPct: null,
      nextMonthActualNsq: null,
    });
    expect(result.actualGmv).toBeNull();
    expect(result.actualNsv).toBeNull();
  });
});

describe('getTopVariances', () => {
  it('returns top N rows by max absolute variance', () => {
    const rows: VarianceRow[] = [
      makeVarianceRow('A', 50),
      makeVarianceRow('B', 10),
      makeVarianceRow('C', 30),
    ];
    const top = getTopVariances(rows, 2);
    expect(top).toHaveLength(2);
    expect(top[0].sub_category).toBe('A');
    expect(top[1].sub_category).toBe('C');
  });
});

function makeVarianceRow(subCat: string, variancePct: number): VarianceRow {
  const metric = {
    metric: 'NSQ',
    planned: 100,
    actual: 100 + variancePct,
    variance_pct: variancePct,
    level: 'red' as const,
  };
  return {
    sub_brand: 'test',
    wear_type: 'NWW',
    sub_category: subCat,
    gender: 'male',
    channel: 'myntra_sor',
    month: '2026-01-01',
    nsq: metric,
    gmv: { ...metric, metric: 'GMV' },
    inwards: { ...metric, metric: 'Inwards', variance_pct: 0, level: 'green' },
    closing_stock: { ...metric, metric: 'Closing Stock', variance_pct: 0, level: 'green' },
  };
}
