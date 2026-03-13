/**
 * Format INR value in Crores: value / 10^7, 2 decimal places
 */
export function formatCrore(value: number | string | null | undefined): string {
  if (value == null || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return (num / 10000000).toFixed(2) + ' Cr';
}

/**
 * Format percentage with 1 decimal place
 */
export function formatPct(value: number | string | null | undefined): string {
  if (value == null || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return num.toFixed(1) + '%';
}

/**
 * Format quantity with Indian thousand separators
 */
export function formatQty(value: number | string | null | undefined): string {
  if (value == null || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return num.toLocaleString('en-IN');
}

/**
 * Format ASP/COGS as currency with 2 decimal places
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value == null || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
