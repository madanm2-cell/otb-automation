'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  OtbCycle, CycleStatus, EnhancedBrandSummary,
  DashboardKpiTotals, DashboardSummaryResponse,
  VarianceReportData,
} from '@/types/otb';

interface ApprovalProgress {
  approved: number;
  pending: number;
  revision: number;
  total: number;
}

interface BrandApproval {
  cycle_id: string;
  cycle_name: string;
  brand_name: string;
  brand_id: string;
  status: CycleStatus;
  planning_quarter: string;
  approval_progress: ApprovalProgress;
  risk_level: string;
  risk_flags: Array<{ flag: string; level: string }>;
  updated_at: string;
}

interface ApprovalDashboardData {
  summary: {
    totalCycles: number;
    pendingApproval: number;
    approved: number;
    filling: number;
  };
  brands: BrandApproval[];
}

export interface DashboardData {
  loading: boolean;
  error: string | null;
  kpiTotals: DashboardKpiTotals | null;
  reviewBrands: EnhancedBrandSummary[];
  approvedBrands: EnhancedBrandSummary[];
  months: string[];
  approvals: ApprovalDashboardData | null;
  varianceCache: Record<string, VarianceReportData>;
  cycles: OtbCycle[] | null;
  statusDistribution: Record<CycleStatus, number>;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    loading: true,
    error: null,
    kpiTotals: null,
    reviewBrands: [],
    approvedBrands: [],
    months: [],
    approvals: null,
    varianceCache: {},
    cycles: null,
    statusDistribution: { Draft: 0, Active: 0, Filling: 0, InReview: 0, Approved: 0 },
  });

  const fetchData = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true, error: null }));

    const results = await Promise.allSettled([
      fetch('/api/summary').then(r => r.ok ? r.json() : null),
      fetch('/api/approvals/dashboard').then(r => r.ok ? r.json() : null),
      fetch('/api/cycles').then(r => r.ok ? r.json() : null),
    ]);

    const summary = results[0].status === 'fulfilled' ? results[0].value as DashboardSummaryResponse : null;
    const approvals = results[1].status === 'fulfilled' ? results[1].value as ApprovalDashboardData : null;
    const cycles = results[2].status === 'fulfilled' ? results[2].value as OtbCycle[] : null;

    // Zone separation
    const allBrands = summary?.brands || [];
    const reviewBrands = allBrands.filter(b => b.status === 'InReview');
    const approvedBrands = allBrands.filter(b => b.status === 'Approved');

    // Status distribution
    const statusDistribution: Record<CycleStatus, number> = { Draft: 0, Active: 0, Filling: 0, InReview: 0, Approved: 0 };
    if (cycles) {
      for (const c of cycles) {
        statusDistribution[c.status] = (statusDistribution[c.status] || 0) + 1;
      }
    }

    const allFailed = results.every(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null));

    setData(prev => ({
      ...prev,
      loading: false,
      error: allFailed ? 'Failed to load dashboard data' : null,
      kpiTotals: summary?.kpiTotals || null,
      reviewBrands,
      approvedBrands,
      months: summary?.months || [],
      approvals,
      cycles,
      statusDistribution,
    }));
  }, []);

  // Lazy-load variance for a specific cycle
  const loadVariance = useCallback(async (cycleId: string) => {
    // Check current cache via setState to avoid stale closure
    setData(prev => {
      if (prev.varianceCache[cycleId]) return prev; // already cached
      // Trigger the fetch outside setState
      fetchVariance(cycleId);
      return prev;
    });
  }, []);

  const fetchVariance = async (cycleId: string) => {
    try {
      const res = await fetch(`/api/cycles/${cycleId}/variance`);
      if (!res.ok) return;
      const variance = await res.json() as VarianceReportData;
      setData(prev => ({
        ...prev,
        varianceCache: { ...prev.varianceCache, [cycleId]: variance },
      }));
    } catch {
      // Silently fail — variance zone shows "no actuals" message
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refresh: fetchData, loadVariance };
}
