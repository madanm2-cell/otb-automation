'use client';

import { useCallback } from 'react';
import { calculateAll } from '@/lib/formulaEngine';
import type { PlanRow } from '@/types/otb';

interface CellChange {
  rowId: string;
  month: string;
  field: string;
  value: number;
}

/**
 * Hook that applies a cell change to the rows array,
 * recalculates formulas for the affected row (all months for chaining),
 * and returns the updated rows.
 */
export function useFormulaEngine() {
  const applyChange = useCallback((
    rows: PlanRow[],
    months: string[],
    change: CellChange
  ): PlanRow[] => {
    return rows.map(row => {
      if (row.id !== change.rowId) return row;

      // Clone months data
      const newMonths = { ...row.months };
      for (const m of months) {
        newMonths[m] = { ...newMonths[m] };
      }

      // Apply the GD input change
      const monthData = newMonths[change.month];
      if (!monthData) return row;

      if (change.field === 'nsq') monthData.nsq = change.value;
      else if (change.field === 'inwards_qty') monthData.inwards_qty = change.value;

      // Recalculate all months (for month chaining)
      const sortedMonths = [...months].sort();
      for (let i = 0; i < sortedMonths.length; i++) {
        const m = sortedMonths[i];
        const d = newMonths[m];
        if (!d) continue;

        // Month chaining: M2 opening = M1 closing
        if (i > 0) {
          const prevData = newMonths[sortedMonths[i - 1]];
          if (prevData?.closing_stock_qty != null) {
            d.opening_stock_qty = prevData.closing_stock_qty;
          }
        }

        // Next month NSQ for forward DoH
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
  }, []);

  return { applyChange };
}
