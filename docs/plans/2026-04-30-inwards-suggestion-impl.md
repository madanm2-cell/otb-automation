# Inwards Suggestion from Standard DoH — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-suggest Inwards Qty from Standard DoH when NSQ is entered; GD accepts per-cell or via Accept All; suggested value persists to DB and appears in Excel export.

**Architecture:** Client-side `pendingSuggestions` map holds computed suggestions until accepted. A new `inwards_qty_suggested` DB column persists the suggestion for export. Custom AG Grid cell renderer displays suggestion in muted italic with an accept button. Formula calculations always use actual `inwards_qty` only.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), AG Grid Community 35, React, TypeScript, ExcelJS.

---

### Task 1: DB Migration — add `inwards_qty_suggested`

**Files:**
- Create: `supabase/migrations/014_inwards_qty_suggested.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/014_inwards_qty_suggested.sql
ALTER TABLE otb_plan_data ADD COLUMN IF NOT EXISTS inwards_qty_suggested NUMERIC;
```

**Step 2: Apply it**

```bash
cd otb-automation
npx supabase db reset
```
Expected: migration runs without error, `otb_plan_data` now has `inwards_qty_suggested` column.

**Step 3: Commit**

```bash
git add supabase/migrations/014_inwards_qty_suggested.sql
git commit -m "feat: add inwards_qty_suggested column to otb_plan_data"
```

---

### Task 2: Types — extend `PlanMonthData` and `BulkUpdateItem`

**Files:**
- Modify: `src/types/otb.ts`

**Step 1: Add field to `PlanMonthData`**

In `PlanMonthData`, after `inwards_qty: number | null;`, add:
```typescript
inwards_qty_suggested: number | null;
```

**Step 2: Add field to `BulkUpdateItem`**

In `BulkUpdateItem`, add:
```typescript
inwards_qty_suggested?: number | null;
```

**Step 3: Verify TypeScript compiles**

```bash
cd otb-automation
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/types/otb.ts
git commit -m "feat: add inwards_qty_suggested to PlanMonthData and BulkUpdateItem types"
```

---

### Task 3: Formula helper — `calcSuggestedInwards`

**Files:**
- Modify: `src/lib/formulaEngine.ts`
- Modify: `tests/unit/formulaEngine.test.ts` (or create if absent)

**Step 1: Write failing tests**

In `tests/unit/formulaEngine.test.ts`, add:
```typescript
import { calcSuggestedInwards } from '@/lib/formulaEngine';

describe('calcSuggestedInwards', () => {
  it('uses next month NSQ when available', () => {
    // Standard_DoH=55, nextNsq=1000, opening=800, nsq=900
    // = max(0, round(55 × 1000/30 - 800 + 900)) = max(0, round(1833 - 800 + 900)) = 1933
    expect(calcSuggestedInwards(900, 1000, 55, 800)).toBe(1933);
  });

  it('falls back to current NSQ when next month is null', () => {
    // nextNsq=null → use nsq=900
    // = max(0, round(55 × 900/30 - 800 + 900)) = max(0, round(1650 - 800 + 900)) = 1750
    expect(calcSuggestedInwards(900, null, 55, 800)).toBe(1750);
  });

  it('returns 0 when result would be negative', () => {
    // Large opening stock, small NSQ
    expect(calcSuggestedInwards(100, null, 30, 5000)).toBe(0);
  });

  it('returns null when NSQ is null', () => {
    expect(calcSuggestedInwards(null, null, 55, 800)).toBeNull();
  });

  it('returns null when standard_doh is null', () => {
    expect(calcSuggestedInwards(900, null, null, 800)).toBeNull();
  });

  it('returns null when opening_stock is null', () => {
    expect(calcSuggestedInwards(900, null, 55, null)).toBeNull();
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/formulaEngine.test.ts
```
Expected: FAIL — `calcSuggestedInwards is not a function`.

**Step 3: Implement the helper**

