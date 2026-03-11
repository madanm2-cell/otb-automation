import type { FormulaInputs, FormulaOutputs } from '@/types/otb';

// Step 1: Sales Plan GMV = NSQ × ASP
export function calcSalesPlanGmv(nsq: number | null, asp: number | null): number | null {
  if (nsq == null || asp == null) return null;
  return nsq * asp;
}

// Step 2: GOLY% = ((GMV / LY_GMV) - 1) × 100
export function calcGolyPct(gmv: number | null, lyGmv: number | null): number | null {
  if (gmv == null || lyGmv == null || lyGmv === 0) return null;
  return ((gmv / lyGmv) - 1) * 100;
}

// Step 3: NSV = GMV × (1 - Return%) × (1 - Tax%)
export function calcNsv(gmv: number | null, returnPct: number | null, taxPct: number | null): number | null {
  if (gmv == null || returnPct == null || taxPct == null) return null;
  return gmv * (1 - returnPct / 100) * (1 - taxPct / 100);
}

// Step 4: Inwards Value = Inwards Qty × COGS
export function calcInwardsValCogs(qty: number | null, cogs: number | null): number | null {
  if (qty == null || cogs == null) return null;
  return qty * cogs;
}

// Step 5: Opening Stock Value = Opening Stock Qty × COGS
export function calcOpeningStockVal(qty: number | null, cogs: number | null): number | null {
  if (qty == null || cogs == null) return null;
  return qty * cogs;
}

// Step 6: Closing Stock Qty = Opening + Inwards - NSQ
export function calcClosingStockQty(opening: number | null, inwards: number | null, nsq: number | null): number | null {
  if (opening == null || inwards == null || nsq == null) return null;
  return opening + inwards - nsq;
}

// Step 7: Forward 30-day DoH = Closing Stock / (Next Month NSQ / 30)
export function calcFwd30dayDoh(closing: number | null, nextNsq: number | null): number | null {
  if (closing == null || nextNsq == null || nextNsq === 0) return null;
  return closing / (nextNsq / 30);
}

// Step 8: GM% = (ASP - COGS) / ASP × 100
export function calcGmPct(asp: number | null, cogs: number | null): number | null {
  if (asp == null || cogs == null || asp === 0) return null;
  return ((asp - cogs) / asp) * 100;
}

// Step 9: Gross Margin = NSV × GM%
export function calcGrossMargin(nsv: number | null, gmPct: number | null): number | null {
  if (nsv == null || gmPct == null) return null;
  return nsv * (gmPct / 100);
}

// Step 10: CM1 = NSV × (1 - Sellex%)
export function calcCm1(nsv: number | null, sellexPct: number | null): number | null {
  if (nsv == null || sellexPct == null) return null;
  return nsv * (1 - sellexPct / 100);
}

// Step 11: CM2 = CM1 - (NSV × Perf Mktg %)
export function calcCm2(cm1: number | null, nsv: number | null, perfMktgPct: number | null): number | null {
  if (cm1 == null || nsv == null || perfMktgPct == null) return null;
  return cm1 - (nsv * perfMktgPct / 100);
}

// Full 11-step chain
export function calculateAll(inputs: FormulaInputs): FormulaOutputs {
  const salesPlanGmv = calcSalesPlanGmv(inputs.nsq, inputs.asp);
  const golyPct = calcGolyPct(salesPlanGmv, inputs.lySalesGmv);
  const nsv = calcNsv(salesPlanGmv, inputs.returnPct, inputs.taxPct);
  const inwardsValCogs = calcInwardsValCogs(inputs.inwardsQty, inputs.cogs);
  const openingStockVal = calcOpeningStockVal(inputs.openingStockQty, inputs.cogs);
  const closingStockQty = calcClosingStockQty(inputs.openingStockQty, inputs.inwardsQty, inputs.nsq);
  const fwd30dayDoh = calcFwd30dayDoh(closingStockQty, inputs.nextMonthNsq);
  const gmPct = calcGmPct(inputs.asp, inputs.cogs);
  const grossMargin = calcGrossMargin(nsv, gmPct);
  const cm1 = calcCm1(nsv, inputs.sellexPct);
  const cm2 = calcCm2(cm1, nsv, inputs.perfMarketingPct);
  return { salesPlanGmv, golyPct, nsv, inwardsValCogs, openingStockVal, closingStockQty, fwd30dayDoh, gmPct, grossMargin, cm1, cm2 };
}
