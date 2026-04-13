import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { DashboardSummaryResponse } from '@/types/otb';

// ── Mocks ────────────────────────────────────────────────────────────────

// Mock withAuth to bypass authentication — returns the handler directly
vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (_permission: string, handler: any) => {
    return (req: NextRequest) =>
      handler(req, {
        user: { id: 'u1', email: 'cxo@bewakoof.com' },
        profile: { id: 'u1', role: 'CXO', assigned_brands: ['brand-1', 'brand-2'], is_active: true },
      });
  },
}));

// Mock createServerClient — the resolved value is set per-test in setupMocks
const mockCreateServerClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: mockCreateServerClient,
}));

// Build chainable Supabase query mock
function mockChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {};
  const methods = ['select', 'eq', 'in', 'single', 'order', 'limit', 'gte', 'lte', 'is', 'neq'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Terminal: awaiting the chain resolves to {data, error}
  chain.then = (resolve: any) => resolve(resolvedValue);
  return chain;
}

let fromMocks: Record<string, ReturnType<typeof mockChain>>;

// ── Test data ────────────────────────────────────────────────────────────

const CYCLES = [
  { id: 'c1', cycle_name: 'Q1 FY27 - Bewakoof', brand_id: 'brand-1', planning_quarter: 'Q1 FY27', status: 'Approved', brands: { name: 'Bewakoof' } },
  { id: 'c2', cycle_name: 'Q1 FY27 - Urbano', brand_id: 'brand-2', planning_quarter: 'Q1 FY27', status: 'InReview', brands: { name: 'Urbano' } },
];

const PLAN_ROWS = [
  { id: 'r1', cycle_id: 'c1', sub_category: 'T-Shirts' },
  { id: 'r2', cycle_id: 'c1', sub_category: 'Joggers' },
  { id: 'r3', cycle_id: 'c2', sub_category: 'Shirts' },
];

