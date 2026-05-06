# Cell-Level Grid Comments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add GSheets-style cell comments to the OTB grid — right-click any cell to add a comment, amber triangle indicator on cells with comments, popover shows the thread.

**Architecture:** `commentMap` (Map keyed by `rowId|month|field`) built in the grid page, passed to `OtbGrid`. AG Grid `cellClassRules` applies `.has-comment` CSS class; `::after` draws the triangle. `CellContextMenu` and `CellCommentPopover` are React portals. Also removes the redundant `brand` comment type (→ `general`).

**Tech Stack:** Next.js App Router, AG Grid Community 35, Ant Design 6, Supabase, Vitest (unit tests)

---

## Task 1: DB migration — remove `brand` comment type

**Files:**
- Create: `supabase/migrations/015_remove_brand_comment_type.sql`

**Step 1: Write the migration**

```sql
-- Migration 015: Remove 'brand' comment type — redundant with 'general' in brand-scoped cycles
BEGIN;

-- Migrate existing brand comments → general
UPDATE comments SET comment_type = 'general' WHERE comment_type = 'brand';

-- Drop old check constraint (name from migration 010)
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_comment_type_check;

-- Add new constraint
ALTER TABLE comments ADD CONSTRAINT comments_comment_type_check
  CHECK (comment_type IN ('general', 'metric'));

COMMIT;
```

**Step 2: Apply migration**

```bash
cd otb-automation
npx supabase db reset
```

Expected: migrations run without error, local DB resets cleanly.

**Step 3: Commit**

```bash
git add supabase/migrations/015_remove_brand_comment_type.sql
git commit -m "feat: remove brand comment type — migrate to general"
```

---

## Task 2: TypeScript type + API cleanup

**Files:**
- Modify: `src/types/otb.ts` (line 285)
- Modify: `src/app/api/cycles/[cycleId]/comments/route.ts` (line 9)
- Modify: `src/components/CommentsPanel.tsx` (COMMENT_TYPE_OPTIONS array)

**Step 1: Update `CommentType` union in `src/types/otb.ts`**

Change line 285:
```typescript
// Before:
export type CommentType = 'brand' | 'metric' | 'general';

// After:
export type CommentType = 'general' | 'metric';
```

**Step 2: Update API allowed types in `src/app/api/cycles/[cycleId]/comments/route.ts`**

Change line 9:
```typescript
// Before:
const VALID_COMMENT_TYPES: CommentType[] = ['brand', 'metric', 'general'];

// After:
const VALID_COMMENT_TYPES: CommentType[] = ['general', 'metric'];
```

**Step 3: Remove Brand option from CommentsPanel dropdown**

In `src/components/CommentsPanel.tsx`, update `COMMENT_TYPE_OPTIONS`:
```typescript
// Before:
const COMMENT_TYPE_OPTIONS: { value: CommentType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'brand', label: 'Brand' },
  { value: 'metric', label: 'Metric' },
];

// After:
const COMMENT_TYPE_OPTIONS: { value: CommentType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'metric', label: 'Metric' },
];
```

**Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors.

**Step 5: Commit**

```bash
git add src/types/otb.ts src/app/api/cycles/[cycleId]/comments/route.ts src/components/CommentsPanel.tsx
git commit -m "feat: remove brand CommentType — update types, API, and UI"
```

---

## Task 3: `buildCellKey` helper — tests then implementation

**Files:**
- Create: `src/lib/cellComments.ts`
- Create: `tests/unit/cellComments.test.ts`

