# OTB Grid UX Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the side-by-side 3-month grid with month tabs (one month visible at a time) and add color-coded headers/cells to distinguish Reference (gray), GD Inputs (blue), and Calculated (green) column sections.

**Architecture:** All changes are in `src/components/OtbGrid.tsx` plus a new `src/components/OtbGrid.css`. Add `activeMonth` state inside `OtbGrid`; render Ant Design `Tabs` above the grid; build `columnDefs` for only the active month; apply `headerClass` (CSS) and `cellStyle` (inline) for color coding. The parent `grid/page.tsx` is unchanged.

**Tech Stack:** React `useState`, Ant Design `Tabs` + `Badge`, AG Grid Community 35 (`headerClass`, `cellStyle`), plain CSS module file.

---

### Task 1: Add `activeMonth` state and month tabs

**Files:**
- Modify: `src/components/OtbGrid.tsx`
- Create: `src/components/OtbGrid.css`

**Context:**  
`OtbGrid` currently imports from `react` (`useMemo, useRef, useCallback, forwardRef, useImperativeHandle`) and from `antd` (`Button`). The `months` prop is a `string[]` of ISO date strings like `"2026-04-01"`. The existing `monthLabel()` helper converts these to display strings like `"Apr 26"`.

**Step 1: Add `useState` to the React import and `Tabs` + `Badge` to the Ant Design import**

In `src/components/OtbGrid.tsx`, change:
```typescript
import { useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
// ...
import { Button } from 'antd';
```
to:
```typescript
import { useMemo, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
// ...
import { Button, Tabs, Badge } from 'antd';
```

**Step 2: Add a helper to count pending suggestions per month**

Add this function after the existing `recentMonthLabel` function (around line 99):
```typescript
function suggestionsForMonth(pendingSuggestions: Map<string, number> | undefined, month: string): number {
  if (!pendingSuggestions) return 0;
  let count = 0;
  for (const key of pendingSuggestions.keys()) {
    if (key.endsWith(`|${month}`)) count++;
  }
  return count;
}
```

**Step 3: Add `activeMonth` state inside the `OtbGrid` component**

Inside the component function body, after `const flatRows = useMemo(...)`, add:
```typescript
const sortedMonths = useMemo(() => [...months].sort(), [months]);
const [activeMonth, setActiveMonth] = useState<string>(() => sortedMonths[0] ?? '');

// Keep activeMonth valid if months prop changes (e.g. on data reload)
// If the current activeMonth is no longer in sortedMonths, reset to first
const validActiveMonth = sortedMonths.includes(activeMonth) ? activeMonth : (sortedMonths[0] ?? '');
```

**Step 4: Build the tab items array**

After the `validActiveMonth` line:
```typescript
const tabItems = sortedMonths.map(month => ({
  key: month,
  label: (
    <Badge
      count={suggestionsForMonth(pendingSuggestions, month)}
      size="small"
      offset={[6, -2]}
      style={{ backgroundColor: '#1677ff' }}
    >
      <span style={{ paddingRight: suggestionsForMonth(pendingSuggestions, month) > 0 ? 8 : 0 }}>
        {monthLabel(month)}
      </span>
    </Badge>
  ),
}));
```

**Step 5: Update the JSX to render tabs above the grid**

Currently the return statement is:
```tsx
return (
  <div style={{ width: '100%', height: 'calc(100vh - 140px)' }} onPaste={handlePaste}>
    <AgGridReact ... />
  </div>
);
```

Change it to:
```tsx
return (
  <div style={{ width: '100%' }} onPaste={handlePaste}>
    <Tabs
      activeKey={validActiveMonth}
      onChange={setActiveMonth}
      items={tabItems}
      size="small"
      style={{ marginBottom: 0, paddingLeft: 4 }}
    />
    <div style={{ height: 'calc(100vh - 188px)' }}>
      <AgGridReact
        ref={gridRef}
        rowData={flatRows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        animateRows={false}
        getRowId={(params) => params.data.id}
        onCellValueChanged={(event) => {
          if (!onCellValueChanged || !event.colDef.field) return;
          const field = event.colDef.field;
          const month = field.substring(0, 10);
          const fieldName = field.substring(11);
          onCellValueChanged({
            rowId: event.data.id,
            month,
            field: fieldName,
            value: Number(event.newValue),
          });
        }}
      />
    </div>
  </div>
);
```

