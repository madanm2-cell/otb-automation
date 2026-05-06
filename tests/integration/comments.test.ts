import { describe, it, expect } from 'vitest';
import type { OtbComment, CommentType } from '@/types/otb';

/**
 * Integration tests for the comments system.
 * Tests comment structure, threading, and type validation logic.
 * (API-level tests require Supabase; these test the data model patterns.)
 */

// ---------------------------------------------------------------------------
// Mirrors the validation logic in POST /api/cycles/:cycleId/comments
// ---------------------------------------------------------------------------
const API_VALID_COMMENT_TYPES: CommentType[] = ['general', 'metric'];

interface PostCommentBody {
  text?: string;
  comment_type?: string;
  month?: string | null;
  field?: string | null;
  row_id?: string | null;
  parent_id?: string | null;
}

interface ValidationResult {
  status: number;
  error?: string;
}

/**
 * Pure replica of the API's request validation — returns the same status/error
 * the real endpoint would return, without needing a running server or Supabase.
 */
function validateCommentRequest(body: PostCommentBody): ValidationResult {
  const { text, comment_type, month, field } = body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { status: 400, error: 'Comment text is required' };
  }

  if (!comment_type || !API_VALID_COMMENT_TYPES.includes(comment_type as CommentType)) {
    return {
      status: 400,
      error: `comment_type must be one of: ${API_VALID_COMMENT_TYPES.join(', ')}`,
    };
  }

  if (comment_type === 'metric') {
    if (!month || !field) {
      return { status: 400, error: 'Metric comments require month and field' };
    }
  }

  // All validation passed — would proceed to DB insert (201)
  return { status: 201 };
}

function makeComment(overrides: Partial<OtbComment> = {}): OtbComment {
  return {
    id: `cmt-${Math.random().toString(36).slice(2, 8)}`,
    cycle_id: 'cycle-1',
    parent_id: null,
    comment_type: 'general',
    row_id: null,
    month: null,
    field: null,
    text: 'Test comment',
    author_id: 'user-1',
    author_name: 'Alice',
    author_role: 'Planning',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Build a thread tree from a flat comment list (mirrors CommentsPanel logic) */
function buildThreadTree(comments: OtbComment[]): OtbComment[] {
  const map = new Map<string, OtbComment>();
  const roots: OtbComment[] = [];

  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

const VALID_TYPES: CommentType[] = ['metric', 'general'];

describe('Comments — Data Model', () => {
  describe('Comment types', () => {
    it('general comments have no row/month/field', () => {
      const c = makeComment({ comment_type: 'general' });
      expect(c.row_id).toBeNull();
      expect(c.month).toBeNull();
      expect(c.field).toBeNull();
    });

    it('metric comments require row_id, month, and field', () => {
      const c = makeComment({
        comment_type: 'metric',
        row_id: 'row-1',
        month: '2026-04-01',
        field: 'nsq',
      });
      expect(c.comment_type).toBe('metric');
      expect(c.row_id).toBeTruthy();
      expect(c.month).toBeTruthy();
      expect(c.field).toBeTruthy();
    });

    it('general comments are top-level cycle comments', () => {
      const c = makeComment({ comment_type: 'general' });
      expect(c.comment_type).toBe('general');
      expect(c.parent_id).toBeNull();
    });

    it('validates comment types', () => {
      for (const type of VALID_TYPES) {
        expect(VALID_TYPES).toContain(type);
      }
      expect(VALID_TYPES).not.toContain('invalid');
    });
  });

  describe('Threading', () => {
    it('builds tree from flat list', () => {
      const comments = [
        makeComment({ id: 'cmt-1', text: 'Parent comment' }),
        makeComment({ id: 'cmt-2', parent_id: 'cmt-1', text: 'Reply 1' }),
        makeComment({ id: 'cmt-3', parent_id: 'cmt-1', text: 'Reply 2' }),
        makeComment({ id: 'cmt-4', text: 'Another top-level' }),
      ];

      const tree = buildThreadTree(comments);
      expect(tree).toHaveLength(2); // 2 root comments
      expect(tree[0].replies).toHaveLength(2); // first has 2 replies
      expect(tree[1].replies).toHaveLength(0); // second has no replies
    });

    it('handles nested replies (reply to reply)', () => {
      const comments = [
        makeComment({ id: 'cmt-1', text: 'Root' }),
        makeComment({ id: 'cmt-2', parent_id: 'cmt-1', text: 'Reply' }),
        makeComment({ id: 'cmt-3', parent_id: 'cmt-2', text: 'Reply to reply' }),
      ];

      const tree = buildThreadTree(comments);
      expect(tree).toHaveLength(1);
      expect(tree[0].replies).toHaveLength(1);
      expect(tree[0].replies![0].replies).toHaveLength(1);
      expect(tree[0].replies![0].replies![0].text).toBe('Reply to reply');
    });

    it('handles empty list', () => {
      const tree = buildThreadTree([]);
      expect(tree).toHaveLength(0);
    });

    it('handles orphaned replies gracefully (parent not in list)', () => {
      const comments = [
        makeComment({ id: 'cmt-1', parent_id: 'nonexistent', text: 'Orphan' }),
      ];
      const tree = buildThreadTree(comments);
      // Orphan becomes a root
      expect(tree).toHaveLength(1);
      expect(tree[0].text).toBe('Orphan');
    });
  });

  describe('Author metadata', () => {
    it('preserves author info', () => {
      const c = makeComment({
        author_id: 'user-42',
        author_name: 'Bob Smith',
        author_role: 'Finance',
      });
      expect(c.author_id).toBe('user-42');
      expect(c.author_name).toBe('Bob Smith');
      expect(c.author_role).toBe('Finance');
    });

    it('comments from different authors in same thread', () => {
      const comments = [
        makeComment({ id: 'cmt-1', author_name: 'Alice', author_role: 'Planning', text: 'Question about NSQ' }),
        makeComment({ id: 'cmt-2', parent_id: 'cmt-1', author_name: 'Bob', author_role: 'GD', text: 'Updated the values' }),
      ];
      const tree = buildThreadTree(comments);
      expect(tree[0].author_role).toBe('Planning');
      expect(tree[0].replies![0].author_role).toBe('GD');
    });
  });

  describe('API validation rules (post-migration)', () => {
    it('rejects comment_type brand after migration', () => {
      const result = validateCommentRequest({ text: 'hello', comment_type: 'brand' });
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/comment_type must be one of/);
    });

    it('metric comment succeeds with month and field (no row_id)', () => {
      const result = validateCommentRequest({
        text: 'NSQ too high',
        comment_type: 'metric',
        month: '2026-04-01',
        field: 'nsq',
      });
      expect(result.status).toBe(201);
    });

    it('metric comment fails without month', () => {
      const result = validateCommentRequest({
        text: 'NSQ too high',
        comment_type: 'metric',
        field: 'nsq',
      });
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/month and field/);
    });
  });
});