In `src/lib/formulaEngine.ts`, add after the existing helpers:
```typescript
// Suggested Inwards = max(0, round(Standard_DoH × NextDemand / 30 − Opening + NSQ))
// NextDemand = next month NSQ if known, else current month NSQ
export function calcSuggestedInwards(
  nsq: number | null,
  nextMonthNsq: number | null,
  standardDoh: number | null,
  openingStockQty: number | null,
): number | null {
  if (nsq == null || standardDoh == null || openingStockQty == null) return null;
  const nextDemand = (nextMonthNsq != null && nextMonthNsq > 0) ? nextMonthNsq : nsq;
  return Math.max(0, Math.round(standardDoh * nextDemand / 30 - openingStockQty + nsq));
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/formulaEngine.test.ts
```
Expected: all 6 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/formulaEngine.ts tests/unit/formulaEngine.test.ts
git commit -m "feat: add calcSuggestedInwards formula helper with tests"
```

---

### Task 4: `useFormulaEngine` — compute suggestion on NSQ change

**Files:**
- Modify: `src/hooks/useFormulaEngine.ts`

The hook's `applyChange` currently handles `nsq` and `inwards_qty` changes. We need it to also return a suggestion when NSQ changes and `inwards_qty` is null/0.

**Step 1: Update the hook signature to return suggestion**

Change the return type so callers get the suggestion alongside the updated rows:

```typescript
import { calculateAll, calcSuggestedInwards } from '@/lib/formulaEngine';

// Change return type of applyChange:
// Before: (rows, months, change) => PlanRow[]
// After:  (rows, months, change) => { rows: PlanRow[]; suggestion: { rowId: string; month: string; value: number } | null }