const PLAN_DATA = [
  { row_id: 'r1', month: '2026-04-01', sales_plan_gmv: 50000, nsv: 40000, nsq: 2000, inwards_qty: 1500, closing_stock_qty: 800, fwd_30day_doh: 40 },
  { row_id: 'r1', month: '2026-05-01', sales_plan_gmv: 60000, nsv: 48000, nsq: 2400, inwards_qty: 1800, closing_stock_qty: 900, fwd_30day_doh: 42 },
  { row_id: 'r2', month: '2026-04-01', sales_plan_gmv: 30000, nsv: 24000, nsq: 1200, inwards_qty: 900, closing_stock_qty: 500, fwd_30day_doh: 38 },
  { row_id: 'r3', month: '2026-04-01', sales_plan_gmv: 20000, nsv: 16000, nsq: 800, inwards_qty: 600, closing_stock_qty: 400, fwd_30day_doh: 35 },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function setupMocks(opts: { cycles?: any[]; planRows?: any[]; planData?: any[] } = {}) {
  const cycles = opts.cycles ?? CYCLES;
  const planRows = opts.planRows ?? PLAN_ROWS;
  const planData = opts.planData ?? PLAN_DATA;

  fromMocks = {
    otb_cycles: mockChain({ data: cycles, error: null }),
    otb_plan_rows: mockChain({ data: planRows, error: null }),
    otb_plan_data: mockChain({ data: planData, error: null }),
  };

  const supabase = { from: vi.fn((table: string) => fromMocks[table] || mockChain({ data: [], error: null })) };
  mockCreateServerClient.mockResolvedValue(supabase);

  return supabase;
}

async function callSummaryAPI(params: Record<string, string> = {}): Promise<DashboardSummaryResponse> {
  // Dynamic import so mocks are in place when the module loads
  const { GET } = await import('@/app/api/summary/route');
  const qs = new URLSearchParams(params).toString();
  const url = `http://localhost:3000/api/summary${qs ? `?${qs}` : ''}`;
  const req = new NextRequest(url);
  const response = await (GET as any)(req);
  return response.json();
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('GET /api/summary — Enhanced Dashboard Summary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns correct DashboardSummaryResponse shape', async () => {
    setupMocks();
    const data = await callSummaryAPI();

    // Top-level keys
    expect(data).toHaveProperty('kpiTotals');
    expect(data).toHaveProperty('brands');
    expect(data).toHaveProperty('months');

    // kpiTotals shape
    expect(data.kpiTotals).toHaveProperty('gmv');
    expect(data.kpiTotals).toHaveProperty('nsv');
    expect(data.kpiTotals).toHaveProperty('nsq');
    expect(data.kpiTotals).toHaveProperty('inwards_qty');
    expect(data.kpiTotals).toHaveProperty('avg_doh');
    expect(data.kpiTotals).toHaveProperty('closing_stock_qty');

    // Brand shape
    expect(data.brands.length).toBe(2);
    const brand = data.brands.find(b => b.brand_id === 'brand-1')!;
    expect(brand).toHaveProperty('cycle_id');
    expect(brand).toHaveProperty('planning_quarter');
    expect(brand).toHaveProperty('monthly');
    expect(brand).toHaveProperty('top_categories');
    expect(brand.monthly.length).toBeGreaterThan(0);
    expect(brand.top_categories.length).toBeGreaterThan(0);

    // Monthly shape
    const m = brand.monthly[0];
    expect(m).toHaveProperty('month');
    expect(m).toHaveProperty('gmv');
    expect(m).toHaveProperty('nsv');
    expect(m).toHaveProperty('nsq');
    expect(m).toHaveProperty('inwards_qty');
    expect(m).toHaveProperty('closing_stock_qty');
    expect(m).toHaveProperty('avg_doh');

    // Category shape
    const cat = brand.top_categories[0];
    expect(cat).toHaveProperty('sub_category');
    expect(cat).toHaveProperty('gmv');
    expect(cat).toHaveProperty('nsq');
    expect(cat).toHaveProperty('pct_of_total');
  });

  it('status param filters cycles to only Approved', async () => {
    setupMocks({ cycles: CYCLES.filter(c => c.status === 'Approved') });
    const data = await callSummaryAPI({ status: 'Approved' });

    // Verify the .in() call received only ['Approved']
    const cycleChain = fromMocks.otb_cycles;
    expect(cycleChain.in).toHaveBeenCalledWith('status', ['Approved']);

    // Only Approved brand in results
    expect(data.brands.length).toBe(1);
    expect(data.brands[0].status).toBe('Approved');
  });

  it('default status includes both InReview and Approved', async () => {
    setupMocks();
    await callSummaryAPI();

    const cycleChain = fromMocks.otb_cycles;
    expect(cycleChain.in).toHaveBeenCalledWith('status', ['InReview', 'Approved']);
  });

  it('kpiTotals are computed from Approved-only brands', async () => {
    setupMocks();
    const data = await callSummaryAPI();

    // brand-1 (Approved) totals: gmv = 50000+60000+30000 = 140000
    // brand-2 (InReview) totals: gmv = 20000 — should NOT be in kpiTotals
    expect(data.kpiTotals.gmv).toBe(140000);
    expect(data.kpiTotals.nsv).toBe(112000); // 40000+48000+24000
    expect(data.kpiTotals.nsq).toBe(5600);   // 2000+2400+1200
    expect(data.kpiTotals.inwards_qty).toBe(4200); // 1500+1800+900

    // But both brands are in the brands array
    expect(data.brands.length).toBe(2);
  });

  it('returns empty response when no cycles exist', async () => {
    setupMocks({ cycles: [], planRows: [], planData: [] });
    const data = await callSummaryAPI();

    expect(data.kpiTotals.gmv).toBe(0);
    expect(data.brands).toEqual([]);
    expect(data.months).toEqual([]);
  });

  it('top_categories are sorted by GMV desc and capped at 5', async () => {
    setupMocks();
    const data = await callSummaryAPI();

    const brand1 = data.brands.find(b => b.brand_id === 'brand-1')!;
    // brand-1 has T-Shirts (gmv=50000+60000=110000) and Joggers (gmv=30000)
    expect(brand1.top_categories[0].sub_category).toBe('T-Shirts');
    expect(brand1.top_categories[1].sub_category).toBe('Joggers');

    // pct_of_total should be correct
    // total brand GMV = 140000; T-Shirts = 110000 → ~78.57%
    expect(brand1.top_categories[0].pct_of_total).toBeCloseTo(78.57, 1);
  });

  it('months array is sorted chronologically', async () => {
    setupMocks();
    const data = await callSummaryAPI();

    expect(data.months).toEqual(['2026-04-01', '2026-05-01']);
  });

  it('monthly breakdown includes all months for each brand', async () => {
    setupMocks();
    const data = await callSummaryAPI();

    // brand-1 has data in both months, brand-2 only in April
    // But monthly array should include all months (filled with zeros for missing)
    const brand2 = data.brands.find(b => b.brand_id === 'brand-2')!;
    expect(brand2.monthly.length).toBe(2); // both months present
    const may = brand2.monthly.find(m => m.month === '2026-05-01')!;
    expect(may.gmv).toBe(0); // no data for brand-2 in May
  });
});