**Step 6: Create `src/components/OtbGrid.css` (empty for now — will be filled in Task 3)**

Create the file with just a comment:
```css
/* OtbGrid column section color coding */
```

**Step 7: Import the CSS file at the top of OtbGrid.tsx**

After the existing imports:
```typescript
import './OtbGrid.css';
```

**Step 8: Compile check**
```bash
cd "/Users/madan.m2/Desktop/Claude Projects/OTB Automation/otb-automation" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors (or only errors about `columnDefs` referencing `months` which we fix in Task 2).

**Step 9: Commit**
```bash
cd "/Users/madan.m2/Desktop/Claude Projects/OTB Automation/otb-automation" && git add src/components/OtbGrid.tsx src/components/OtbGrid.css && git commit -m "feat: add month tabs to OtbGrid with pending suggestion badge"
```

---

### Task 2: Restrict `columnDefs` to the active month only

**Files:**
- Modify: `src/components/OtbGrid.tsx`

**Context:**  
Currently `columnDefs` is a `useMemo` that maps over all `months` and creates one top-level group per month (`headerName: "Apr 26"`, containing Reference/GD Inputs/Calculated sub-groups). We need to change it to build columns for only `validActiveMonth`, without the outer month wrapper group. The result is a flat 2-level hierarchy: Reference → columns, GD Inputs → columns, Calculated → columns.

**Step 1: Change the `columnDefs` useMemo to use `validActiveMonth` only**

Find the current `columnDefs` useMemo (starts at `const columnDefs = useMemo(...)`). Replace the `monthGroups` section entirely:

**Before** (the whole `monthGroups` block + return):
```typescript
const monthGroups: ColGroupDef[] = months.map(month => {
  const prefix = month;
  const isLocked = false;

  const refCols: ColDef[] = [ ... ];
  const gdCols: ColDef[] = [ ... ];
  const calcCols: ColDef[] = [ ... ];

  return {
    headerName: monthLabel(month) + (isLocked ? ' 🔒' : ''),
    children: [
      { headerName: 'Reference', children: refCols },
      { headerName: 'GD Inputs', children: gdCols },
      { headerName: 'Calculated', children: calcCols },
    ],
  };
});

// ... recentSalesGroup ...

return [...dimCols, recentSalesGroup, ...monthGroups];
```

**After** — build for `validActiveMonth` only, no outer month group:
```typescript
const month = validActiveMonth;
const prefix = month;
const isLocked = false; // TODO: restore lockedMonths[month] === true

const refCols: ColDef[] = [
  { field: `${prefix}_opening_stock_qty`, headerName: 'Op. Stock', valueFormatter: qtyFormatter, width: 95 },
  { field: `${prefix}_asp`, headerName: 'ASP', valueFormatter: currencyFormatter, width: 95 },
  { field: `${prefix}_cogs`, headerName: 'COGS', valueFormatter: currencyFormatter, width: 90 },
  { field: `${prefix}_ly_sales_nsq`, headerName: 'LY NSQ', valueFormatter: qtyFormatter, width: 95 },
  { field: `${prefix}_standard_doh`, headerName: 'Std DoH', valueFormatter: qtyFormatter, width: 80 },
];

const gdCols: ColDef[] = [
  {
    field: `${prefix}_nsq`,
    headerName: 'NSQ',
    editable: editable && !isLocked,
    valueFormatter: qtyFormatter,
    width: 85,
    cellStyle: isLocked ? { backgroundColor: '#f5f5f5' } : undefined,
  },
  {
    field: `${prefix}_inwards_qty`,
    headerName: 'Inwards',
    editable: editable && !isLocked,
    valueFormatter: qtyFormatter,
    width: 85,
    cellStyle: isLocked ? { backgroundColor: '#f5f5f5' } : undefined,
  },
  {
    colId: `${prefix}_inwards_qty_suggested_col`,
    headerName: 'Sugg. Inwards',
    editable: false,
    width: 110,
    valueGetter: (p: any) => pendingSuggestions?.get(`${p.data.id}|${month}`) ?? null,
    valueFormatter: qtyFormatter,
    cellRenderer: (cellParams: any) => {
      const sug: number | null = pendingSuggestions?.get(`${cellParams.data.id}|${month}`) ?? null;
      if (sug == null) return <span style={{ color: '#bbb' }}>−</span>;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
          <span style={{ color: '#1677ff', fontStyle: 'italic' }}>{sug.toLocaleString('en-IN')}</span>
          {editable && (
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined />}
              onClick={e => {
                e.stopPropagation();
                onCellValueChanged?.({ rowId: cellParams.data.id, month, field: 'inwards_qty', value: sug });
              }}
              style={{ color: '#52c41a', padding: '0 2px', minWidth: 'unset' }}
              title="Accept suggestion"
            />
          )}
        </div>
      );
    },
  },
];