export function useFormulaEngine() {
  const applyChange = useCallback((
    rows: PlanRow[],
    months: string[],
    change: CellChange
  ): { rows: PlanRow[]; suggestion: { rowId: string; month: string; value: number } | null } => {
    let suggestion: { rowId: string; month: string; value: number } | null = null;

    const updatedRows = rows.map(row => {
      if (row.id !== change.rowId) return row;

      const newMonths = { ...row.months };
      for (const m of months) {
        newMonths[m] = { ...newMonths[m] };
      }

      const monthData = newMonths[change.month];
      if (!monthData) return row;

      if (change.field === 'nsq') monthData.nsq = change.value;
      else if (change.field === 'inwards_qty') monthData.inwards_qty = change.value;

      // Compute suggestion when NSQ changes and inwards is null/0
      if (change.field === 'nsq' && change.value > 0) {
        const sortedMonths = [...months].sort();
        const mIdx = sortedMonths.indexOf(change.month);
        const nextMonthNsq = mIdx < sortedMonths.length - 1
          ? (newMonths[sortedMonths[mIdx + 1]]?.nsq ?? null)
          : null;

        const suggestedVal = calcSuggestedInwards(
          change.value,
          nextMonthNsq,
          monthData.standard_doh,
          monthData.opening_stock_qty,
        );

        if (suggestedVal !== null) {
          suggestion = { rowId: change.rowId, month: change.month, value: suggestedVal };
        }
      }

      // Recalculate all months (for month chaining) — unchanged logic
      const sortedMonths = [...months].sort();
      for (let i = 0; i < sortedMonths.length; i++) {
        const m = sortedMonths[i];
        const d = newMonths[m];
        if (!d) continue;

        if (i > 0) {
          const prevData = newMonths[sortedMonths[i - 1]];
          if (prevData?.closing_stock_qty != null) {
            d.opening_stock_qty = prevData.closing_stock_qty;
          }
        }

        const nextNsq = i < sortedMonths.length - 1
          ? newMonths[sortedMonths[i + 1]]?.nsq ?? null
          : null;

        const result = calculateAll({
          nsq: d.nsq,
          inwardsQty: d.inwards_qty,
          asp: d.asp,
          cogs: d.cogs,
          openingStockQty: d.opening_stock_qty,
          lySalesNsq: d.ly_sales_nsq,
          returnPct: d.return_pct,
          taxPct: d.tax_pct,
          nextMonthNsq: nextNsq,
        });

        d.sales_plan_gmv = result.salesPlanGmv;
        d.goly_pct = result.golyPct;
        d.nsv = result.nsv;
        d.inwards_val_cogs = result.inwardsValCogs;
        d.opening_stock_val = result.openingStockVal;
        d.closing_stock_qty = result.closingStockQty;
        d.fwd_30day_doh = result.fwd30dayDoh;
        d.gm_pct = result.gmPct;
        d.gross_margin = result.grossMargin;
      }

      return { ...row, months: newMonths };
    });

    return { rows: updatedRows, suggestion };
  }, []);

  return { applyChange };
}
```

**Step 2: Fix TypeScript compile**

```bash
npx tsc --noEmit
```
Expected: errors in `grid/page.tsx` because `applyChange` return type changed. Fix in next task.

**Step 3: Commit (WIP — compile errors expected)**

```bash
git add src/hooks/useFormulaEngine.ts
git commit -m "feat: useFormulaEngine returns suggestion on NSQ change"
```

---

### Task 5: Grid page — `pendingSuggestions` state, Accept All button

**Files:**
- Modify: `src/app/cycles/[cycleId]/grid/page.tsx`

**Step 1: Add `pendingSuggestions` state**

After the existing state declarations, add:
```typescript
const [pendingSuggestions, setPendingSuggestions] = useState<Map<string, number>>(new Map());
```

**Step 2: Update `handleCellValueChanged` to handle new return type and populate suggestions**

```typescript
const handleCellValueChanged = useCallback((params: { rowId: string; month: string; field: string; value: number }) => {
  const row = rows.find(r => r.id === params.rowId);
  const oldValue = row?.months[params.month]?.[params.field as keyof typeof row.months[string]] as number | null ?? null;

  const { rows: updatedRows, suggestion } = applyChange(rows, months, params);
  setRows(updatedRows);
  setDirtyRows(prev => new Set(prev).add(params.rowId));
  setSaveStatus('idle');

  pushUndo({ rowId: params.rowId, month: params.month, field: params.field, oldValue, newValue: params.value });

  // Update pending suggestions
  setPendingSuggestions(prev => {
    const next = new Map(prev);
    const key = `${params.rowId}|${params.month}`;

    if (params.field === 'nsq') {
      const inwardsQty = row?.months[params.month]?.inwards_qty ?? null;
      if (suggestion && (inwardsQty == null || inwardsQty === 0)) {
        // Write suggestion to the row's inwards_qty_suggested
        next.set(key, suggestion.value);
      } else {
        next.delete(key);
      }
    } else if (params.field === 'inwards_qty' && params.value !== 0) {
      // GD manually entered inwards — clear suggestion for this cell
      next.delete(key);
    }
    return next;
  });
}, [applyChange, months, rows, pushUndo]);
```

**Step 3: Update `handleBulkApply` to handle new return type**

```typescript
const handleBulkApply = useCallback((changes: { rowId: string; month: string; field: string; value: number }[]) => {
  let updated = rows;
  const dirty = new Set(dirtyRows);
  for (const change of changes) {
    const { rows: next } = applyChange(updated, months, change);
    updated = next;
    dirty.add(change.rowId);
  }
  setRows(updated);
  setDirtyRows(dirty);
  setSaveStatus('idle');
}, [rows, dirtyRows, applyChange, months]);
```

**Step 4: Add `handleAcceptAll` and "Accept Suggestions" button**

Add the handler:
```typescript
const handleAcceptAll = useCallback(() => {
  const changes = Array.from(pendingSuggestions.entries()).map(([key, value]) => {
    const [rowId, month] = key.split('|');
    return { rowId, month, field: 'inwards_qty', value };
  });
  handleBulkApply(changes);
  setPendingSuggestions(new Map());
}, [pendingSuggestions, handleBulkApply]);
```

In the toolbar JSX, after the Bulk Edit button, add:
```tsx
{pendingSuggestions.size > 0 && (
  <Button
    size="small"
    type="dashed"
    onClick={handleAcceptAll}
    style={{ color: '#1677ff', borderColor: '#1677ff' }}
  >
    Accept Suggestions ({pendingSuggestions.size})
  </Button>
)}
```

**Step 5: Update `handleSave` to include `inwards_qty_suggested`**

In `handleSave`, update the updates push to include the suggestion:
```typescript
updates.push({
  rowId,
  month,
  nsq: d.nsq,
  inwards_qty: d.inwards_qty,
  inwards_qty_suggested: d.inwards_qty_suggested ?? null,
});
```

Also, when accepting a suggestion, write it back to the row's `inwards_qty_suggested`. In `handleAcceptAll`, after calling `handleBulkApply`, also update row data so `inwards_qty_suggested` is retained in DB. The bulk-update API will handle this (Task 6).

**Step 6: Pass `pendingSuggestions` to `OtbGrid`**

```tsx
<OtbGrid
  ref={otbGridRef}
  rows={rows}
  months={months}
  editable={isEditable}
  lockedMonths={lockedMonths}
  pendingSuggestions={pendingSuggestions}
  onCellValueChanged={isEditable ? handleCellValueChanged : undefined}
