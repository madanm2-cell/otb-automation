import { describe, it, expect } from 'vitest';
import {
  calcSalesPlanGmv, calcGolyPct, calcNsv, calcInwardsValCogs,
  calcOpeningStockVal, calcClosingStockQty, calcFwd30dayDoh,
  calcGmPct, calcGrossMargin, calcCm1Pct, calcCm2Pct, calculateAll,
} from '../../src/lib/formulaEngine';

describe('Formula Engine — 11-step chain (PRD 5.2)', () => {
  // Step 1: GMV = NSQ × ASP
  it('step 1: salesPlanGmv = 1000 × 849.50 = 849500', () => {
    expect(calcSalesPlanGmv(1000, 849.50)).toBe(849500);
  });
  it('step 1: returns null when NSQ is null', () => {
    expect(calcSalesPlanGmv(null, 849.50)).toBeNull();
  });
  it('step 1: returns 0 when NSQ is 0', () => {
    expect(calcSalesPlanGmv(0, 849.50)).toBe(0);
  });

  // Step 2: GOLY% = ((NSQ / LY_NSQ) - 1) × 100
  it('step 2: golyPct = ((1000/800)-1)×100 = 25%', () => {
    expect(calcGolyPct(1000, 800)).toBeCloseTo(25, 1);
  });
  it('step 2: returns null when LY is 0', () => {
    expect(calcGolyPct(1000, 0)).toBeNull();
  });
  it('step 2: returns null when LY is null', () => {
    expect(calcGolyPct(1000, null)).toBeNull();
  });

  // Step 3: NSV = GMV × (1 - Return%) × (1 - Tax%)
  // 849500 × 0.745 × 0.88 = 556932.20
  it('step 3: nsv = 849500 × (1-0.255) × (1-0.12) = 556932.20', () => {
    expect(calcNsv(849500, 25.5, 12)).toBeCloseTo(556932.20, 0);
  });

  // Step 4: Inwards Val = Inwards Qty × COGS
  it('step 4: inwardsValCogs = 500 × 350 = 175000', () => {
    expect(calcInwardsValCogs(500, 350)).toBe(175000);
  });

  // Step 5: Opening Stock Val = Opening Stock Qty × COGS
  it('step 5: openingStockVal = 15420 × 350 = 5397000', () => {
    expect(calcOpeningStockVal(15420, 350)).toBe(5397000);
  });

  // Step 6: Closing Stock = Opening + Inwards - NSQ
  it('step 6: closingStockQty = 15420 + 500 - 1000 = 14920', () => {
    expect(calcClosingStockQty(15420, 500, 1000)).toBe(14920);
  });
  it('step 6: can go negative (validation catches this)', () => {
    expect(calcClosingStockQty(100, 50, 200)).toBe(-50);
  });

  // Step 7: Fwd DoH = Closing / (NextMonthNSQ / 30)
  it('step 7: fwd30dayDoh = 14920 / (1200/30) = 373', () => {
    expect(calcFwd30dayDoh(14920, 1200)).toBeCloseTo(373, 0);
  });
  it('step 7: returns null when next month NSQ is 0', () => {
    expect(calcFwd30dayDoh(14920, 0)).toBeNull();
  });
  it('step 7: returns null when next month NSQ is null (last month)', () => {
    expect(calcFwd30dayDoh(14920, null)).toBeNull();
  });

  // Step 8: GM% = (ASP - COGS) / ASP × 100
  it('step 8: gmPct = (849.50-350)/849.50×100 = 58.80%', () => {
    expect(calcGmPct(849.50, 350)).toBeCloseTo(58.80, 1);
  });
  it('step 8: returns null when ASP is 0', () => {
    expect(calcGmPct(0, 350)).toBeNull();
  });

  // Step 9: Gross Margin = NSV × GM%
  it('step 9: grossMargin = 556940.70 × 0.588 = ~327481', () => {
    expect(calcGrossMargin(556940.70, 58.80)).toBeCloseTo(327481.13, 0);
  });

  // Step 10: CM1% = GM% - Sellex%
  it('step 10: cm1Pct = 58.80 - 8 = 50.80%', () => {
    expect(calcCm1Pct(58.80, 8)).toBeCloseTo(50.80, 1);
  });

  // Step 11: CM2% = CM1% - Perf Mktg%
  it('step 11: cm2Pct = 50.80 - 5 = 45.80%', () => {
    expect(calcCm2Pct(50.80, 5)).toBeCloseTo(45.80, 1);
  });

  // Full chain
  it('calculateAll: computes entire chain from inputs', () => {
    const result = calculateAll({
      nsq: 1000, inwardsQty: 500, perfMarketingPct: 5,
      asp: 849.50, cogs: 350, openingStockQty: 15420,
      lySalesNsq: 800, returnPct: 25.5, taxPct: 12,
      sellexPct: 8, nextMonthNsq: 1200,
    });
    expect(result.salesPlanGmv).toBe(849500);
    expect(result.golyPct).toBeCloseTo(25, 1);
    expect(result.closingStockQty).toBe(14920);
    expect(result.gmPct).toBeCloseTo(58.80, 1);
    expect(result.cm1).toBeCloseTo(50.80, 1);  // CM1% = GM% - Sellex% = 58.80 - 8
    expect(result.cm2).toBeCloseTo(45.80, 1);  // CM2% = CM1% - Perf Mktg% = 50.80 - 5
  });

  // Edge: all nulls
  it('calculateAll: handles all-null inputs gracefully', () => {
    const result = calculateAll({
      nsq: null, inwardsQty: null, perfMarketingPct: null,
      asp: null, cogs: null, openingStockQty: null,
      lySalesNsq: null, returnPct: null, taxPct: null,
      sellexPct: null, nextMonthNsq: null,
    });
    expect(result.salesPlanGmv).toBeNull();
    expect(result.nsv).toBeNull();
    expect(result.cm2).toBeNull();
  });
});
