import type { OtbComment } from '@/types/otb';

export function buildCellKey(rowId: string, month: string, field: string): string {
  return `${rowId}|${month}|${field}`;
}

export function parseCellField(colField: string): { month: string; fieldName: string } | null {
  const match = colField.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
  if (!match) return null;
  return { month: match[1], fieldName: match[2] };
}

export function buildCommentMap(comments: OtbComment[]): Map<string, OtbComment[]> {
  const map = new Map<string, OtbComment[]>();
  for (const c of comments) {
    if (c.comment_type !== 'metric') continue;
    if (!c.row_id || !c.month || !c.field) continue;
    const key = buildCellKey(c.row_id, c.month, c.field);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}
