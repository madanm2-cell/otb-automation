'use client';

import { useMemo, useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, ColGroupDef, ValueFormatterParams, GridApi } from 'ag-grid-community';
import { Button, Tabs, Badge } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import type { PlanRow } from '@/types/otb';
import { SelectFilter } from '@/components/SelectFilter';
import { formatCrore, formatPct, formatQty, formatCurrency } from '@/lib/formatting';
import './OtbGrid.css';

// Register AG Grid Community modules
ModuleRegistry.registerModules([AllCommunityModule]);

export interface OtbGridHandle {
  getFilteredRows: () => PlanRow[];
}

interface OtbGridProps {
  rows: PlanRow[];
  months: string[];
  editable?: boolean;
  lockedMonths?: Record<string, boolean>;
  onCellValueChanged?: (params: { rowId: string; month: string; field: string; value: number }) => void;
  pendingSuggestions?: Map<string, number>;
}

// Flatten PlanRow into a single-level object for AG Grid
interface FlatRow {
  id: string;
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  [key: string]: unknown; // month-specific fields like "2026-01-01_nsq"
}

function flattenRows(rows: PlanRow[], months: string[]): FlatRow[] {
  return rows.map(row => {
    const flat: FlatRow = {
      id: row.id,
      sub_brand: row.sub_brand,
      wear_type: row.wear_type,
      sub_category: row.sub_category,
      gender: row.gender,
      channel: row.channel,
    };

    for (const month of months) {
      const data = row.months[month];
      if (!data) continue;

      const prefix = month;
      // Reference data
      flat[`${prefix}_asp`] = data.asp;
      flat[`${prefix}_cogs`] = data.cogs;
      flat[`${prefix}_opening_stock_qty`] = data.opening_stock_qty;
      flat[`${prefix}_ly_sales_nsq`] = data.ly_sales_nsq;
      flat[`${prefix}_recent_sales_nsq`] = data.recent_sales_nsq;
      flat[`${prefix}_soft_forecast_nsq`] = data.soft_forecast_nsq;
      flat[`${prefix}_standard_doh`] = data.standard_doh;
      flat[`${prefix}_return_pct`] = data.return_pct;
      flat[`${prefix}_tax_pct`] = data.tax_pct;
      // GD inputs
      flat[`${prefix}_nsq`] = data.nsq;
      flat[`${prefix}_inwards_qty`] = data.inwards_qty;
      flat[`${prefix}_inwards_qty_suggested`] = data.inwards_qty_suggested ?? null;
      // Calculated
      flat[`${prefix}_sales_plan_gmv`] = data.sales_plan_gmv;
      flat[`${prefix}_goly_pct`] = data.goly_pct;
      flat[`${prefix}_nsv`] = data.nsv;
      flat[`${prefix}_inwards_val_cogs`] = data.inwards_val_cogs;
      flat[`${prefix}_opening_stock_val`] = data.opening_stock_val;
      flat[`${prefix}_closing_stock_qty`] = data.closing_stock_qty;
      flat[`${prefix}_fwd_30day_doh`] = data.fwd_30day_doh;
      flat[`${prefix}_gm_pct`] = data.gm_pct;
      flat[`${prefix}_gross_margin`] = data.gross_margin;
    }

    flat['recent_sales_total'] = months.reduce(
      (sum, m) => sum + (Number(row.months[m]?.recent_sales_nsq) || 0), 0
    );

    return flat;
  });
}

