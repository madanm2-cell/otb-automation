/**
 * Month lockout logic (PRD FR-3.4)
 * - Current month: always locked
 * - M+1: locked after 15th of current month
 * - All calculations use IST (Asia/Kolkata) timezone
 */
export function getLockedMonths(months: string[]): Record<string, boolean> {
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const curYear = nowIST.getFullYear();
  const curMonth = nowIST.getMonth(); // 0-indexed
  const curDay = nowIST.getDate();

  const result: Record<string, boolean> = {};
  for (const m of months) {
    const d = new Date(m + 'T00:00:00+05:30');
    const mYear = d.getFullYear();
    const mMonth = d.getMonth();

    if (mYear < curYear || (mYear === curYear && mMonth < curMonth)) {
      result[m] = true;                       // past month
    } else if (mYear === curYear && mMonth === curMonth) {
      result[m] = true;                       // current month — always locked
    } else if (mYear === curYear && mMonth === curMonth + 1 && curDay > 15) {
      result[m] = true;                       // M+1 locked after 15th
    } else {
      result[m] = false;
    }
  }
  return result;
}
