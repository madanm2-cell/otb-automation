/**
 * Canonical quarter ID for the quarter containing `now` (default: today).
 * Returns the hyphenated form (e.g. "Q1-FY27") expected by getQuarterDates.
 */
export function getCurrentQuarterId(now: Date = new Date()): string {
  const month = now.getMonth();
  const fyYear = month >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  const q = month >= 3 ? Math.ceil((month - 2) / 3) : 4;
  return `Q${q}-FY${String(fyYear).slice(-2)}`;
}

/**
 * Parse a planning quarter string like "Q4-FY26" into start/end dates.
 * FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
 * FY26 means Apr 2025 - Mar 2026.
 */
export function getQuarterDates(quarter: string): { start: string; end: string; months: string[] } {
  const match = quarter.match(/^Q(\d)-FY(\d{2})$/);
  if (!match) throw new Error(`Invalid quarter format: ${quarter}. Expected Q1-FY26 format.`);

  const q = parseInt(match[1]);
  const fy = parseInt(match[2]) + 2000; // FY26 → 2026

  let startYear: number, startMonth: number;
  switch (q) {
    case 1: startYear = fy - 1; startMonth = 4; break;  // Apr
    case 2: startYear = fy - 1; startMonth = 7; break;  // Jul
    case 3: startYear = fy - 1; startMonth = 10; break; // Oct
    case 4: startYear = fy; startMonth = 1; break;       // Jan
    default: throw new Error(`Invalid quarter: Q${q}`);
  }

  const months: string[] = [];
  for (let i = 0; i < 3; i++) {
    const m = startMonth + i;
    const y = startYear + (m > 12 ? 1 : 0);
    const mm = ((m - 1) % 12) + 1;
    months.push(`${y}-${String(mm).padStart(2, '0')}-01`);
  }

  const endMonth = startMonth + 2;
  const endYear = startYear + (endMonth > 12 ? 1 : 0);
  const endMm = ((endMonth - 1) % 12) + 1;
  // Last day of the end month
  const endDate = new Date(endYear, endMm, 0);
  const endStr = `${endYear}-${String(endMm).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  return {
    start: months[0],
    end: endStr,
    months,
  };
}