const calcCols: ColDef[] = [
  { field: `${prefix}_sales_plan_gmv`, headerName: 'GMV', valueFormatter: croreFormatter, width: 90 },
  { field: `${prefix}_goly_pct`, headerName: 'GOLY%', valueFormatter: pctFormatter, width: 80 },
  { field: `${prefix}_nsv`, headerName: 'NSV', valueFormatter: croreFormatter, width: 90 },
  { field: `${prefix}_inwards_val_cogs`, headerName: 'Inw Val', valueFormatter: croreFormatter, width: 90 },
  { field: `${prefix}_opening_stock_val`, headerName: 'Op. Stock Val', valueFormatter: croreFormatter, width: 105 },
  { field: `${prefix}_closing_stock_qty`, headerName: 'Cl. Stock', valueFormatter: qtyFormatter, width: 90 },
  { field: `${prefix}_fwd_30day_doh`, headerName: 'Fwd DoH', valueFormatter: qtyFormatter, width: 85 },
  { field: `${prefix}_gm_pct`, headerName: 'GM%', valueFormatter: pctFormatter, width: 75 },
  { field: `${prefix}_gross_margin`, headerName: 'Gross Margin', valueFormatter: croreFormatter, width: 105 },
];

const recentSalesGroup: ColGroupDef = {
  headerName: 'Recent Sales (3M)',
  openByDefault: false,
  children: [
    {
      field: 'recent_sales_total',
      headerName: 'Total',
      columnGroupShow: 'closed',
      valueFormatter: qtyFormatter,
      width: 90,
    },
    ...months.map(m => ({
      field: `${m}_recent_sales_nsq`,
      headerName: recentMonthLabel(m),
      columnGroupShow: 'open' as const,
      valueFormatter: qtyFormatter,
      width: 85,
    })),
  ],
};

const activeMonthGroup: ColGroupDef[] = [
  { headerName: 'Reference', children: refCols },
  { headerName: 'GD Inputs', children: gdCols },
  { headerName: 'Calculated', children: calcCols },
];

return [...dimCols, recentSalesGroup, ...activeMonthGroup];
```

**Step 2: Update the `useMemo` dependency array**

Change:
```typescript
}, [months, editable, lockedMonths, onCellValueChanged, pendingSuggestions]);
```
To:
```typescript
}, [validActiveMonth, months, editable, lockedMonths, onCellValueChanged, pendingSuggestions]);
```

**Step 3: Compile check**
```bash
cd "/Users/madan.m2/Desktop/Claude Projects/OTB Automation/otb-automation" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

**Step 4: Commit**
```bash
cd "/Users/madan.m2/Desktop/Claude Projects/OTB Automation/otb-automation" && git add src/components/OtbGrid.tsx && git commit -m "feat: show single active month columns in OtbGrid via tab state"
```

---

### Task 3: Color coding — CSS classes for group headers + cell styles

**Files:**
- Modify: `src/components/OtbGrid.css`
- Modify: `src/components/OtbGrid.tsx`

**Context:**  
AG Grid applies a `headerClass` value as a CSS class directly on the `.ag-header-group-cell` element for column group headers. Individual column header cells get `headerClass` on `.ag-header-cell`. Cell backgrounds use `cellStyle` inline on each `ColDef`.

Color scheme from the design:
- Reference: header `#f0f0f0`, header text `#595959`, cell `#fafafa`
- GD Inputs: header `#e6f4ff`, header text `#0958d9`, cell `#ffffff` (no change, default white)
- Calculated: header `#f6ffed`, header text `#389e0d`, cell `#f9fff6`

**Step 1: Fill in `src/components/OtbGrid.css`**

