import type { VarianceLevel, VarianceMetric, MetricDirection } from '@/types/otb';
import { METRIC_DIRECTIONS } from '@/types/otb';
import {
  calcSalesPlanGmv,
  calcNsv,
  calcClosingStockQty,
  calcFwd30dayDoh,
  calcGmPct,
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
  direction: MetricDirection = 'higher_is_good',
): VarianceLevel {
  if (variancePct == null) return 'green';

  if (direction === 'higher_is_good') {
    if (variancePct >= 0) return 'green';
    if (Math.abs(variancePct) <= thresholdPct) return 'yellow';
    return 'red';
  } else {
    if (variancePct <= 0) return 'green';
    if (variancePct <= thresholdPct) return 'yellow';
    return 'red';
  }
}

export function buildVarianceMetric(
  metricKey: string,
  actual: number | null,
  planned: number | null,
  thresholdPct: number,
): VarianceMetric {
  const variance_pct = calcVariancePct(actual, planned);
  const direction: MetricDirection = METRIC_DIRECTIONS[metricKey] ?? 'higher_is_good';
  return {
    metric: metricKey,
    planned,
    actual,
    variance_pct,
    level: classifyVariance(variance_pct, thresholdPct, direction),
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
  nextMonthActualNsq: number | null;
}

export interface ActualDerivedOutputs {
  actualGmv: number | null;
  actualNsv: number | null;
  actualClosingStockQty: number | null;
  actualDoh: number | null;
  actualGmPct: number | null;
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
  return { actualGmv, actualNsv, actualClosingStockQty, actualDoh, actualGmPct };
}
