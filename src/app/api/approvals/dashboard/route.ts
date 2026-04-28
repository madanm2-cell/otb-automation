import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getRiskFlags, getHighestRiskLevel } from '@/lib/riskIndicators';
import type { CycleMetrics } from '@/lib/riskIndicators';

// GET /api/approvals/dashboard — aggregated approval dashboard data
export const GET = withAuth('approve_otb', async (req, auth) => {
  const supabase = await createServerClient();

  // Get active cycles
  let cycleQuery = supabase
    .from('otb_cycles')
    .select('*, brands(name)')
    .in('status', ['Filling', 'InReview', 'Approved']);

  if (auth.profile.role !== 'Admin' && auth.profile.assigned_brands?.length > 0) {
    cycleQuery = cycleQuery.in('brand_id', auth.profile.assigned_brands);
  }

  const brandId = req.nextUrl.searchParams.get('brandId');
  if (brandId) {
    cycleQuery = cycleQuery.eq('brand_id', brandId);
  }

  const { data: cycles, error: cyclesError } = await cycleQuery;
  if (cyclesError) return NextResponse.json({ error: cyclesError.message }, { status: 500 });

  // Get approval records for all cycles
  const cycleIds = (cycles || []).map(c => c.id);
  let approvalRecords: any[] = [];
  if (cycleIds.length > 0) {
    const { data } = await supabase
      .from('approval_tracking')
      .select('*')
      .in('cycle_id', cycleIds);
    approvalRecords = data || [];
  }

  // Build per-cycle summary
  const brandSummaries = (cycles || []).map(cycle => {
    const cycleApprovals = approvalRecords.filter(r => r.cycle_id === cycle.id);
    const approvedCount = cycleApprovals.filter(r => r.status === 'Approved').length;
    const pendingCount = cycleApprovals.filter(r => r.status === 'Pending').length;
    const revisionCount = cycleApprovals.filter(r => r.status === 'RevisionRequested').length;

    // Risk indicators — metrics will be null until plan data is aggregated
    const metrics: CycleMetrics = {
      avgDoh: null,
      gmPct: null,
      categoryAvgGmPct: null,
      totalInwardsQty: null,
      lyTotalInwardsQty: null,
    };
    const riskFlags = getRiskFlags(metrics);
    const riskLevel = getHighestRiskLevel(riskFlags);

    return {
      cycle_id: cycle.id,
      cycle_name: cycle.cycle_name,
      brand_name: (cycle.brands as any)?.name || 'Unknown',
      brand_id: cycle.brand_id,
      status: cycle.status,
      planning_quarter: cycle.planning_quarter,
      approval_progress: { approved: approvedCount, pending: pendingCount, revision: revisionCount, total: 4 },
      risk_level: riskLevel,
      risk_flags: riskFlags,
      updated_at: cycle.updated_at,
    };
  });

  // Summary cards
  const totalCycles = brandSummaries.length;
  const pendingApproval = brandSummaries.filter(b => b.status === 'InReview').length;
  const approved = brandSummaries.filter(b => b.status === 'Approved').length;
  const filling = brandSummaries.filter(b => b.status === 'Filling').length;

  return NextResponse.json({
    summary: { totalCycles, pendingApproval, approved, filling },
    brands: brandSummaries,
  });
});