/>
```

**Step 7: Compile check**

```bash
npx tsc --noEmit
```
Fix any errors (OtbGrid will complain about unknown prop — fix in Task 6).

**Step 8: Commit**

```bash
git add src/app/cycles/\[cycleId\]/grid/page.tsx
git commit -m "feat: pendingSuggestions state, Accept All button in grid page"
```

---

### Task 6: `InwardsCellRenderer` — show suggestion hint with accept button

**Files:**
- Create: `src/components/InwardsCellRenderer.tsx`

**Step 1: Create the renderer**

```tsx
'use client';

import { CheckOutlined } from '@ant-design/icons';
import { Button } from 'antd';

interface Props {
  value: number | null;
  suggestedValue: number | null;
  onAccept: () => void;
}

export function InwardsCellRenderer({ value, suggestedValue, onAccept }: Props) {
  if (suggestedValue != null && (value == null || value === 0)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: '100%' }}>
        <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: 13 }}>
          {suggestedValue.toLocaleString('en-IN')}
        </span>
        <Button
          type="text"
          size="small"
          icon={<CheckOutlined />}
          onClick={e => { e.stopPropagation(); onAccept(); }}
          style={{ color: '#1677ff', padding: '0 2px', minWidth: 'unset' }}
        />
      </div>
    );
  }

  return (
    <span>{value != null ? value.toLocaleString('en-IN') : '−'}</span>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/InwardsCellRenderer.tsx
git commit -m "feat: InwardsCellRenderer with suggestion hint and accept button"
```

---

### Task 7: `OtbGrid` — wire `pendingSuggestions` and `InwardsCellRenderer`

**Files:**
- Modify: `src/components/OtbGrid.tsx`

**Step 1: Add `pendingSuggestions` to props interface**

```typescript
interface OtbGridProps {
  rows: PlanRow[];
  months: string[];
  editable?: boolean;
  lockedMonths?: Record<string, boolean>;
  pendingSuggestions?: Map<string, number>;
  onCellValueChanged?: (params: { rowId: string; month: string; field: string; value: number }) => void;
}
```

**Step 2: Import `InwardsCellRenderer`**

```typescript
import { InwardsCellRenderer } from '@/components/InwardsCellRenderer';
```

**Step 3: Add `onAcceptSuggestion` callback to `OtbGridHandle`**

```typescript
export interface OtbGridHandle {
  getFilteredRows: () => PlanRow[];
}
```
(No change needed to handle — accept is triggered via `onCellValueChanged` from the renderer.)

**Step 4: Wire renderer to Inwards column**

In `columnDefs`, update the Inwards `ColDef`:

```typescript
{
  field: `${prefix}_inwards_qty`,
  headerName: 'Inwards',
  editable: editable && !isLocked,
  valueFormatter: qtyFormatter,
  width: 110,
  cellStyle: isLocked ? { backgroundColor: '#f5f5f5' } : undefined,
  cellRenderer: editable ? (cellParams: any) => {
    const key = `${cellParams.data.id}|${prefix}`;
    const suggestedValue = pendingSuggestions?.get(key) ?? null;
    return (
      <InwardsCellRenderer
        value={cellParams.value}
        suggestedValue={suggestedValue}
        onAccept={() => {
          if (suggestedValue != null && onCellValueChanged) {
            onCellValueChanged({
              rowId: cellParams.data.id,
              month: prefix,
              field: 'inwards_qty',
              value: suggestedValue,
            });
          }
        }}
      />
    );
  } : undefined,
},
```

**Step 5: Pass `pendingSuggestions` and `onCellValueChanged` into the renderer closure**

Make sure the `columnDefs` `useMemo` dependency array includes `pendingSuggestions`:
```typescript
}, [months, editable, lockedMonths, pendingSuggestions, onCellValueChanged]);
```

**Step 6: Compile check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 7: Commit**

```bash
git add src/components/OtbGrid.tsx src/components/InwardsCellRenderer.tsx
git commit -m "feat: wire InwardsCellRenderer to Inwards column in OtbGrid"
```

---

### Task 8: API — accept `inwards_qty_suggested` in bulk-update route

**Files:**
- Modify: `src/app/api/cycles/[cycleId]/plan-data/bulk-update/route.ts`

**Step 1: Accept `inwards_qty_suggested` in the update application**

In the "Apply updates" loop (around line 77), add:
```typescript
if (update.nsq !== undefined) monthData.nsq = update.nsq;
if (update.inwards_qty !== undefined) monthData.inwards_qty = update.inwards_qty;
if (update.inwards_qty_suggested !== undefined) monthData.inwards_qty_suggested = update.inwards_qty_suggested;
```

**Step 2: Include `inwards_qty_suggested` in `dbUpdates`**

In the `dbUpdates.push` block, add to the `data` object:
```typescript
inwards_qty_suggested: d.inwards_qty_suggested ?? null,
```

**Step 3: Compile check**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/app/api/cycles/\[cycleId\]/plan-data/bulk-update/route.ts
git commit -m "feat: persist inwards_qty_suggested in bulk-update API"
```

