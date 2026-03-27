import type { VarianceLevel, VarianceMetric, VarianceRow } from '@/types/otb';
import {
  calcSalesPlanGmv,
  calcNsv,
  calcClosingStockQty,
  calcFwd30dayDoh,
  calcGmPct,
  calcCm1Pct,
} from './formulaEngine';

export function calcVariancePct(
  actual: number | null,
  planned: number | null,
): number | null {
  if (actual == null || planned == null || planned === 0) return null;
  return ((actual - planned) / planned) * 100;
}

export function classifyVariance(
  variancePct: number | null,
  thresholdPct: number,
): VarianceLevel {
  if (variancePct == null) return 'green';
  const abs = Math.abs(variancePct);
  if (abs < thresholdPct) return 'green';
  if (abs === thresholdPct) return 'yellow';
  return 'red';
}

export function buildVarianceMetric(
  metric: string,
  actual: number | null,
  planned: number | null,
  thresholdPct: number,
): VarianceMetric {
  const variance_pct = calcVariancePct(actual, planned);
  return {
    metric,
    planned,
    actual,
    variance_pct,
    level: classifyVariance(variance_pct, thresholdPct),
  };
}

export interface ActualDerivedInputs {
  actualNsq: number | null;
  actualInwardsQty: number | null;
  asp: number | null;
  cogs: number | null;
  openingStockQty: number | null;
  returnPct: number | null;
  taxPct: number | null;
  sellexPct: number | null;
  nextMonthActualNsq: number | null;
}

export interface ActualDerivedOutputs {
  actualGmv: number | null;
  actualNsv: number | null;
  actualClosingStockQty: number | null;
  actualDoh: number | null;
  actualGmPct: number | null;
  actualCm1: number | null;
}

export function calcActualDerived(inputs: ActualDerivedInputs): ActualDerivedOutputs {
  const actualGmv = calcSalesPlanGmv(inputs.actualNsq, inputs.asp);
  const actualNsv = calcNsv(actualGmv, inputs.returnPct, inputs.taxPct);
  const actualClosingStockQty = calcClosingStockQty(
    inputs.openingStockQty,
    inputs.actualInwardsQty,
    inputs.actualNsq,
  );
  const actualDoh = calcFwd30dayDoh(actualClosingStockQty, inputs.nextMonthActualNsq);
  const actualGmPct = calcGmPct(inputs.asp, inputs.cogs);
  const actualCm1 = calcCm1Pct(actualGmPct, inputs.sellexPct);

  return { actualGmv, actualNsv, actualClosingStockQty, actualDoh, actualGmPct, actualCm1 };
}

function maxAbsVariance(row: VarianceRow): number {
  const values = [
    row.nsq.variance_pct,
    row.gmv.variance_pct,
    row.inwards.variance_pct,
    row.closing_stock.variance_pct,
  ];
  return Math.max(...values.map(v => Math.abs(v ?? 0)));
}

export function getTopVariances(rows: VarianceRow[], n: number): VarianceRow[] {
  return [...rows]
    .sort((a, b) => maxAbsVariance(b) - maxAbsVariance(a))
    .slice(0, n);
}
