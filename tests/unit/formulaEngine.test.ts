import { describe, it, expect } from 'vitest';
import {
  calcSalesPlanGmv, calcGolyPct, calcNsv, calcInwardsValCogs,
  calcOpeningStockVal, calcClosingStockQty, calcFwd30dayDoh,
  calcGmPct, calcGrossMargin, calculateAll,
  calcSuggestedInwards,
} from '../../src/lib/formulaEngine';

describe('Formula Engine — 9-step chain (GM only)', () => {
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

  // Full chain
  it('calculateAll: computes entire 9-step chain from inputs', () => {
    const result = calculateAll({
      nsq: 1000, inwardsQty: 500,
      asp: 849.50, cogs: 350, openingStockQty: 15420,
      lySalesNsq: 800, returnPct: 25.5, taxPct: 12,
      nextMonthNsq: 1200,
    });
    expect(result.salesPlanGmv).toBe(849500);
    expect(result.golyPct).toBeCloseTo(25, 1);
    expect(result.closingStockQty).toBe(14920);
    expect(result.gmPct).toBeCloseTo(58.80, 1);
    expect(result.grossMargin).toBeDefined();
  });

  // Edge: all nulls
  it('calculateAll: handles all-null inputs gracefully', () => {
    const result = calculateAll({
      nsq: null, inwardsQty: null,
      asp: null, cogs: null, openingStockQty: null,
      lySalesNsq: null, returnPct: null, taxPct: null,
      nextMonthNsq: null,
    });
    expect(result.salesPlanGmv).toBeNull();
    expect(result.nsv).toBeNull();
    expect(result.grossMargin).toBeNull();
  });
});

describe('calcSuggestedInwards', () => {
  it('uses next month NSQ when available', () => {
    // Standard_DoH=55, nextNsq=1000, opening=800, nsq=900
    // = max(0, round(55 × 1000/30 - 800 + 900)) = max(0, round(1833.33 - 800 + 900)) = max(0, round(1933.33)) = 1933
    expect(calcSuggestedInwards(900, 1000, 55, 800)).toBe(1933);
  });

  it('falls back to current NSQ when next month is null', () => {
    // nextNsq=null → use nsq=900
    // = max(0, round(55 × 900/30 - 800 + 900)) = max(0, round(1650 - 800 + 900)) = 1750
    expect(calcSuggestedInwards(900, null, 55, 800)).toBe(1750);
  });

  it('returns 0 when result would be negative', () => {
    // Large opening stock, small NSQ
    expect(calcSuggestedInwards(100, null, 30, 5000)).toBe(0);
  });

  it('returns null when NSQ is null', () => {
    expect(calcSuggestedInwards(null, null, 55, 800)).toBeNull();
  });

  it('returns null when standard_doh is null', () => {
    expect(calcSuggestedInwards(900, null, null, 800)).toBeNull();
  });

  it('returns null when opening_stock is null', () => {
    expect(calcSuggestedInwards(900, null, 55, null)).toBeNull();
  });
});
