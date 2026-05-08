import { describe, it, expect } from 'vitest';
import { classifyVariance, buildVarianceMetric, calcVariancePct } from '../../src/lib/varianceEngine';

describe('calcVariancePct', () => {
  it('returns null when actual is null', () => {
    expect(calcVariancePct(null, 100)).toBeNull();
  });
  it('returns null when planned is null', () => {
    expect(calcVariancePct(100, null)).toBeNull();
  });
  it('returns null when planned is 0', () => {
    expect(calcVariancePct(100, 0)).toBeNull();
  });
  it('computes positive variance correctly', () => {
    expect(calcVariancePct(110, 100)).toBeCloseTo(10);
  });
  it('computes negative variance correctly', () => {
    expect(calcVariancePct(90, 100)).toBeCloseTo(-10);
  });
});

describe('classifyVariance — higher_is_good (GMV, NSV, NSQ)', () => {
  it('over plan → green regardless of magnitude', () => {
    expect(classifyVariance(50, 15, 'higher_is_good')).toBe('green');
  });
  it('zero variance → green', () => {
    expect(classifyVariance(0, 15, 'higher_is_good')).toBe('green');
  });
  it('under plan within threshold → yellow', () => {
    expect(classifyVariance(-10, 15, 'higher_is_good')).toBe('yellow');
  });
  it('under plan exactly at threshold → yellow', () => {
    expect(classifyVariance(-15, 15, 'higher_is_good')).toBe('yellow');
  });
  it('under plan beyond threshold → red', () => {
    expect(classifyVariance(-20, 15, 'higher_is_good')).toBe('red');
  });
  it('null variance → green', () => {
    expect(classifyVariance(null, 15, 'higher_is_good')).toBe('green');
  });
});

describe('classifyVariance — lower_is_good (Inwards, Closing Stock, DOH)', () => {
  it('under plan → green regardless of magnitude', () => {
    expect(classifyVariance(-30, 20, 'lower_is_good')).toBe('green');
  });
  it('zero variance → green', () => {
    expect(classifyVariance(0, 20, 'lower_is_good')).toBe('green');
  });
  it('over plan within threshold → yellow', () => {
    expect(classifyVariance(10, 20, 'lower_is_good')).toBe('yellow');
  });
  it('over plan exactly at threshold → yellow', () => {
    expect(classifyVariance(20, 20, 'lower_is_good')).toBe('yellow');
  });
  it('over plan beyond threshold → red', () => {
    expect(classifyVariance(30, 20, 'lower_is_good')).toBe('red');
  });
});

describe('classifyVariance — default direction is higher_is_good', () => {
  it('uses higher_is_good when direction omitted (over plan → green)', () => {
    expect(classifyVariance(5, 15)).toBe('green');
  });
  it('uses higher_is_good when direction omitted (under beyond → red)', () => {
    expect(classifyVariance(-20, 15)).toBe('red');
  });
});

describe('buildVarianceMetric', () => {
  it('uses METRIC_DIRECTIONS for classification', () => {
    // inwards_pct is lower_is_good: over plan should be red
    const metric = buildVarianceMetric('inwards_pct', 130, 100, 20);
    expect(metric.variance_pct).toBeCloseTo(30);
    expect(metric.level).toBe('red');
  });
  it('gmv_pct over plan → green', () => {
    const metric = buildVarianceMetric('gmv_pct', 110, 100, 15);
    expect(metric.level).toBe('green');
  });
  it('gmv_pct under beyond threshold → red', () => {
    const metric = buildVarianceMetric('gmv_pct', 80, 100, 15);
    expect(metric.level).toBe('red');
  });
});
