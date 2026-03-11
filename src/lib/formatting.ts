/**
 * Format INR value in Crores: value / 10^7, 2 decimal places
 */
export function formatCrore(value: number | null | undefined): string {
  if (value == null) return '-';
  return (value / 10000000).toFixed(2) + ' Cr';
}

/**
 * Format percentage with 1 decimal place
 */
export function formatPct(value: number | null | undefined): string {
  if (value == null) return '-';
  return value.toFixed(1) + '%';
}

/**
 * Format quantity with Indian thousand separators
 */
export function formatQty(value: number | null | undefined): string {
  if (value == null) return '-';
  return value.toLocaleString('en-IN');
}

/**
 * Format ASP/COGS as currency with 2 decimal places
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
