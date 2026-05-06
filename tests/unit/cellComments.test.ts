import { describe, it, expect } from 'vitest';
import { buildCellKey, parseCellField, buildCommentMap } from '../../src/lib/cellComments';
import type { OtbComment } from '../../src/types/otb';

describe('buildCellKey', () => {
  it('builds key from rowId, month, field', () => {
    expect(buildCellKey('row-1', '2026-04-01', 'nsq')).toBe('row-1|2026-04-01|nsq');
  });
  it('handles different fields', () => {
    expect(buildCellKey('row-1', '2026-04-01', 'inwards_qty')).toBe('row-1|2026-04-01|inwards_qty');
  });
});

describe('parseCellField', () => {
  it('parses date-prefixed column field into month and fieldName', () => {
    expect(parseCellField('2026-04-01_nsq')).toEqual({ month: '2026-04-01', fieldName: 'nsq' });
  });
  it('parses multi-segment field names', () => {
    expect(parseCellField('2026-04-01_inwards_qty')).toEqual({ month: '2026-04-01', fieldName: 'inwards_qty' });
  });
  it('returns null for dimension columns without date prefix', () => {
    expect(parseCellField('sub_brand')).toBeNull();
    expect(parseCellField('channel')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(parseCellField('')).toBeNull();
  });
});

describe('buildCommentMap', () => {
  it('builds map keyed by rowId|month|field from metric comments only', () => {
    const comments: OtbComment[] = [
      { id: '1', cycle_id: 'c', parent_id: null, comment_type: 'metric', row_id: 'row-1', month: '2026-04-01', field: 'nsq', text: 'hi', author_id: 'u', author_name: 'A', author_role: 'GD', created_at: '' },
      { id: '2', cycle_id: 'c', parent_id: null, comment_type: 'general', row_id: null, month: null, field: null, text: 'general', author_id: 'u', author_name: 'A', author_role: 'GD', created_at: '' },
    ];
    const map = buildCommentMap(comments);
    expect(map.size).toBe(1);
    expect(map.get('row-1|2026-04-01|nsq')).toHaveLength(1);
  });
  it('groups multiple comments for the same cell', () => {
    const comments: OtbComment[] = [
      { id: '1', cycle_id: 'c', parent_id: null, comment_type: 'metric', row_id: 'row-1', month: '2026-04-01', field: 'nsq', text: 'first', author_id: 'u', author_name: 'A', author_role: 'GD', created_at: '' },
      { id: '2', cycle_id: 'c', parent_id: null, comment_type: 'metric', row_id: 'row-1', month: '2026-04-01', field: 'nsq', text: 'second', author_id: 'u', author_name: 'B', author_role: 'Planning', created_at: '' },
    ];
    const map = buildCommentMap(comments);
    expect(map.get('row-1|2026-04-01|nsq')).toHaveLength(2);
  });
  it('skips metric comments missing row_id, month, or field', () => {
    const comments: OtbComment[] = [
      { id: '1', cycle_id: 'c', parent_id: null, comment_type: 'metric', row_id: null, month: '2026-04-01', field: 'nsq', text: 'hi', author_id: 'u', author_name: 'A', author_role: 'GD', created_at: '' },
    ];
    const map = buildCommentMap(comments);
    expect(map.size).toBe(0);
  });
});
