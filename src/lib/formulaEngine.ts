import type { FormulaInputs, FormulaOutputs } from '@/types/otb';

// Step 1: Sales Plan GMV = NSQ × ASP
export function calcSalesPlanGmv(nsq: number | null, asp: number | null): number | null {
  if (nsq == null || asp == null) return null;
  return nsq * asp;
}

// Step 2: GOLY% = ((NSQ / LY_NSQ) - 1) × 100
export function calcGolyPct(nsq: number | null, lyNsq: number | null): number | null {
  if (nsq == null || lyNsq == null || lyNsq === 0) return null;
  return ((nsq / lyNsq) - 1) * 100;
}

// Step 3: NSV = GMV × (1 - Return%) × (1 - Tax%)
export function calcNsv(gmv: number | null, returnPct: number | null, taxPct: number | null): number | null {
  if (gmv == null || returnPct == null || taxPct == null) return null;
  return gmv * (1 - returnPct / 100) * (1 - taxPct / 100);
}

// Step 4: Inwards Value = Inwards Qty × COGS (inwards defaults to 0 if not yet entered)
export function calcInwardsValCogs(qty: number | null, cogs: number | null): number | null {
  if (cogs == null) return null;
  return (qty ?? 0) * cogs;
}

// Step 5: Opening Stock Value = Opening Stock Qty × COGS
export function calcOpeningStockVal(qty: number | null, cogs: number | null): number | null {
  if (qty == null || cogs == null) return null;
  return qty * cogs;
}

// Step 6: Closing Stock Qty = Opening + Inwards - NSQ (inwards defaults to 0 if not yet entered)
export function calcClosingStockQty(opening: number | null, inwards: number | null, nsq: number | null): number | null {
  if (opening == null || nsq == null) return null;
  return opening + (inwards ?? 0) - nsq;
}

// Step 7: Forward 30-day DoH = Closing Stock / (Next Month NSQ / 30), rounded to nearest day
export function calcFwd30dayDoh(closing: number | null, nextNsq: number | null): number | null {
  if (closing == null || nextNsq == null || nextNsq === 0) return null;
  return Math.round(closing / (nextNsq / 30));
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

// Suggested Inwards = max(0, round(StandardDoH × nextDemand/30 - OpeningStockQty + NSQ))
// nextDemand = nextMonthNsq if provided and > 0, else current nsq
export function calcSuggestedInwards(
  nsq: number | null,
  nextMonthNsq: number | null,
  standardDoh: number | null,
  openingStockQty: number | null,
): number | null {
  if (nsq == null || standardDoh == null || openingStockQty == null) return null;
  const nextDemand = (nextMonthNsq != null && nextMonthNsq > 0) ? nextMonthNsq : nsq;
  return Math.max(0, Math.round(standardDoh * nextDemand / 30 - openingStockQty + nsq));
}

// Full 9-step chain (GM only — CM1/CM2 removed per 2026-04-27 pivot)
export function calculateAll(inputs: FormulaInputs): FormulaOutputs {
  const salesPlanGmv = calcSalesPlanGmv(inputs.nsq, inputs.asp);
  const golyPct = calcGolyPct(inputs.nsq, inputs.lySalesNsq);
  const nsv = calcNsv(salesPlanGmv, inputs.returnPct, inputs.taxPct);
  const inwardsValCogs = calcInwardsValCogs(inputs.inwardsQty, inputs.cogs);
  const openingStockVal = calcOpeningStockVal(inputs.openingStockQty, inputs.cogs);
  const closingStockQty = calcClosingStockQty(inputs.openingStockQty, inputs.inwardsQty, inputs.nsq);
  const fwd30dayDoh = calcFwd30dayDoh(closingStockQty, inputs.nextMonthNsq);
  const gmPct = calcGmPct(inputs.asp, inputs.cogs);
  const grossMargin = calcGrossMargin(nsv, gmPct);
  return { salesPlanGmv, golyPct, nsv, inwardsValCogs, openingStockVal, closingStockQty, fwd30dayDoh, gmPct, grossMargin };
}