Replace the file contents with:
```css
/* OtbGrid column section color coding */

/* Group header backgrounds */
.otb-ref-header .ag-header-group-cell-label,
.otb-ref-header {
  background-color: #f0f0f0 !important;
  color: #595959 !important;
}

.otb-gd-header .ag-header-group-cell-label,
.otb-gd-header {
  background-color: #e6f4ff !important;
  color: #0958d9 !important;
}

.otb-calc-header .ag-header-group-cell-label,
.otb-calc-header {
  background-color: #f6ffed !important;
  color: #389e0d !important;
}

/* Individual column headers — match their section */
.otb-ref-col-header {
  background-color: #f0f0f0 !important;
  color: #595959 !important;
}

.otb-gd-col-header {
  background-color: #e6f4ff !important;
  color: #0958d9 !important;
  font-weight: 600 !important;
}

.otb-calc-col-header {
  background-color: #f6ffed !important;
  color: #389e0d !important;
}
```

**Step 2: Add `headerClass` to column group definitions**

In `OtbGrid.tsx`, in the `columnDefs` useMemo, update the three section groups:

```typescript
const activeMonthGroup: ColGroupDef[] = [
  { headerName: 'Reference', headerClass: 'otb-ref-header', children: refCols },
  { headerName: 'GD Inputs', headerClass: 'otb-gd-header', children: gdCols },
  { headerName: 'Calculated', headerClass: 'otb-calc-header', children: calcCols },
];
```

**Step 3: Add `headerClass` and `cellStyle` to `refCols`**

Update each ColDef in `refCols` to add `headerClass` and `cellStyle`:
```typescript
const refCols: ColDef[] = [
  { field: `${prefix}_opening_stock_qty`, headerName: 'Op. Stock', headerClass: 'otb-ref-col-header', cellStyle: { backgroundColor: '#fafafa' }, valueFormatter: qtyFormatter, width: 95 },
  { field: `${prefix}_asp`, headerName: 'ASP', headerClass: 'otb-ref-col-header', cellStyle: { backgroundColor: '#fafafa' }, valueFormatter: currencyFormatter, width: 95 },
  { field: `${prefix}_cogs`, headerName: 'COGS', headerClass: 'otb-ref-col-header', cellStyle: { backgroundColor: '#fafafa' }, valueFormatter: currencyFormatter, width: 90 },
  { field: `${prefix}_ly_sales_nsq`, headerName: 'LY NSQ', headerClass: 'otb-ref-col-header', cellStyle: { backgroundColor: '#fafafa' }, valueFormatter: qtyFormatter, width: 95 },
  { field: `${prefix}_standard_doh`, headerName: 'Std DoH', headerClass: 'otb-ref-col-header', cellStyle: { backgroundColor: '#fafafa' }, valueFormatter: qtyFormatter, width: 80 },
];
```

**Step 4: Add `headerClass` and `cellStyle` to `gdCols`**

GD Input columns get blue header class. Editable cells stay white (no `cellStyle` needed unless locked). The Sugg. Inwards column is read-only but stays in GD Inputs:
```typescript
// NSQ column — update to add headerClass
{
  field: `${prefix}_nsq`,
  headerName: 'NSQ',
  headerClass: 'otb-gd-col-header',
  editable: editable && !isLocked,
  valueFormatter: qtyFormatter,
  width: 85,
  cellStyle: isLocked ? { backgroundColor: '#f5f5f5' } : undefined,
},
// Inwards column — update to add headerClass
{
  field: `${prefix}_inwards_qty`,
  headerName: 'Inwards',
  headerClass: 'otb-gd-col-header',
  editable: editable && !isLocked,
  valueFormatter: qtyFormatter,
  width: 85,
  cellStyle: isLocked ? { backgroundColor: '#f5f5f5' } : undefined,
},
// Sugg. Inwards — update to add headerClass, remove old cellStyle, use fafafa bg
{
  colId: `${prefix}_inwards_qty_suggested_col`,
  headerName: 'Sugg. Inwards',
  headerClass: 'otb-gd-col-header',
  editable: false,
  width: 110,
  cellStyle: { backgroundColor: '#f0f7ff' }, // slightly tinted to show it's read-only
  valueGetter: (p: any) => pendingSuggestions?.get(`${p.data.id}|${month}`) ?? null,
  valueFormatter: qtyFormatter,
  cellRenderer: (cellParams: any) => { /* unchanged */ },
},
```

**Step 5: Add `headerClass` and `cellStyle` to `calcCols`**