---

### Task 9: `flattenRows` — include `inwards_qty_suggested` in flat data

**Files:**
- Modify: `src/components/OtbGrid.tsx`

In the `flattenRows` function, after `flat[\`${prefix}_inwards_qty\`] = data.inwards_qty;`, add:
```typescript
flat[`${prefix}_inwards_qty_suggested`] = data.inwards_qty_suggested;
```

This ensures the AG Grid has access to the suggested value when needed (used by the cell renderer lookup via `pendingSuggestions`, so this is for completeness/future use).

**Step 1: Compile check**

```bash
npx tsc --noEmit
```

**Step 2: Commit**

```bash
git add src/components/OtbGrid.tsx
git commit -m "feat: include inwards_qty_suggested in OtbGrid flattenRows"
```

---

### Task 10: Export — add "Suggested Inwards" column

**Files:**
- Modify: `src/lib/exportEngine.ts`
- Modify: `src/app/api/cycles/[cycleId]/export/route.ts` (CSV section)

**Step 1: Update `METRICS` in `exportEngine.ts`**

Change the per-month metrics to include Suggested Inwards after Inwards Qty:
```typescript
const METRICS = ['NSQ', 'ASP', 'GMV', 'NSV', 'COGS', 'GM%', 'Inwards Qty', 'Suggested Inwards', 'DoH'] as const;
```

**Step 2: Update data row builder in `exportEngine.ts`**

In the data row loop, update the `md` branch:
```typescript
cells.push(
  md.nsq, md.asp, md.sales_plan_gmv, md.nsv,
  md.cogs, md.gm_pct, md.inwards_qty, md.inwards_qty_suggested ?? null, md.fwd_30day_doh,
);
```
And the null branch (8 → 9 nulls):
```typescript
cells.push(null, null, null, null, null, null, null, null, null);
```

**Step 3: Update CSV section in `export/route.ts`**

The CSV METRICS constant is defined inline. Update it to match:
```typescript
const METRICS = ['NSQ', 'ASP', 'GMV', 'NSV', 'COGS', 'GM%', 'Inwards Qty', 'Suggested Inwards', 'DoH'] as const;
```
And the CSV data push:
```typescript
cells.push(
  md.nsq, md.asp, md.sales_plan_gmv, md.nsv,
  md.cogs, md.gm_pct, md.inwards_qty, (md as any).inwards_qty_suggested ?? null, md.fwd_30day_doh,
);
```

**Step 4: Compile check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/lib/exportEngine.ts src/app/api/cycles/\[cycleId\]/export/route.ts
git commit -m "feat: add Suggested Inwards column to Excel and CSV export"
```

---

### Task 11: Manual smoke test

**Step 1: Start dev server**
```bash
npm run dev
```

**Step 2: Open OTB grid for a Filling cycle**

Navigate to `localhost:3000/cycles/<id>/grid`.

**Step 3: Enter NSQ for a row**

Type a non-zero NSQ value in a cell. Expected:
- Inwards cell for that row/month shows value in muted italic with a ✓ button
- "Accept Suggestions (1)" button appears in toolbar
- Closing Stock and Forward DoH remain `−` for that cell

**Step 4: Accept single suggestion**

Click ✓ in the Inwards cell. Expected:
- Inwards cell shows accepted value in normal style
- Closing Stock and Forward DoH calculate correctly
- Suggestion count in toolbar decreases

**Step 5: Accept All**

Enter NSQ for several more rows, then click "Accept Suggestions (N)". Expected:
- All Inwards cells fill with accepted values
- Toolbar button disappears
- All calculated columns populate

**Step 6: Save and reload**

Click "Save Draft". Navigate away and return. Expected:
- Inwards values persist
- No suggestions pending (clean state)

**Step 7: Export to Excel**

Click Export → Excel. Open file. Expected:
- "Suggested Inwards" column present for each month
- Values match what was shown in grid

**Step 8: Commit final**

```bash
git add -A
git commit -m "feat: inwards suggestion from Standard DoH — complete"
```
