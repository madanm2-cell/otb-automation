'use client';

import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, ColGroupDef, ValueFormatterParams } from 'ag-grid-community';
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
      flat[`${prefix}_ly_sales_gmv`] = data.ly_sales_gmv;
      flat[`${prefix}_recent_sales_nsq`] = data.recent_sales_nsq;
      flat[`${prefix}_soft_forecast_nsq`] = data.soft_forecast_nsq;
      flat[`${prefix}_standard_doh`] = data.standard_doh;
      flat[`${prefix}_return_pct`] = data.return_pct;
      flat[`${prefix}_tax_pct`] = data.tax_pct;
      flat[`${prefix}_sellex_pct`] = data.sellex_pct;
      // GD inputs
      flat[`${prefix}_nsq`] = data.nsq;
      flat[`${prefix}_inwards_qty`] = data.inwards_qty;
      flat[`${prefix}_perf_marketing_pct`] = data.perf_marketing_pct;
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
      flat[`${prefix}_cm1`] = data.cm1;
      flat[`${prefix}_cm2`] = data.cm2;
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

export default function OtbGrid({ rows, months, editable = false, lockedMonths = {}, onCellValueChanged }: OtbGridProps) {
  const flatRows = useMemo(() => flattenRows(rows, months), [rows, months]);

  const columnDefs = useMemo((): (ColDef | ColGroupDef)[] => {
    // Dimension columns (row grouping)
    const dimCols: ColDef[] = [
      { field: 'sub_brand', headerName: 'Sub Brand', rowGroup: true, hide: true, width: 130 },
      { field: 'wear_type', headerName: 'Wear Type', rowGroup: true, hide: true, width: 100 },
      { field: 'sub_category', headerName: 'Sub Category', rowGroup: true, hide: true, width: 120 },
      { field: 'gender', headerName: 'Gender', rowGroup: true, hide: true, width: 80 },
      { field: 'channel', headerName: 'Channel', width: 140, pinned: 'left' },
    ];

    // Per-month column groups
    const monthGroups: ColGroupDef[] = months.map(month => {
      const prefix = month;
      const isLocked = lockedMonths[month] === true;

      const refCols: ColDef[] = [
        { field: `${prefix}_opening_stock_qty`, headerName: 'Op. Stock', valueFormatter: qtyFormatter, width: 95 },
        { field: `${prefix}_asp`, headerName: 'ASP', valueFormatter: currencyFormatter, width: 95 },
        { field: `${prefix}_cogs`, headerName: 'COGS', valueFormatter: currencyFormatter, width: 90 },
        { field: `${prefix}_ly_sales_gmv`, headerName: 'LY GMV', valueFormatter: croreFormatter, width: 95 },
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
          field: `${prefix}_perf_marketing_pct`,
          headerName: 'Perf Mktg%',
          editable: editable && !isLocked,
          valueFormatter: pctFormatter,
          width: 95,
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
        { field: `${prefix}_cm1`, headerName: 'CM1', valueFormatter: croreFormatter, width: 90 },
        { field: `${prefix}_cm2`, headerName: 'CM2', valueFormatter: croreFormatter, width: 90 },
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

  const autoGroupColumnDef = useMemo((): ColDef => ({
    headerName: 'Hierarchy',
    width: 250,
    pinned: 'left',
    cellRendererParams: {
      suppressCount: false,
    },
  }), []);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 140px)' }}>
      <AgGridReact
        rowData={flatRows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        autoGroupColumnDef={autoGroupColumnDef}
        groupDefaultExpanded={1}
        animateRows={false}
        getRowId={(params) => params.data.id}
        grandTotalRow="bottom"
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
