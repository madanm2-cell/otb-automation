import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { DashboardSummaryResponse, EnhancedBrandSummary } from '@/types/otb';

const mockBrand = (overrides: Partial<EnhancedBrandSummary>): EnhancedBrandSummary => ({
  brand_id: 'b1', brand_name: 'Test', cycle_id: 'c1', cycle_name: 'Q1',
  status: 'Approved', planning_quarter: 'Q1 FY27',
  gmv: 100, nsv: 80, nsq: 50, inwards_qty: 30, avg_doh: 40, closing_stock_qty: 20,
  monthly: [], top_categories: [], has_actuals: false,
  ...overrides,
});

const mockSummary: DashboardSummaryResponse = {
  kpiTotals: { gmv: 100, nsv: 80, nsq: 50, inwards_qty: 30, avg_doh: 40, closing_stock_qty: 20 },
  brands: [
    mockBrand({ status: 'InReview', cycle_id: 'c1' }),
    mockBrand({ status: 'Approved', brand_id: 'b2', cycle_id: 'c2' }),
  ],
  months: ['2026-04-01'],
};

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn((url: string) => {
    if (url.includes('/api/summary')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) } as Response);
    }
    if (url.includes('/api/approvals/dashboard')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ summary: { totalCycles: 2, pendingApproval: 1, approved: 1, filling: 0 }, brands: [] }) } as Response);
    }
    if (url.includes('/api/cycles')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as Response);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
  }) as any;
});

describe('useDashboardData', () => {
  it('separates brands into review and approved zones', async () => {
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reviewBrands).toHaveLength(1);
    expect(result.current.reviewBrands[0].status).toBe('InReview');
    expect(result.current.approvedBrands).toHaveLength(1);
    expect(result.current.approvedBrands[0].status).toBe('Approved');
  });

  it('provides kpiTotals from API response', async () => {
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.kpiTotals?.gmv).toBe(100);
    expect(result.current.kpiTotals?.nsv).toBe(80);
  });

  it('starts with empty varianceCache', async () => {
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.varianceCache).toEqual({});
  });

  it('provides months from API response', async () => {
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.months).toEqual(['2026-04-01']);
  });

  it('computes statusDistribution from cycles', async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/summary')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) } as Response);
      }
      if (url.includes('/api/approvals/dashboard')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ summary: { totalCycles: 3, pendingApproval: 1, approved: 1, filling: 1 }, brands: [] }) } as Response);
      }
      if (url.includes('/api/cycles')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'c1', status: 'Filling' },
            { id: 'c2', status: 'Approved' },
            { id: 'c3', status: 'InReview' },
          ]),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statusDistribution.Filling).toBe(1);
    expect(result.current.statusDistribution.Approved).toBe(1);
    expect(result.current.statusDistribution.InReview).toBe(1);
    expect(result.current.statusDistribution.Draft).toBe(0);
  });

  it('sets error when all fetches fail', async () => {
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve(null) } as Response)
    );

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load dashboard data');
  });

  it('loadVariance fetches and caches variance data', async () => {
    const mockVariance = {
      cycle_id: 'c1',
      cycle_name: 'Q1',
      brand_name: 'Test',
      planning_quarter: 'Q1 FY27',
      months: ['2026-04-01'],
      rows: [],
      summary: { total_rows: 0, red_count: 0, yellow_count: 0, green_count: 0, top_variances: [] },
    };

    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Add variance endpoint to mock
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/cycles/c1/variance')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockVariance) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });

    await result.current.loadVariance('c1');
    await waitFor(() => expect(result.current.varianceCache['c1']).toBeDefined());
    expect(result.current.varianceCache['c1'].cycle_id).toBe('c1');
  });

  it('exposes a refresh function', async () => {
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refresh).toBe('function');
  });
});
