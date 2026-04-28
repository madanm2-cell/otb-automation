'use client';

import { useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, ColGroupDef, ValueFormatterParams, GridApi } from 'ag-grid-community';
import type { PlanRow } from '@/types/otb';
import { formatCrore, formatPct, formatQty, formatCurrency } from '@/lib/formatting';

// Register AG Grid Community modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface OtbGridProps {
  rows: PlanRow[];
  months: string[];
  editable?: boolean;
  lockedMonths?: Record<string, boolean>;
  onCellValueChanged?: (params: { rowId: string; month: string; field: string; value: number }) => void;
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

    return flat;
  });
}

function monthLabel(month: string): string {
  const d = new Date(month + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

const croreFormatter = (p: ValueFormatterParams) => formatCrore(p.value);
const pctFormatter = (p: ValueFormatterParams) => formatPct(p.value);
const qtyFormatter = (p: ValueFormatterParams) => formatQty(p.value);
const currencyFormatter = (p: ValueFormatterParams) => formatCurrency(p.value);

// Fields that GD can edit (used for paste mapping)
const GD_FIELDS = ['nsq', 'inwards_qty'];

export default function OtbGrid({ rows, months, editable = false, lockedMonths = {}, onCellValueChanged }: OtbGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  const flatRows = useMemo(() => flattenRows(rows, months), [rows, months]);

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
    const sortedMonths = [...months].sort();
    const monthStartIdx = sortedMonths.indexOf(focusedMonth);
    if (monthStartIdx === -1) return;

    // Build target columns: iterate months × GD fields from focus point
    const targetCols: { month: string; field: string }[] = [];
    for (let mi = monthStartIdx; mi < sortedMonths.length; mi++) {
      const startField = mi === monthStartIdx ? gdFieldStartIdx : 0;
      for (let fi = startField; fi < GD_FIELDS.length; fi++) {
        targetCols.push({ month: sortedMonths[mi], field: GD_FIELDS[fi] });
      }
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
        if (lockedMonths[month]) continue;

        const val = parseFloat(pastedRows[r][c]);
        if (isNaN(val)) continue;

        onCellValueChanged({ rowId, month, field, value: val });
      }
    }
  }, [editable, onCellValueChanged, months, lockedMonths]);

  const columnDefs = useMemo((): (ColDef | ColGroupDef)[] => {
    // Dimension columns — all visible, pinned left, using Community text filter
    const dimCols: ColDef[] = [
      { field: 'sub_brand', headerName: 'Sub Brand', pinned: 'left', width: 130 },
      { field: 'sub_category', headerName: 'Sub Category', pinned: 'left', width: 120 },
      { field: 'wear_type', headerName: 'Wear Type', pinned: 'left', width: 100 },
      { field: 'gender', headerName: 'Gender', pinned: 'left', width: 80 },
      { field: 'channel', headerName: 'Channel', pinned: 'left', width: 140 },
    ];

    // Per-month column groups
    const monthGroups: ColGroupDef[] = months.map(month => {
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

      return {
        headerName: monthLabel(month) + (isLocked ? ' 🔒' : ''),
        children: [
          { headerName: 'Reference', children: refCols },
          { headerName: 'GD Inputs', children: gdCols },
          { headerName: 'Calculated', children: calcCols },
        ],
      };
    });

    return [...dimCols, ...monthGroups];
  }, [months, editable, lockedMonths]);

  const defaultColDef = useMemo((): ColDef => ({
    sortable: true,
    filter: true,
    resizable: true,
    suppressMovable: true,
  }), []);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 140px)' }} onPaste={handlePaste}>
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
          // Parse "2026-01-01_nsq" → month + field name
          const parts = field.split('_');
          const month = parts[0]; // "2026-01-01"
          const fieldName = parts.slice(1).join('_'); // "nsq", "inwards_qty", etc.
          onCellValueChanged({
            rowId: event.data.id,
            month,
            field: fieldName,
            value: Number(event.newValue),
          });
        }}
      />
    </div>
  );
}