function monthLabel(month: string): string {
  const d = new Date(month + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

// Each planning month maps to the recent month 3 months prior (Q1 Apr→Jan, May→Feb, Jun→Mar)
function recentMonthLabel(planningMonth: string): string {
  const d = new Date(planningMonth + 'T00:00:00');
  d.setMonth(d.getMonth() - 3);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function suggestionsForMonth(pendingSuggestions: Map<string, number> | undefined, month: string): number {
  if (!pendingSuggestions) return 0;
  let count = 0;
  for (const key of pendingSuggestions.keys()) {
    if (key.endsWith(`|${month}`)) count++;
  }
  return count;
}

const croreFormatter = (p: ValueFormatterParams) => formatCrore(p.value);
const pctFormatter = (p: ValueFormatterParams) => formatPct(p.value);
const qtyFormatter = (p: ValueFormatterParams) => formatQty(p.value);
const currencyFormatter = (p: ValueFormatterParams) => formatCurrency(p.value);

// Fields that GD can edit (used for paste mapping)
const GD_FIELDS = ['nsq', 'inwards_qty'];

const OtbGrid = forwardRef<OtbGridHandle, OtbGridProps>(function OtbGrid(
  { rows, months, editable = false, lockedMonths = {}, onCellValueChanged, pendingSuggestions },
  ref
) {
  const gridRef = useRef<AgGridReact>(null);
  const flatRows = useMemo(() => flattenRows(rows, months), [rows, months]);

  const sortedMonths = useMemo(() => [...months].sort(), [months]);
  const [activeMonth, setActiveMonth] = useState<string>(() => sortedMonths[0] ?? '');

  // Keep activeMonth valid if months prop changes (e.g. on data reload)
  // If the current activeMonth is no longer in sortedMonths, reset to first
  const validActiveMonth = sortedMonths.includes(activeMonth) ? activeMonth : (sortedMonths[0] ?? '');

  useEffect(() => {
    if (!sortedMonths.includes(activeMonth) && sortedMonths.length > 0) {
      setActiveMonth(sortedMonths[0]);
    }
  }, [sortedMonths, activeMonth]);

  const tabItems = useMemo(() => sortedMonths.map(month => {
    const suggCount = suggestionsForMonth(pendingSuggestions, month);
    return {
      key: month,
      label: (
        <Badge
          count={suggCount}
          size="small"
          offset={[6, -2]}
          style={{ backgroundColor: '#1677ff' }}
        >
          <span style={{ paddingRight: suggCount > 0 ? 8 : 0 }}>
            {monthLabel(month)}
          </span>
        </Badge>
      ),
    };
  }), [sortedMonths, pendingSuggestions]);

  useImperativeHandle(ref, () => ({
    getFilteredRows() {
      const api = gridRef.current?.api;
      if (!api) return rows;
      const visibleIds = new Set<string>();
      api.forEachNodeAfterFilter(node => { if (node.data?.id) visibleIds.add(node.data.id); });
      return rows.filter(r => visibleIds.has(r.id));
    },
  }));

  // Custom paste handler for Excel copy-paste support
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!editable || !onCellValueChanged) return;

    const api: GridApi | undefined = gridRef.current?.api;
    if (!api) return;

    const focusedCell = api.getFocusedCell();
    if (!focusedCell) return;

    const clipboardText = e.clipboardData.getData('text/plain');
    if (!clipboardText) return;

    // Parse field from focused column (e.g. "2026-01-01_nsq")
    const focusedField = focusedCell.column.getColId();
    const underscoreIdx = focusedField.indexOf('_');
    if (underscoreIdx === -1) return;

    const focusedMonth = focusedField.substring(0, 10); // "2026-01-01"
    const focusedFieldName = focusedField.substring(11); // "nsq", "inwards_qty", etc.

    // Only allow paste into GD input fields
    if (!GD_FIELDS.includes(focusedFieldName)) return;

    e.preventDefault();

    // Parse TSV rows from clipboard
    const pastedRows = clipboardText.trim().split('\n').map(line =>
      line.split('\t').map(cell => cell.trim())
    );

    // Determine which columns to paste into (starting from focused GD field)
    const gdFieldStartIdx = GD_FIELDS.indexOf(focusedFieldName);
    const monthStartIdx = sortedMonths.indexOf(focusedMonth);
    if (monthStartIdx === -1) return;

    // Build target columns: clamp to active month only (non-visible months must not be mutated)
    const targetCols: { month: string; field: string }[] = [];
    const startField = gdFieldStartIdx;
    for (let fi = startField; fi < GD_FIELDS.length; fi++) {
      targetCols.push({ month: sortedMonths[monthStartIdx], field: GD_FIELDS[fi] });
    }

    // Get visible row nodes starting from focused row
    const allRowNodes: { id: string }[] = [];
    api.forEachNodeAfterFilterAndSort(node => {
      if (node.data?.id) allRowNodes.push({ id: node.data.id });
    });

    const startRowIdx = allRowNodes.findIndex(n => n.id === api.getDisplayedRowAtIndex(focusedCell.rowIndex)?.data?.id);
    if (startRowIdx === -1) return;

    // Apply pasted values
    for (let r = 0; r < pastedRows.length && (startRowIdx + r) < allRowNodes.length; r++) {
      const rowId = allRowNodes[startRowIdx + r].id;
      for (let c = 0; c < pastedRows[r].length && c < targetCols.length; c++) {
        const { month, field } = targetCols[c];
        // if (lockedMonths[month]) continue; // TODO: restore month locking

        const val = parseFloat(pastedRows[r][c]);
        if (isNaN(val)) continue;

        onCellValueChanged({ rowId, month, field, value: val });
      }
    }
  }, [editable, onCellValueChanged, sortedMonths, lockedMonths]);

  const columnDefs = useMemo((): (ColDef | ColGroupDef)[] => {
    // Dimension columns — all visible, pinned left, using checkbox select filter
    const dimCols: ColDef[] = [
      { field: 'sub_brand', headerName: 'Sub Brand', pinned: 'left', width: 130, filter: SelectFilter },
      { field: 'sub_category', headerName: 'Sub Category', pinned: 'left', width: 120, filter: SelectFilter },
      { field: 'wear_type', headerName: 'Wear Type', pinned: 'left', width: 100, filter: SelectFilter },
      { field: 'gender', headerName: 'Gender', pinned: 'left', width: 80, filter: SelectFilter },
      { field: 'channel', headerName: 'Channel', pinned: 'left', width: 140, filter: SelectFilter },
    ];

    // Single active-month column groups (no outer month wrapper)
    const month = validActiveMonth;
    const prefix = month;
    const isLocked = lockedMonths[month] === true;

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
        cellStyle: { backgroundColor: '#fafafa' },
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
  }, [validActiveMonth, months, editable, lockedMonths, onCellValueChanged, pendingSuggestions]);

  const defaultColDef = useMemo((): ColDef => ({
    sortable: true,
    filter: false,
    resizable: true,
    suppressMovable: true,
  }), []);

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
});

export default OtbGrid;