```typescript
const calcCols: ColDef[] = [
  { field: `${prefix}_sales_plan_gmv`, headerName: 'GMV', headerClass: 'otb-calc-col-header', cellStyle: { backgroundColor: '#f9fff6' }, valueFormatter: croreFormatter, width: 90 },
  { field: `${prefix}_goly_pct`, headerName: 'GOLY%', headerClass: 'otb-calc-col-header', cellStyle: { backgroundColor: '#f9fff6' }, valueFormatter: pctFormatter, width: 80 },
  { field: `${prefix}_nsv`, headerName: 'NSV', headerClass: 'otb-calc-col-header', cellStyle: { backgroundColor: '#f9fff6' }, valueFormatter: croreFormatter, width: 90 },
  { field: `${prefix}_inwards_val_cogs`, headerName: 'Inw Val', headerClass: 'otb-calc-col-header', cellStyle: { backgroundColor: '#f9fff6' }, valueFormatter: croreFormatter, width: 90 },
  { field: `${prefix}_opening_stock_val`, headerName: 'Op. Stock Val', headerClass: 'otb-calc-col-header', cellStyle: { backgroundColor: '#f9fff6' }, valueFormatter: croreFormatter, width: 105 },
  { field: `${prefix}_closing_stock_qty`, headerName: 'Cl. Stock', headerClass: 'otb-calc-col-header', cellStyle: { backgroundColor: '#f9fff6' }, valueFormatter: qtyFormatter, width: 90 },
  { field: `${prefix}_fwd_30day_doh`, headerName: 'Fwd DoH', headerClass: 'otb-calc-col-header', cellStyle: { backgroundColor: '#f9fff6' }, valueFormatter: qtyFormatter, width: 85 },
  { field: `${prefix}_gm_pct`, headerName: 'GM%', headerClass: 'otb-calc-col-header', cellStyle: { backgroundColor: '#f9fff6' }, valueFormatter: pctFormatter, width: 75 },
  { field: `${prefix}_gross_margin`, headerName: 'Gross Margin', headerClass: 'otb-calc-col-header', cellStyle: { backgroundColor: '#f9fff6' }, valueFormatter: croreFormatter, width: 105 },
];
```

**Step 6: Compile check**
```bash
cd "/Users/madan.m2/Desktop/Claude Projects/OTB Automation/otb-automation" && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

**Step 7: Run existing tests**
```bash
cd "/Users/madan.m2/Desktop/Claude Projects/OTB Automation/otb-automation" && npx vitest run 2>&1 | tail -10
```
Expected: same pass count as before (185 unit tests).

**Step 8: Commit**
```bash
cd "/Users/madan.m2/Desktop/Claude Projects/OTB Automation/otb-automation" && git add src/components/OtbGrid.tsx src/components/OtbGrid.css && git commit -m "feat: color-coded Reference/GD Inputs/Calculated column sections in grid"
```

---

### Task 4: Manual smoke test

**Step 1: Start dev server**
```bash
cd "/Users/madan.m2/Desktop/Claude Projects/OTB Automation/otb-automation" && npm run dev
```

**Step 2: Open the OTB grid**

Navigate to `localhost:3000/cycles/<any-filling-cycle-id>/grid`.

**Step 3: Verify tabs**

- Three tabs visible: "Apr 26", "May 26", "Jun 26"
- Default tab is the first month (Apr 26)
- Only ~17 columns visible (Reference + GD Inputs + Calculated for Apr), not 51
- Recent Sales (3M) group still visible and collapsible

**Step 4: Verify color coding**

- "Reference" group header and its 5 column headers: gray background (#f0f0f0), cells slightly gray (#fafafa)
- "GD Inputs" group header and its 3 column headers: blue background (#e6f4ff), cells white
- "Calculated" group header and its 9 column headers: green background (#f6ffed), cells light green (#f9fff6)

**Step 5: Verify tab switching**

- Click "May 26" tab → same color-coded layout but for May data
- Click "Jun 26" → June data
- Filters applied to rows carry over across tabs

**Step 6: Verify editing still works**

- Type a value in the NSQ cell for any row — cell becomes editable, value saves
- Suggested Inwards column still shows suggestion badge and accept button if NSQ > 0

**Step 7: Verify Accept Suggestions badge**

- If there are pending suggestions: tab badge shows correct per-month count
- "Accept Suggestions (N)" toolbar button reflects total across all months

**Step 8: Final commit if any tweaks needed**
```bash
cd "/Users/madan.m2/Desktop/Claude Projects/OTB Automation/otb-automation" && git add -A && git commit -m "feat: OTB grid UX redesign — month tabs + color-coded columns complete"
```
