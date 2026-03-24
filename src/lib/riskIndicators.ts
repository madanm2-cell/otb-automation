export type RiskLevel = 'yellow' | 'red';

export interface RiskFlag {
  level: RiskLevel;
  metric: string;
  message: string;
}

export interface CycleMetrics {
  avgDoh: number | null;        // Average Days on Hand
  gmPct: number | null;         // Gross Margin %
  categoryAvgGmPct: number | null; // Category average GM% for comparison
  totalInwardsQty: number | null;
  lyTotalInwardsQty: number | null; // Last year total inwards for comparison
}

// Thresholds (from PRD)
const DOH_WARNING_THRESHOLD = 60;
const INWARDS_GROWTH_WARNING_PCT = 25;

/**
 * Evaluate risk flags for a set of cycle metrics.
 * Pure function — no DB access.
 */
export function getRiskFlags(metrics: CycleMetrics): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // DoH > 60 days → yellow
  if (metrics.avgDoh != null && metrics.avgDoh > DOH_WARNING_THRESHOLD) {
    flags.push({
      level: 'yellow',
      metric: 'doh',
      message: `Average DoH is ${metrics.avgDoh.toFixed(0)} days (threshold: ${DOH_WARNING_THRESHOLD})`,
    });
  }

  // GM% < category average → red
  if (
    metrics.gmPct != null &&
    metrics.categoryAvgGmPct != null &&
    metrics.gmPct < metrics.categoryAvgGmPct
  ) {
    flags.push({
      level: 'red',
      metric: 'gm_pct',
      message: `GM% (${(metrics.gmPct * 100).toFixed(1)}%) is below category average (${(metrics.categoryAvgGmPct * 100).toFixed(1)}%)`,
    });
  }

  // Inwards > LY by 25%+ → yellow
  if (
    metrics.totalInwardsQty != null &&
    metrics.lyTotalInwardsQty != null &&
    metrics.lyTotalInwardsQty > 0
  ) {
    const growthPct = ((metrics.totalInwardsQty - metrics.lyTotalInwardsQty) / metrics.lyTotalInwardsQty) * 100;
    if (growthPct > INWARDS_GROWTH_WARNING_PCT) {
      flags.push({
        level: 'yellow',
        metric: 'inwards_growth',
        message: `Inwards growth is ${growthPct.toFixed(1)}% vs LY (threshold: ${INWARDS_GROWTH_WARNING_PCT}%)`,
      });
    }
  }

  return flags;
}

/**
 * Get the highest risk level from a set of flags.
 * Returns null if no flags.
 */
export function getHighestRiskLevel(flags: RiskFlag[]): RiskLevel | null {
  if (flags.length === 0) return null;
  if (flags.some(f => f.level === 'red')) return 'red';
  return 'yellow';
}