**Step 1: Write failing tests in `tests/unit/cellComments.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { buildCellKey, parseCellField } from '../../src/lib/cellComments';
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
    const { buildCommentMap } = require('../../src/lib/cellComments');
    const comments: OtbComment[] = [
      { id: '1', cycle_id: 'c', parent_id: null, comment_type: 'metric', row_id: 'row-1', month: '2026-04-01', field: 'nsq', text: 'hi', author_id: 'u', author_name: 'A', author_role: 'GD', created_at: '' },
      { id: '2', cycle_id: 'c', parent_id: null, comment_type: 'general', row_id: null, month: null, field: null, text: 'general', author_id: 'u', author_name: 'A', author_role: 'GD', created_at: '' },
    ];
    const map = buildCommentMap(comments);
    expect(map.size).toBe(1);
    expect(map.get('row-1|2026-04-01|nsq')).toHaveLength(1);
    expect(map.has('general')).toBe(false);
  });

  it('groups multiple comments for the same cell', () => {
    const { buildCommentMap } = require('../../src/lib/cellComments');
    const comments: OtbComment[] = [
      { id: '1', cycle_id: 'c', parent_id: null, comment_type: 'metric', row_id: 'row-1', month: '2026-04-01', field: 'nsq', text: 'first', author_id: 'u', author_name: 'A', author_role: 'GD', created_at: '' },
      { id: '2', cycle_id: 'c', parent_id: null, comment_type: 'metric', row_id: 'row-1', month: '2026-04-01', field: 'nsq', text: 'second', author_id: 'u', author_name: 'B', author_role: 'Planning', created_at: '' },
    ];
    const map = buildCommentMap(comments);
    expect(map.get('row-1|2026-04-01|nsq')).toHaveLength(2);
  });

  it('skips metric comments missing row_id, month, or field', () => {
    const { buildCommentMap } = require('../../src/lib/cellComments');
    const comments: OtbComment[] = [
      { id: '1', cycle_id: 'c', parent_id: null, comment_type: 'metric', row_id: null, month: '2026-04-01', field: 'nsq', text: 'hi', author_id: 'u', author_name: 'A', author_role: 'GD', created_at: '' },
    ];
    const map = buildCommentMap(comments);
    expect(map.size).toBe(0);
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/cellComments.test.ts 2>&1 | tail -10
```

Expected: FAIL — `cellComments` module not found.

**Step 3: Implement `src/lib/cellComments.ts`**

```typescript
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
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/cellComments.test.ts 2>&1 | tail -10
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add src/lib/cellComments.ts tests/unit/cellComments.test.ts
git commit -m "feat: add buildCellKey, parseCellField, buildCommentMap helpers"
```

---

## Task 4: `CellContextMenu` component

**Files:**
- Create: `src/components/CellContextMenu.tsx`

**Step 1: Implement `src/components/CellContextMenu.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CommentOutlined } from '@ant-design/icons';

interface CellContextMenuProps {
  x: number;
  y: number;
  onAddComment: () => void;
  onClose: () => void;
}

export function CellContextMenu({ x, y, onAddComment, onClose }: CellContextMenuProps) {
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const el = document.getElementById('cell-context-menu');
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      id="cell-context-menu"
      style={{
        position: 'fixed',
        top: y,
        left: x,
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        zIndex: 9999,
        minWidth: 160,
        padding: '4px 0',
      }}
    >
      <div
        onClick={() => { onAddComment(); onClose(); }}
        style={{
          padding: '8px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <CommentOutlined style={{ color: '#666' }} />
        Add comment
      </div>
    </div>,
    document.body
  );
}
```

**Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/CellContextMenu.tsx
git commit -m "feat: add CellContextMenu portal component"
```

---

## Task 5: `CellCommentPopover` component

**Files:**
- Create: `src/components/CellCommentPopover.tsx`

**Step 1: Implement `src/components/CellCommentPopover.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Tag, Typography, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import type { OtbComment } from '@/types/otb';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const ROLE_COLORS: Record<string, string> = {
  Admin: 'red', Planning: 'blue', GD: 'green',
  Finance: 'orange', CXO: 'purple', ReadOnly: 'default',
};

const CAN_COMMENT_ROLES = ['Admin', 'Planning', 'GD', 'Finance', 'CXO'];

function formatRelativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

interface CellCommentPopoverProps {
  cycleId: string;
  rowId: string;
  month: string;
  field: string;
  cellRect: DOMRect;
  comments: OtbComment[];
  onClose: () => void;
  onCommentAdded: () => void;
}

const POPOVER_WIDTH = 300;

