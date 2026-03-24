import { describe, it, expect } from 'vitest';
import {
  getRiskFlags,
  getHighestRiskLevel,
  CycleMetrics,
  RiskFlag,
} from '@/lib/riskIndicators';

describe('getRiskFlags', () => {
  const safeMetrics: CycleMetrics = {
    avgDoh: 45,
    gmPct: 0.35,
    categoryAvgGmPct: 0.30,
    totalInwardsQty: 1000,
    lyTotalInwardsQty: 900,
  };

  it('returns no flags when all metrics are within thresholds', () => {
    const flags = getRiskFlags(safeMetrics);
    expect(flags).toEqual([]);
  });

  it('returns yellow flag when DoH > 60', () => {
    const flags = getRiskFlags({ ...safeMetrics, avgDoh: 75 });
    expect(flags).toHaveLength(1);
    expect(flags[0].level).toBe('yellow');
    expect(flags[0].metric).toBe('doh');
    expect(flags[0].message).toContain('75');
    expect(flags[0].message).toContain('60');
  });

  it('returns red flag when GM% < category average', () => {
    const flags = getRiskFlags({
      ...safeMetrics,
      gmPct: 0.20,
      categoryAvgGmPct: 0.30,
    });
    expect(flags).toHaveLength(1);
    expect(flags[0].level).toBe('red');
    expect(flags[0].metric).toBe('gm_pct');
    expect(flags[0].message).toContain('20.0%');
    expect(flags[0].message).toContain('30.0%');
  });

  it('returns yellow flag when inwards growth > 25%', () => {
    const flags = getRiskFlags({
      ...safeMetrics,
      totalInwardsQty: 1500,
      lyTotalInwardsQty: 1000,
    });
    expect(flags).toHaveLength(1);
    expect(flags[0].level).toBe('yellow');
    expect(flags[0].metric).toBe('inwards_growth');
    expect(flags[0].message).toContain('50.0%');
    expect(flags[0].message).toContain('25%');
  });

  it('returns multiple flags when multiple thresholds exceeded', () => {
    const flags = getRiskFlags({
      avgDoh: 90,
      gmPct: 0.15,
      categoryAvgGmPct: 0.30,
      totalInwardsQty: 2000,
      lyTotalInwardsQty: 1000,
    });
    expect(flags).toHaveLength(3);
    const metrics = flags.map(f => f.metric);
    expect(metrics).toContain('doh');
    expect(metrics).toContain('gm_pct');
    expect(metrics).toContain('inwards_growth');
  });

  it('handles null values gracefully (no flags)', () => {
    const flags = getRiskFlags({
      avgDoh: null,
      gmPct: null,
      categoryAvgGmPct: null,
      totalInwardsQty: null,
      lyTotalInwardsQty: null,
    });
    expect(flags).toEqual([]);
  });

  it('handles zero LY inwards without division by zero', () => {
    const flags = getRiskFlags({
      ...safeMetrics,
      totalInwardsQty: 5000,
      lyTotalInwardsQty: 0,
    });
    // Should not produce an inwards_growth flag (division by zero guard)
    const inwardsFlag = flags.find(f => f.metric === 'inwards_growth');
    expect(inwardsFlag).toBeUndefined();
  });
});

describe('getHighestRiskLevel', () => {
  it('returns null for empty flags', () => {
    expect(getHighestRiskLevel([])).toBeNull();
  });

  it("returns 'red' when any red flag is present", () => {
    const flags: RiskFlag[] = [
      { level: 'yellow', metric: 'doh', message: 'DoH warning' },
      { level: 'red', metric: 'gm_pct', message: 'GM% below average' },
    ];
    expect(getHighestRiskLevel(flags)).toBe('red');
  });

  it("returns 'yellow' when only yellow flags are present", () => {
    const flags: RiskFlag[] = [
      { level: 'yellow', metric: 'doh', message: 'DoH warning' },
      { level: 'yellow', metric: 'inwards_growth', message: 'Inwards warning' },
    ];
    expect(getHighestRiskLevel(flags)).toBe('yellow');
  });
});
