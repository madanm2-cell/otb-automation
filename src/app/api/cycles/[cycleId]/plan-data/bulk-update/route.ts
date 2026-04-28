import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { calculateAll } from '@/lib/formulaEngine';
import { getLockedMonths } from '@/lib/monthLockout';
import type { BulkUpdateItem } from '@/types/otb';
import { logAudit, getClientIp } from '@/lib/auth/auditLogger';

type Params = { params: Promise<{ cycleId: string }> };

// POST /api/cycles/:cycleId/plan-data/bulk-update
export const POST = withAuth('edit_otb', async (req, auth, { params }: Params) => {
  const { cycleId } = await params;
  const body = await req.json();
  const updates: BulkUpdateItem[] = body.updates;

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Verify cycle status
  const { data: cycle } = await supabase
    .from('otb_cycles')
    .select('status, planning_period_start, planning_period_end, brand_id')
    .eq('id', cycleId)
    .single();

  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  if (cycle.status !== 'Filling') {
    return NextResponse.json({ error: `Cannot edit cycle in ${cycle.status} status` }, { status: 400 });
  }

  // Non-admin brand-scoping check
  if (auth.profile.role !== 'Admin') {
    if (!auth.profile.assigned_brands || !auth.profile.assigned_brands.includes(cycle.brand_id)) {
      return NextResponse.json({ error: 'You are not assigned to this brand' }, { status: 403 });
    }
  }

  // Get all months for lockout check
  const allMonths = getMonthsInRange(cycle.planning_period_start, cycle.planning_period_end);
  const lockedMonths = getLockedMonths(allMonths);

  // Check for locked month edits
  const lockedEdits = updates.filter(u => lockedMonths[u.month]);
  if (lockedEdits.length > 0) {
    return NextResponse.json({
      error: `Cannot edit locked months: ${[...new Set(lockedEdits.map(u => u.month))].join(', ')}`,
    }, { status: 400 });
  }

  // Get affected row IDs
  const rowIds = [...new Set(updates.map(u => u.rowId))];

  // Fetch current plan data for all affected rows (all months, for chaining)
  const { data: planDataRows } = await supabase
    .from('otb_plan_data')
    .select('*')
    .in('row_id', rowIds)
    .order('month');

  if (!planDataRows) {
    return NextResponse.json({ error: 'Failed to fetch plan data' }, { status: 500 });
  }

  // Group by row_id → month
  const dataMap = new Map<string, Map<string, Record<string, unknown>>>();
  for (const d of planDataRows) {
    const rowId = d.row_id as string;
    if (!dataMap.has(rowId)) dataMap.set(rowId, new Map());
    dataMap.get(rowId)!.set(d.month as string, d);
  }

  // Apply updates
  for (const update of updates) {
    const rowMonths = dataMap.get(update.rowId);
    if (!rowMonths) continue;
    const monthData = rowMonths.get(update.month);
    if (!monthData) continue;

    if (update.nsq !== undefined) monthData.nsq = update.nsq;
    if (update.inwards_qty !== undefined) monthData.inwards_qty = update.inwards_qty;
  }

  // Recalculate formulas for each affected row (all months, for chaining)
  const dbUpdates: { id: string; data: Record<string, unknown> }[] = [];

  for (const rowId of rowIds) {
    const rowMonths = dataMap.get(rowId);
    if (!rowMonths) continue;

    const sortedMonths = [...rowMonths.keys()].sort();

    for (let i = 0; i < sortedMonths.length; i++) {
      const month = sortedMonths[i];
      const d = rowMonths.get(month)!;

      // Month chaining: if not month 1, opening stock = previous month closing stock
      if (i > 0) {
        const prevMonth = sortedMonths[i - 1];
        const prevData = rowMonths.get(prevMonth)!;
        if (prevData.closing_stock_qty != null) {
          d.opening_stock_qty = prevData.closing_stock_qty;
        }
      }

      // Get next month's NSQ for forward DoH
      const nextMonthNsq = i < sortedMonths.length - 1
        ? (rowMonths.get(sortedMonths[i + 1])!.nsq as number | null)
        : null;

      const result = calculateAll({
        nsq: d.nsq as number | null,
        inwardsQty: d.inwards_qty as number | null,
        asp: d.asp as number | null,
        cogs: d.cogs as number | null,
        openingStockQty: d.opening_stock_qty as number | null,
        lySalesNsq: d.ly_sales_nsq as number | null,
        returnPct: d.return_pct as number | null,
        taxPct: d.tax_pct as number | null,
        nextMonthNsq,
      });

      // Update in-memory data for chaining
      d.sales_plan_gmv = result.salesPlanGmv;
      d.goly_pct = result.golyPct;
      d.nsv = result.nsv;
      d.inwards_val_cogs = result.inwardsValCogs;
      d.opening_stock_val = result.openingStockVal;
      d.closing_stock_qty = result.closingStockQty;
      d.fwd_30day_doh = result.fwd30dayDoh;
      d.gm_pct = result.gmPct;
      d.gross_margin = result.grossMargin;

      dbUpdates.push({
        id: d.id as string,
        data: {
          nsq: d.nsq,
          inwards_qty: d.inwards_qty,
          opening_stock_qty: d.opening_stock_qty,
          sales_plan_gmv: result.salesPlanGmv,
          goly_pct: result.golyPct,
          nsv: result.nsv,
          inwards_val_cogs: result.inwardsValCogs,
          opening_stock_val: result.openingStockVal,
          closing_stock_qty: result.closingStockQty,
          fwd_30day_doh: result.fwd30dayDoh,
          gm_pct: result.gmPct,
          gross_margin: result.grossMargin,
          updated_at: new Date().toISOString(),
        },
      });
    }
  }

  // Batch update DB
  for (const { id, data } of dbUpdates) {
    const { error } = await supabase.from('otb_plan_data').update(data).eq('id', id);
    if (error) {
      return NextResponse.json({ error: `Failed to update: ${error.message}` }, { status: 500 });
    }
  }

  // Create version snapshot
  try {
    // Get current max version
    const { data: latestVersion } = await supabase
      .from('version_history')
      .select('version_number')
      .eq('cycle_id', cycleId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (latestVersion?.version_number ?? 0) + 1;

    // Build snapshot from affected rows
    const snapshot = rowIds.map(rowId => {
      const rowMonths = dataMap.get(rowId);
      if (!rowMonths) return null;
      return {
        rowId,
        months: Object.fromEntries(
          [...rowMonths.entries()].map(([month, data]) => [month, {
            nsq: data.nsq, inwards_qty: data.inwards_qty,
            sales_plan_gmv: data.sales_plan_gmv, closing_stock_qty: data.closing_stock_qty,
          }])
        ),
      };
    }).filter(Boolean);

    await supabase.from('version_history').insert({
      cycle_id: cycleId,
      version_number: nextVersion,
      snapshot: JSON.stringify(snapshot),
      change_summary: `Updated ${updates.length} cells across ${rowIds.length} rows`,
      created_by: auth.user.id,
    });
  } catch {
    // Version history is non-critical — don't fail the save
  }

  await logAudit({
    entityType: 'plan_data',
    entityId: cycleId,
    action: 'UPDATE',
    userId: auth.user.id,
    userEmail: auth.user.email!,
    userRole: auth.profile.role,
    details: { rows_updated: dbUpdates.length, months_affected: [...new Set(updates.map(u => u.month))] },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({
    success: true,
    updatedCount: dbUpdates.length,
  });
});

function getMonthsInRange(start: string, end: string): string[] {
  const months: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (current <= endDate) {
    months.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`
    );
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}