export function CellCommentPopover({
  cycleId, rowId, month, field, cellRect, comments, onClose, onCommentAdded,
}: CellCommentPopoverProps) {
  const { profile } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const canComment = CAN_COMMENT_ROLES.includes(profile?.role ?? '');

  // Position: anchor to top-right of cell, shift left if near viewport edge
  const left = Math.min(cellRect.right + 4, window.innerWidth - POPOVER_WIDTH - 12);
  const top = cellRect.top;

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), comment_type: 'metric', row_id: rowId, month, field }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error ?? 'Failed to post comment');
        return;
      }
      setText('');
      onCommentAdded();
    } catch {
      message.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top,
        left,
        width: POPOVER_WIDTH,
        maxHeight: 360,
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {field} · {new Date(month + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
        </Text>
      </div>

      {/* Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: comments.length ? '8px 12px' : 0 }}>
        {comments.length === 0 ? (
          <Text type="secondary" style={{ display: 'block', padding: '12px', fontSize: 12 }}>
            No comments yet.
          </Text>
        ) : (
          comments.map(c => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text strong style={{ fontSize: 12 }}>{c.author_name}</Text>
                <Tag color={ROLE_COLORS[c.author_role] ?? 'default'} style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                  {c.author_role}
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>{formatRelativeTime(c.created_at)}</Text>
              </div>
              <Paragraph style={{ fontSize: 12, margin: 0, whiteSpace: 'pre-wrap' }}>{c.text}</Paragraph>
            </div>
          ))
        )}
      </div>

      {/* Compose */}
      {canComment && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0' }}>
          <TextArea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment..."
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{ fontSize: 12, marginBottom: 6 }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              loading={submitting}
              disabled={!text.trim()}
              onClick={handleSubmit}
            >
              Post
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
```

**Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS" | head -10
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/components/CellCommentPopover.tsx
git commit -m "feat: add CellCommentPopover portal component"
```

---

## Task 6: CSS triangle indicator

**Files:**
- Modify: `src/components/OtbGrid.css`

**Step 1: Append triangle CSS to `src/components/OtbGrid.css`**

Add at the end of the file:

```css
/* Cell comment triangle indicator — GSheets style */
.ag-cell.has-comment {
  position: relative;
}
.ag-cell.has-comment::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border: 7px solid transparent;
  border-top-color: #faad14;
  border-right-color: #faad14;
  pointer-events: none;
}
```

**Step 2: Commit**

```bash
git add src/components/OtbGrid.css
git commit -m "feat: add has-comment triangle CSS indicator"
```

---

## Task 7: Wire `commentMap` into `OtbGrid` — prop + cellClassRules + refresh

**Files:**
- Modify: `src/components/OtbGrid.tsx`

**Step 1: Add imports at top of `src/components/OtbGrid.tsx`**

Add to the existing imports:
```typescript
import { CellContextMenu } from '@/components/CellContextMenu';
import { CellCommentPopover } from '@/components/CellCommentPopover';
import { buildCellKey, parseCellField } from '@/lib/cellComments';
import type { OtbComment } from '@/types/otb';
import type { CellContextMenuEvent, CellClickedEvent } from 'ag-grid-community';
```

**Step 2: Extend `OtbGridProps` interface**

Add these three props to the existing `OtbGridProps` interface:
```typescript
interface OtbGridProps {
  // ... existing props ...
  commentMap?: Map<string, OtbComment[]>;
  cycleId?: string;
  onCommentAdded?: () => void;
}
```

**Step 3: Add state + ref for comment UI inside the component**

Add after existing `useState` calls inside `OtbGrid`:
```typescript
const commentMapRef = useRef<Map<string, OtbComment[]>>(new Map());
const [contextMenu, setContextMenu] = useState<{
  x: number; y: number; rowId: string; month: string; field: string;
} | null>(null);
const [activePopover, setActivePopover] = useState<{
  rowId: string; month: string; field: string; rect: DOMRect; comments: OtbComment[];
} | null>(null);
```

**Step 4: Sync commentMapRef and refresh cells when `commentMap` prop changes**

Add this `useEffect` inside the component (after the ref declarations):
```typescript
useEffect(() => {
  commentMapRef.current = commentMap ?? new Map();
  gridRef.current?.api?.refreshCells({ force: true });
}, [commentMap]);
```

**Step 5: Add `cellClassRules` to every column definition in the `useMemo`**

The column defs are built in a `useMemo` that returns `[...dimCols, recentSalesGroup, ...activeMonthGroup]`. Add `cellClassRules` to each `ColDef` by defining it once and spreading:

After the existing `useMemo` deps (before the `return` statement inside the `useMemo`), define:
```typescript
const commentCellClassRules = {
  'has-comment': (params: any) => {
    if (!params.data?.id || !params.colDef?.field) return false;
    const parsed = parseCellField(params.colDef.field);
    if (!parsed) return false;
    return commentMapRef.current.has(buildCellKey(params.data.id, parsed.month, parsed.fieldName));
  },
};
```

Then spread `cellClassRules: commentCellClassRules` into every `ColDef` object in `refCols`, `gdCols`, `calcCols`, `dimCols`, and the recent sales children. Example pattern:
```typescript
{ field: `${prefix}_nsq`, headerName: 'NSQ', ..., cellClassRules: commentCellClassRules }
```

For `dimCols` (sub_brand, sub_category etc.) — skip adding `cellClassRules` since they have no date prefix and `parseCellField` will return null for them anyway. For cleanliness, you can still add it; the function handles it gracefully.

**Step 6: Add `onCellContextMenu` handler**

Add after the existing state declarations:
```typescript
const canComment = ['Admin', 'Planning', 'GD', 'Finance', 'CXO'].includes(
  // This requires profile — pass role as a prop or read from a context.
  // Add `userRole?: string` to OtbGridProps and pass from parent.
  (props as any).userRole ?? ''
);

const handleCellContextMenu = useCallback((event: CellContextMenuEvent) => {
  if (!canComment) return;
  event.event?.preventDefault();
  const e = event.event as MouseEvent;
  const field = event.colDef?.field;
  if (!field) return;
  const parsed = parseCellField(field);
  if (!parsed) return; // dimension column — no context menu
  const rowId = event.data?.id;
  if (!rowId) return;
  setContextMenu({ x: e.clientX, y: e.clientY, rowId, month: parsed.month, field: parsed.fieldName });
}, [canComment]);
```

> **Note on `userRole`:** Add `userRole?: string` to `OtbGridProps` and pass `profile?.role` from the grid page. This avoids importing `useAuth` into OtbGrid (which is a pure grid component).

**Step 7: Add `onCellClicked` handler for triangle click**

```typescript
const handleCellClicked = useCallback((event: CellClickedEvent) => {
  if (!event.event || !event.colDef?.field) return;
  const e = event.event as MouseEvent;
  const cellEl = (e.target as HTMLElement).closest('.ag-cell') as HTMLElement | null;
  if (!cellEl || !cellEl.classList.contains('has-comment')) return;

  const rect = cellEl.getBoundingClientRect();
  const inTopRight = e.clientX >= rect.right - 14 && e.clientY <= rect.top + 14;
  if (!inTopRight) return;

  const parsed = parseCellField(event.colDef.field);
  if (!parsed) return;
  const rowId = event.data?.id;
  if (!rowId) return;

  const key = buildCellKey(rowId, parsed.month, parsed.fieldName);
  const comments = commentMapRef.current.get(key) ?? [];
  setActivePopover({ rowId, month: parsed.month, field: parsed.fieldName, rect, comments });
}, []);
```

**Step 8: Add context menu and popover to the JSX return**

Inside the `return` of `OtbGrid`, after the closing `</div>` of the grid container, add:

```tsx
{contextMenu && (
  <CellContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    onAddComment={() => {
      const key = buildCellKey(contextMenu.rowId, contextMenu.month, contextMenu.field);
      const comments = commentMapRef.current.get(key) ?? [];
      // Get cell rect from grid API
      const cellEl = document.querySelector(
        `.ag-cell[col-id="${contextMenu.month}_${contextMenu.field}"]`
      ) as HTMLElement | null;
      const rect = cellEl?.getBoundingClientRect() ?? new DOMRect(contextMenu.x, contextMenu.y, 0, 0);
      setActivePopover({ rowId: contextMenu.rowId, month: contextMenu.month, field: contextMenu.field, rect, comments });
      setContextMenu(null);
    }}
    onClose={() => setContextMenu(null)}
  />
)}

{activePopover && cycleId && (
  <CellCommentPopover
    cycleId={cycleId}
    rowId={activePopover.rowId}
    month={activePopover.month}
    field={activePopover.field}
    cellRect={activePopover.rect}
    comments={activePopover.comments}
    onClose={() => setActivePopover(null)}
    onCommentAdded={() => {
      setActivePopover(null);
      onCommentAdded?.();
    }}
  />
)}
```

**Step 9: Wire handlers into `AgGridReact`**

Add to the `AgGridReact` component in the JSX:
```tsx
<AgGridReact
  ...existing props...
  onCellContextMenu={handleCellContextMenu}
  onCellClicked={handleCellClicked}
  preventDefaultOnContextMenu
/>
```

**Step 10: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

Expected: no TypeScript errors.

**Step 11: Commit**

```bash
git add src/components/OtbGrid.tsx
git commit -m "feat: wire commentMap, context menu, and triangle click into OtbGrid"
```

---

## Task 8: Grid page — fetch comments, build commentMap, pass props

**Files:**
- Modify: `src/app/cycles/[cycleId]/grid/page.tsx`

**Step 1: Add imports**

Add to existing imports at the top of the file:
```typescript
import { buildCommentMap } from '@/lib/cellComments';
import type { OtbComment } from '@/types/otb';
```

**Step 2: Add `comments` state**

Add alongside other `useState` calls:
```typescript
const [comments, setComments] = useState<OtbComment[]>([]);
```

**Step 3: Fetch comments in `fetchGridData`**

The existing `fetchGridData` already fetches cycle data and plan data in parallel. Add comments to the same `Promise.all`:

```typescript
const [cycleData, planData, commentsData] = await Promise.all([
  fetch(`/api/cycles/${cycleId}`).then(r => r.json()),
  fetch(`/api/cycles/${cycleId}/plan-data`).then(r => r.json()),
  fetch(`/api/cycles/${cycleId}/comments`).then(r => r.json()).catch(() => []),
]);
// ... existing processing ...
setComments(Array.isArray(commentsData) ? commentsData : []);
```

**Step 4: Build `commentMap` via `useMemo`**

Add after the existing state declarations:
```typescript
const commentMap = useMemo(() => buildCommentMap(comments), [comments]);
```

**Step 5: Add `refreshComments` callback**

```typescript
const refreshComments = useCallback(async () => {
  try {
    const res = await fetch(`/api/cycles/${cycleId}/comments`);
    if (res.ok) setComments(await res.json());
  } catch {
    // non-critical — silently ignore
  }
}, [cycleId]);
```

**Step 6: Pass new props to `OtbGrid`**

Find the `<OtbGrid ...>` element and add:
```tsx
<OtbGrid
  ...existing props...
  commentMap={commentMap}
  cycleId={cycleId}
  userRole={profile?.role}
  onCommentAdded={refreshComments}
/>
```

Also add `userRole` to `OtbGridProps` if not already done in Task 7 Step 6.

**Step 7: Verify build and run dev server to sanity-check**

```bash
npm run build 2>&1 | grep -E "error TS" | head -20
```

Then start dev and open a cycle grid, right-click a data cell, confirm context menu appears.

```bash
npm run dev
```

**Step 8: Commit**

```bash
git add src/app/cycles/[cycleId]/grid/page.tsx
git commit -m "feat: fetch comments, build commentMap, pass to OtbGrid"
```

---

## Task 9: Integration tests for comments API

**Files:**
- Modify: `tests/integration/comments.test.ts` (add new cases)

**Step 1: Add test cases**

Add to the existing test file `tests/integration/comments.test.ts`:

```typescript
it('rejects comment_type brand after migration', async () => {
  const res = await request(app)
    .post(`/api/cycles/${testCycleId}/comments`)
    .send({ text: 'hello', comment_type: 'brand' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/comment_type must be one of/);
});

it('metric comment succeeds with month and field (no row_id)', async () => {
  const res = await request(app)
    .post(`/api/cycles/${testCycleId}/comments`)
    .send({ text: 'NSQ too high', comment_type: 'metric', month: '2026-04-01', field: 'nsq' });
  expect(res.status).toBe(201);
  expect(res.body.comment_type).toBe('metric');
  expect(res.body.field).toBe('nsq');
});

it('metric comment fails without month', async () => {
  const res = await request(app)
    .post(`/api/cycles/${testCycleId}/comments`)
    .send({ text: 'NSQ too high', comment_type: 'metric', field: 'nsq' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/month and field/);
});
```

**Step 2: Run unit tests**

```bash
npx vitest run tests/unit/cellComments.test.ts 2>&1 | tail -5
```

Expected: all PASS.

**Step 3: Final build check**

```bash
npm run build 2>&1 | grep -E "error" | head -10
```

Expected: clean build.

**Step 4: Final commit**

```bash
git add tests/integration/comments.test.ts
git commit -m "test: add integration tests for brand removal and metric comment API"
```
